import { NextRequest, NextResponse } from "next/server";
import { Readable } from "node:stream";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { verifyStreamSession } from "@/lib/stream-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Module-level client: warm connection pool across requests
const s3 = new S3Client({
  region: process.env.S3_REGION ?? "auto",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  },
});

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const { token } = await ctx.params;
    const session = verifyStreamSession(token);
    if (!session) {
      return new NextResponse("Invalid or expired token", { status: 401 });
    }

    // Forward Range header so browser can do byte-range requests (HTTP 206).
    // This is what unlocks YouTube-style streaming — server doesn't have to
    // download the whole file before responding.
    const rangeHeader = req.headers.get("range") ?? undefined;

    const cmd = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET ?? "",
      Key: session.fk,
      ...(rangeHeader ? { Range: rangeHeader } : {}),
    });

    const upstream = await s3.send(cmd);
    if (!upstream.Body) {
      return new NextResponse("File not found", { status: 404 });
    }

    const headers = new Headers({
      "Content-Type":
        upstream.ContentType ?? getContentType(session.fk),
      "Accept-Ranges": "bytes",
      "Content-Disposition": "inline",
      // 60s private cache is enough for seek re-fetches inside one playback,
      // but tokens expire in 120s so cache can't outlast token anyway.
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
    });
    if (upstream.ContentLength != null) {
      headers.set("Content-Length", String(upstream.ContentLength));
    }
    if (upstream.ContentRange) {
      headers.set("Content-Range", upstream.ContentRange);
    }

    // Convert AWS SDK Node Readable → Web ReadableStream for NextResponse.
    const webStream = Readable.toWeb(
      upstream.Body as Readable
    ) as unknown as ReadableStream;

    return new NextResponse(webStream, {
      status: rangeHeader ? 206 : 200,
      headers,
    });
  } catch (e) {
    console.error("[stream/file] error:", e);
    return new NextResponse(
      e instanceof Error ? e.message : "Internal error",
      { status: 500 }
    );
  }
}

function getContentType(fileKey: string): string {
  const ext = fileKey.split(".").pop()?.toLowerCase() ?? "";
  const types: Record<string, string> = {
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    m4v: "video/x-m4v",
    pdf: "application/pdf",
  };
  return types[ext] ?? "application/octet-stream";
}