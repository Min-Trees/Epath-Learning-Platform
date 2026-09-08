import { NextRequest, NextResponse } from "next/server";
import {
  GetObjectCommand,
  S3Client,
  type GetObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { verifyStreamSession, type StreamSessionPayload } from "@/lib/stream-session";

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

// CDN domain for signed URLs (Cloudflare/Vercel custom domain)
const CDN_DOMAIN = process.env.CDN_DOMAIN;
// Token expiry for signed URLs (longer than JWT for CDN caching)
const SIGNED_URL_EXPIRY = 3600; // 1 hour for CDN signed URLs

interface RouteContext {
  params: Promise<{ token: string }>;
}

/**
 * GET /api/stream/[token]/file
 * 
 * Supports two modes based on CDN_DOMAIN:
 * 1. WITH CDN: Generate signed URL → redirect (fastest, CDN handles streaming)
 * 2. WITHOUT CDN: Proxy S3 Range request directly (existing behavior)
 */
export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const { token } = await ctx.params;
    const session = verifyStreamSession(token);
    if (!session) {
      return new NextResponse("Invalid or expired token", { status: 401 });
    }

    // Check if we should use CDN mode
    if (CDN_DOMAIN) {
      return handleCdnMode(session, req);
    } else {
      return handleProxyMode(req, session);
    }
  } catch (e) {
    console.error("[stream/file] error:", e);
    return new NextResponse(
      e instanceof Error ? e.message : "Internal error",
      { status: 500 }
    );
  }
}

/**
 * CDN Mode: Generate signed URL and redirect
 * Cloudflare/Vercel handles streaming at the edge.
 */
async function handleCdnMode(
  session: StreamSessionPayload | null,
  req: NextRequest
) {
  if (!session) return new NextResponse("Invalid session", { status: 401 });

  // Forward Range requests directly to S3 (CDN cannot handle Range for signed URLs easily)
  const rangeHeader = req.headers.get("range");
  if (rangeHeader) {
    return session ? handleProxyMode(req, session) : new NextResponse("Invalid session", { status: 401 });
  }

  // Generate signed URL for CDN
  const signedUrlCmd = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET ?? "",
    Key: session.fk,
  });

  try {
    const signedUrl = await getSignedUrl(s3, signedUrlCmd, {
      expiresIn: SIGNED_URL_EXPIRY,
    });

    const url = new URL(signedUrl);
    const cdnUrl = `${CDN_DOMAIN}${url.pathname}${url.search}`;

    const headers = new Headers({
      Location: cdnUrl,
      "Cache-Control": "private, max-age=3600",
      "Content-Type": getContentType(session.fk),
      "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff",
    });

    return new NextResponse(null, { status: 302, headers });
  } catch (e) {
    console.error("[stream/file] CDN signed URL error:", e);
    return session ? handleProxyMode(req, session) : new NextResponse("Invalid session", { status: 401 });
  }
}

/**
 * Proxy Mode: Direct S3 streaming
 * Forward Range header → browser does HTTP Range streaming natively.
 * Server-side streaming via Web ReadableStream for efficient chunk transfer.
 */
async function handleProxyMode(
  req: NextRequest,
  session: StreamSessionPayload
) {
  const rangeHeader = req.headers.get("range") ?? undefined;
  const isRangeRequest = Boolean(rangeHeader);

  const cmd = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET ?? "",
    Key: session.fk,
    ...(rangeHeader ? { Range: rangeHeader } : {}),
  });

  let upstream: GetObjectCommandOutput;
  try {
    upstream = await s3.send(cmd);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[stream/file] S3 error:", msg);
    // S3 returns: "The specified key does not exist." or contains "NoSuchKey"
    if (/NoSuchKey|does not exist|no such key|NotFound|404/i.test(msg)) {
      return new NextResponse("Video not found in storage", { status: 404 });
    }
    if (/access denied|forbidden|403/i.test(msg)) {
      return new NextResponse("Access denied to storage", { status: 403 });
    }
    return new NextResponse(`Stream error: ${msg}`, { status: 500 });
  }

  if (!upstream.Body) {
    return new NextResponse("Empty file", { status: 404 });
  }

  const contentType = upstream.ContentType ?? getContentType(session.fk);

  const headers = new Headers({
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Content-Disposition": "inline",
    "Cache-Control": isRangeRequest
      ? "private, max-age=60"
      : "public, max-age=3600, stale-while-revalidate=7200",
    "X-Content-Type-Options": "nosniff",
    "ETag": upstream.ETag ?? `"${session.fk}"`,
  });

  if (upstream.ContentLength != null) {
    headers.set("Content-Length", String(upstream.ContentLength));
  }
  if (upstream.ContentRange) {
    headers.set("Content-Range", upstream.ContentRange);
  }

  const body = upstream.Body;

  // Convert AWS SDK v3 Node.js Readable to Web ReadableStream
  if (
    typeof body === "object" &&
    body !== null &&
    "pipe" in body &&
    typeof (body as { pipe?: unknown }).pipe === "function"
  ) {
    const nodeStream = body as unknown as import("stream").Readable;

    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on("data", (chunk: Buffer | string | Uint8Array) => {
          if (Buffer.isBuffer(chunk)) {
            controller.enqueue(new Uint8Array(chunk));
          } else if (chunk instanceof Uint8Array) {
            controller.enqueue(chunk);
          } else {
            controller.enqueue(new Uint8Array(Buffer.from(chunk)));
          }
        });
        nodeStream.on("end", () => {
          try { controller.close(); } catch { /* already closed */ }
        });
        nodeStream.on("error", (err: Error) => {
          try { controller.error(err); } catch { /* already closed */ }
        });
      },
      cancel() {
        nodeStream.destroy?.();
      },
    });

    return new Response(webStream, {
      status: isRangeRequest ? 206 : 200,
      headers,
    });
  } else if (body instanceof Blob) {
    return new Response(body, {
      status: isRangeRequest ? 206 : 200,
      headers,
    });
  } else if (body instanceof Uint8Array) {
    return new Response(body as unknown as BodyInit, {
      status: isRangeRequest ? 206 : 200,
      headers,
    });
  } else if (typeof body === "object" && body !== null && "toWebStream" in body) {
    const webStream = (body as { toWebStream: () => ReadableStream }).toWebStream();
    return new Response(webStream, {
      status: isRangeRequest ? 206 : 200,
      headers,
    });
  } else {
    // Fallback: encode as UTF-8 Uint8Array
    const text = body != null ? String(body) : "";
    return new Response(new TextEncoder().encode(text), {
      status: isRangeRequest ? 206 : 200,
      headers,
    });
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