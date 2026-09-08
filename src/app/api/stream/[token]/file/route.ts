import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand, S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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
 * This allows Cloudflare/Vercel to cache video chunks at the edge
 */
async function handleCdnMode(session: Awaited<ReturnType<typeof verifyStreamSession>>, req: NextRequest) {
  if (!session) return new NextResponse("Invalid session", { status: 401 });

  // Get video size for Range request handling at CDN level
  let contentLength: number | undefined;
  try {
    const headCmd = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET ?? "",
      Key: session.fk,
    });
    const headRes = await s3.send(headCmd);
    contentLength = headRes.ContentLength;
  } catch {
    // Ignore head error, CDN will handle it
  }

  // Generate signed URL with longer expiry for CDN caching
  const signedUrlCmd = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET ?? "",
    Key: session.fk,
    ...(contentLength ? { ContentLength: contentLength } : {}),
  });

  try {
    // Add response headers for CDN caching
    const signedUrl = await getSignedUrl(s3, signedUrlCmd, { 
      expiresIn: SIGNED_URL_EXPIRY 
    });

    // Redirect to CDN with signed URL
    // CDN will cache chunks based on Range headers
    const url = new URL(signedUrl);
    const cdnUrl = `${CDN_DOMAIN}${url.pathname}${url.search}`;

    const headers = new Headers({
      "Location": cdnUrl,
      "Cache-Control": "private, max-age=3600",
      "Content-Type": getContentType(session.fk),
      "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff",
    });

    if (contentLength) {
      headers.set("Content-Length", String(contentLength));
    }

    // Check for Range header and forward it
    const rangeHeader = req.headers.get("range");
    if (rangeHeader) {
      headers.set("X-Original-Range", rangeHeader);
      // For Range requests, proxy directly to S3
      return handleProxyMode(req, session);
    }

    return new NextResponse(null, { status: 302, headers });
  } catch (e) {
    console.error("[stream/file] CDN signed URL error:", e);
    // Fallback to proxy mode
    return handleProxyMode(req, session);
  }
}

/**
 * Proxy Mode: Direct S3 streaming (existing behavior)
 * Optimized with:
 * - Streaming response for better performance
 * - Better cache headers
 * - Connection pooling
 * - Partial content support
 */
async function handleProxyMode(req: NextRequest, session: NonNullable<Awaited<ReturnType<typeof verifyStreamSession>>>) {
  // Forward Range header so browser can do byte-range requests (HTTP 206).
  // This is what unlocks YouTube-style streaming — server doesn't have to
  // download the whole file before responding.
  const rangeHeader = req.headers.get("range") ?? undefined;
  const isRangeRequest = Boolean(rangeHeader);

  const cmd = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET ?? "",
    Key: session.fk,
    ...(rangeHeader ? { Range: rangeHeader } : {}),
  });

  const upstream = await s3.send(cmd);
  if (!upstream.Body) {
    return new NextResponse("File not found", { status: 404 });
  }

  const contentType = upstream.ContentType ?? getContentType(session.fk);
  
  // Optimized cache headers:
  // - Range requests: short cache (60s) since they're dynamic
  // - Non-range requests: longer cache (1 hour) for full video
  // - stale-while-revalidate: serve stale while fetching fresh
  const headers = new Headers({
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Content-Disposition": "inline",
    "Cache-Control": isRangeRequest 
      ? "private, max-age=60" 
      : "public, max-age=3600, stale-while-revalidate=7200",
    "X-Content-Type-Options": "nosniff",
    // Add ETag for better caching
    "ETag": upstream.ETag ?? `"${session.fk}"`,
    // Video-specific headers for better browser buffering
    "X-Content-Duration": "available",
  });
  
  if (upstream.ContentLength != null) {
    headers.set("Content-Length", String(upstream.ContentLength));
  }
  if (upstream.ContentRange) {
    headers.set("Content-Range", upstream.ContentRange);
  }

  // Convert AWS SDK response body to Web ReadableStream
  // AWS SDK v3 body can be Uint8Array, Blob, or Node.js Readable
  const body = upstream.Body;

  // Node.js Readable stream từ AWS SDK - check trước vì body thực tế là Readable
  // (type AWS SDK trả về là Uint8Array & Readable nên cần check pipe trước)
  if (
    typeof body === "object" &&
    body !== null &&
    "pipe" in body &&
    typeof (body as { pipe?: unknown }).pipe === "function"
  ) {
    // Node.js Readable stream - STREAM THỰC SỰ, không buffer toàn bộ
    const nodeStream = body as unknown as import("stream").Readable;

    // Tạo Web ReadableStream từ Node.js Readable để stream chunk-by-chunk
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
          controller.close();
        });

        nodeStream.on("error", (err: Error) => {
          controller.error(err);
        });
      },
      cancel() {
        // Cleanup when client disconnects
        nodeStream.destroy?.();
      },
    });

    return new Response(webStream, {
      status: isRangeRequest ? 206 : 200,
      headers,
    });
  } else if (body instanceof Uint8Array) {
    // Uint8Array - trả trực tiếp
    return new Response(body as unknown as BodyInit, {
      status: isRangeRequest ? 206 : 200,
      headers,
    });
  } else if (body instanceof Blob) {
    // Blob - trả trực tiếp
    return new Response(body, {
      status: isRangeRequest ? 206 : 200,
      headers,
    });
  } else if (typeof body === "object" && body !== null && "toWebStream" in body) {
    // Blob-like object với toWebStream
    const webStream = (body as { toWebStream: () => ReadableStream }).toWebStream();
    return new Response(webStream, {
      status: isRangeRequest ? 206 : 200,
      headers,
    });
  } else if (body && typeof body === "object" && "getReader" in body) {
    // Web ReadableStream
    return new Response(body as unknown as ReadableStream, {
      status: isRangeRequest ? 206 : 200,
      headers,
    });
  } else {
    // Unknown type - fallback
    return new Response(String(body ?? ""), {
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