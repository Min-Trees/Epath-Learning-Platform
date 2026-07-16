import { NextRequest } from "next/server";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { verifyStreamSession } from "@/lib/stream-session";
import { R2_BUCKET, R2_CONFIGURED } from "@/lib/r2";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/stream/[token]/file
 *
 * Stream file PDF từ S3 storage về client SAU KHI xác thực session token.
 * Client không bao giờ nhận URL trực tiếp tới S3.
 *
 * Hỗ trợ HTTP Range requests (Accept-Ranges + 206 Partial Content)
 * để Chrome PDF viewer / pdf.js chỉ fetch từng phần → load nhanh hơn
 * rất nhiều với file lớn (vài chục MB trở lên). Nếu không có Range,
 * server vẫn stream toàn bộ (không buffer trong memory) qua Node Readable.
 *
 * Lưu ý: PDF là text nên có thể watermark bằng cách overlay text lên
 * từng trang (cần thư viện pdf-lib). Để đơn giản ở bước này, ta chỉ
 * thêm header X-Session-Id để tracking; nếu cần watermark thật, mình
 * sẽ bổ sung ở commit sau.
 */

interface RouteContext {
  params: Promise<{ token: string }>;
}

const MAX_PART_SIZE = 8 * 1024 * 1024; // 8MB per part cho GetObjectCommand khi range

function parseRangeHeader(
  rangeHeader: string | null,
  totalSize: number
): { start: number; end: number } | null {
  if (!rangeHeader) return null;
  const m = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
  if (!m) return null;
  const start = m[1] === "" ? Math.max(0, totalSize - parseInt(m[2] || "0", 10)) : parseInt(m[1], 10);
  const end = m[2] === "" ? totalSize - 1 : parseInt(m[2], 10);
  if (Number.isNaN(start) || Number.isNaN(end) || start > end || start < 0 || end < 0 || start >= totalSize) {
    return null;
  }
  return { start, end };
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const { token } = await ctx.params;
    const session = verifyStreamSession(token);
    if (!session) {
      return new Response("Invalid or expired token", { status: 401 });
    }
    if (session.kind !== "pdf") {
      return new Response("Only PDF sessions", { status: 400 });
    }
    if (!R2_CONFIGURED) {
      return new Response("S3 Storage chưa được cấu hình", { status: 500 });
    }

    const client = new S3Client({
      region: process.env.S3_REGION ?? "auto",
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      },
    });

    // HEAD-style: ta cần ContentLength để xử lý Range. Dùng GetObject rồi
    // đóng stream nếu không dùng (chỉ gọi khi thiếu Range header, vì
    // với Range R2 sẽ trả Content-Range + content-length của part).
    const rangeHeader = req.headers.get("range");
    const wantsStream = !!rangeHeader;

    let start = 0;
    let end = 0;
    let totalSize = 0;
    let contentType = "application/pdf";
    let body: Readable | undefined;
    let status = 200;

    if (wantsStream) {
      // Chưa biết total size, gọi 1 range nhỏ để lấy Content-Range, parse total.
      // Tối ưu: dùng GetObjectCommand trực tiếp với Range nếu client đã gửi.
      // Nếu client gửi range hợp lệ, dùng luôn range đó.
      const obj = await client.send(
        new GetObjectCommand({ Bucket: R2_BUCKET, Key: session.fk })
      );
      const size = obj.ContentLength;
      if (!obj.Body || size == null) {
        return new Response("Empty body", { status: 500 });
      }
      totalSize = size;
      if (obj.ContentType) contentType = obj.ContentType;
      const parsed = parseRangeHeader(rangeHeader, totalSize);
      if (!parsed) {
        // Range không hợp lệ → trả 416
        return new Response("Requested Range Not Satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${totalSize}` },
        });
      }
      start = parsed.start;
      end = parsed.end;
      // Đóng stream ban đầu (không cần body full)
      (obj.Body as unknown as { destroy?: () => void })?.destroy?.();

      const rangeObj = await client.send(
        new GetObjectCommand({
          Bucket: R2_BUCKET,
          Key: session.fk,
          Range: `bytes=${start}-${end}`,
        })
      );
      body = rangeObj.Body as Readable;
      if (rangeObj.ContentType) contentType = rangeObj.ContentType;
      status = 206;
    } else {
      const obj = await client.send(
        new GetObjectCommand({ Bucket: R2_BUCKET, Key: session.fk })
      );
      if (!obj.Body) {
        return new Response("Empty body", { status: 500 });
      }
      if (obj.ContentLength != null) totalSize = obj.ContentLength;
      if (obj.ContentType) contentType = obj.ContentType;
      start = 0;
      end = totalSize > 0 ? totalSize - 1 : 0;
      body = obj.Body as Readable;
    }

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Content-Disposition", "inline");
    headers.set("Cache-Control", "private, max-age=300");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Watermark-Session", session.sid);
    headers.set("X-Watermark-Email", session.email);

    if (status === 206) {
      const length = end - start + 1;
      headers.set("Content-Length", String(length));
      headers.set("Content-Range", `bytes ${start}-${end}/${totalSize}`);
    } else if (totalSize > 0) {
      headers.set("Content-Length", String(totalSize));
    }

    if (!body) {
      return new Response("Empty body", { status: 500 });
    }
    // Chuyển Node Readable → Web ReadableStream (web standard) để tránh
    // Next.js tự buffer. Với runtime=nodejs, Body có thể truyền trực tiếp,
    // nhưng dùng Readable.toWeb để đảm bảo streaming không bị buffer.
    const webStream = Readable.toWeb(body) as unknown as ReadableStream;
    return new Response(webStream, { status, headers });
  } catch (e) {
    console.error("[stream/file] error:", e);
    return new Response(
      `Internal error: ${e instanceof Error ? e.message : "unknown"}`,
      { status: 500 }
    );
  }
}
