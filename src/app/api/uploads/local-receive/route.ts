// Local "S3" receive endpoint - chỉ dùng khi S3 chưa cấu hình (S3_USE_LOCAL_FALLBACK=1).
// Stream PUT body trực tiếp ra file path dưới LOCAL_S3_DIR - KHÔNG load toàn bộ vào RAM.
//
// Đây là endpoint phục vụ DEV. PRODUCTION phải dùng Viettel IDC S3 thật với multipart upload
// cho file >100MB.
import { NextRequest, NextResponse } from "next/server";
import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { LOCAL_S3_DIR, S3_USE_LOCAL_FALLBACK } from "@/lib/s3";
import { getAuthUser } from "@/lib/api-auth";

export const runtime = "nodejs";
// Tắt cache để upload file lớn không bị cache trên edge/CDN
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB - giới hạn an toàn cho local dev

function safeJoin(base: string, ...parts: string[]): string {
  const resolved = path.resolve(base, ...parts);
  if (!resolved.startsWith(path.resolve(base))) {
    throw new Error("Path traversal detected");
  }
  return resolved;
}

export async function PUT(req: NextRequest) {
  if (!S3_USE_LOCAL_FALLBACK) {
    return NextResponse.json(
      { success: false, error: "Local S3 fallback is not enabled" },
      { status: 400 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    const exp = Number(searchParams.get("exp") ?? "0");
    const sig = searchParams.get("sig");
    if (!key || !exp || !sig) {
      return NextResponse.json(
        { success: false, error: "Missing key/exp/sig" },
        { status: 400 }
      );
    }
    if (Date.now() / 1000 > exp) {
      return NextResponse.json(
        { success: false, error: "Presigned URL expired" },
        { status: 410 }
      );
    }
    const expected = Buffer.from(`${key}|${exp}`).toString("base64url");
    if (expected !== sig) {
      return NextResponse.json(
        { success: false, error: "Invalid signature" },
        { status: 403 }
      );
    }

    // Yêu cầu Bearer token (admin)
    const me = await getAuthUser(req);
    if (!me || me.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Kiểm tra Content-Length (nếu client gửi)
    const contentLength = req.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File quá lớn (>${MAX_FILE_SIZE} bytes)` },
        { status: 413 }
      );
    }

    const target = safeJoin(LOCAL_S3_DIR, key);
    await mkdir(path.dirname(target), { recursive: true });

    // Stream body ra file - không load toàn bộ vào RAM.
    // req.body là ReadableStream (Web). Cần chuyển sang Node stream để pipe vào fs.
    if (!req.body) {
      return NextResponse.json(
        { success: false, error: "Empty body" },
        { status: 400 }
      );
    }

    const nodeStream = Readable.fromWeb(req.body as unknown as import("stream/web").ReadableStream);
    const fileStream = createWriteStream(target);

    let bytesWritten = 0;
    await new Promise<void>((resolve, reject) => {
      nodeStream.on("data", (chunk: Buffer) => {
        bytesWritten += chunk.length;
        if (bytesWritten > MAX_FILE_SIZE) {
          nodeStream.destroy();
          fileStream.destroy();
          reject(new Error(`File quá lớn (>${MAX_FILE_SIZE} bytes)`));
        }
      });
      nodeStream.on("error", reject);
      fileStream.on("error", reject);
      fileStream.on("finish", () => resolve());
      nodeStream.pipe(fileStream);
    });

    // Verify file size nếu Content-Length có
    if (contentLength && bytesWritten !== Number(contentLength)) {
      // Cleanup file không hoàn chỉnh
      await import("node:fs/promises").then((fs) => fs.unlink(target).catch(() => {}));
      return NextResponse.json(
        { success: false, error: `Size mismatch: expected ${contentLength}, got ${bytesWritten}` },
        { status: 400 }
      );
    }

    if (bytesWritten === 0) {
      return NextResponse.json(
        { success: false, error: "Empty body" },
        { status: 400 }
      );
    }

    const fileStat = await stat(target).catch(() => null);
    return NextResponse.json({
      success: true,
      key,
      size: fileStat?.size ?? bytesWritten,
    }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    console.error("[api/uploads/local-receive][PUT] error:", e);
    const message = e instanceof Error ? e.message : "Internal error";
    const status = message.includes("quá lớn") ? 413 : 500;
    return NextResponse.json(
      { success: false, error: message },
      {
        status,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: "Method not allowed" },
    { status: 405 }
  );
}

// Preflight CORS cho local fallback (chỉ áp dụng khi S3 chưa cấu hình).
// Khi đã cấu hình S3, browser upload thẳng tới S3 endpoint — CORS do bucket quyết định.
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