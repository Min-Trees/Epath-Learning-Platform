// Server-side proxy upload — bypass CORS bằng cách upload lên Viettel IDC S3 qua server.
//
// Khi nào dùng:
// - Khi CORS bucket chưa được cấu hình: client không PUT được trực tiếp tới S3 (Status 0).
// - Khi gặp "Failed to fetch" với file lớn: không cần đổi bucket config, chỉ cần route này.
//
// Flow:
//   Client → PUT /api/uploads/s3-proxy (stream body) → Server upload lên S3 qua aws-sdk
//
// Auth: chỉ admin mới được upload. Verify token Firebase.
import { NextRequest, NextResponse } from "next/server";
import { Upload } from "@aws-sdk/lib-storage";
import { S3Client } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { getAuthUser } from "@/lib/api-auth";
import { S3_BUCKET, S3_CONFIGURED } from "@/lib/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const s3 = new S3Client({
  region: process.env.S3_REGION ?? "auto",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  },
  // KHÔNG tính SHA256 trên flowing stream — aws-sdk V4 sẽ throw
  // "Unable to calculate hash for flowing readable stream" với streaming body.
  // Multipart upload sẽ tự tính MD5 cho từng part (chunk), không cần hash toàn bộ.
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

const MAX_SIZE = 5 * 1024 * 1024 * 1024; // 5GB

export async function PUT(req: NextRequest) {
  if (!S3_CONFIGURED) {
    return NextResponse.json(
      { success: false, error: "S3 chưa cấu hình" },
      { status: 503 }
    );
  }

  const me = await getAuthUser(req);
  if (!me || me.role !== "admin") {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const fileKey = searchParams.get("key");
  const contentType = searchParams.get("contentType") ?? "application/octet-stream";
  if (!fileKey) {
    return NextResponse.json(
      { success: false, error: "Thiếu key" },
      { status: 400 }
    );
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_SIZE) {
    return NextResponse.json(
      { success: false, error: `File quá lớn (>${MAX_SIZE} bytes)` },
      { status: 413 }
    );
  }

  if (!req.body) {
    return NextResponse.json(
      { success: false, error: "Empty body" },
      { status: 400 }
    );
  }

  try {
    const nodeStream = Readable.fromWeb(
      req.body as unknown as import("stream/web").ReadableStream
    );

    // Track size để chặn over-quota + log progress
    let bytesStreamed = 0;
    nodeStream.on("data", (chunk: Buffer) => {
      bytesStreamed += chunk.length;
      if (bytesStreamed > MAX_SIZE) {
        nodeStream.destroy(new Error("File quá lớn"));
      }
    });

    console.log(
      `[s3-proxy] multipart upload start: key=${fileKey} size=${contentLength}`
    );

    // Multipart upload với aws-sdk lib-storage. Tự động chia chunk 5MB (mặc định)
    // và tính MD5 cho mỗi part. KHÔNG yêu cầu SHA256 toàn bộ body.
    // Khi truyền stream làm input, lib-storage sẽ tự buffer vào temp file/disk
    // nếu cần (xem `Upload` docs).
    const upload = new Upload({
      client: s3,
      params: {
        Bucket: S3_BUCKET,
        Key: fileKey,
        ContentType: contentType,
        Body: nodeStream,
      },
      partSize: 5 * 1024 * 1024, // 5MB mỗi part
      queueSize: 4, // upload tối đa 4 parts song song
      leavePartsOnError: false,
    });

    upload.on("httpUploadProgress", (event) => {
      if (event.loaded && event.total) {
        const pct = Math.round((event.loaded / event.total) * 100);
        console.log(
          `[s3-proxy] progress ${pct}% (${event.loaded}/${event.total})`
        );
      }
    });

    await upload.done();

    console.log(
      `[s3-proxy] multipart upload done: key=${fileKey} bytes=${bytesStreamed}`
    );

    return NextResponse.json({
      success: true,
      key: fileKey,
      size: bytesStreamed,
    });
  } catch (e) {
    console.error("[api/uploads/s3-proxy][PUT] error:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: "Method not allowed" },
    { status: 405 }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}
