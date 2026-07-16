import { NextRequest } from "next/server";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { verifyStreamSession } from "@/lib/stream-session";
import { R2_CONFIGURED, R2_BUCKET } from "@/lib/r2";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/stream/[token]/playlist.m3u8
 *
 * Trả về HLS playlist tham chiếu tới các segment.
 * Mỗi segment được sinh on-demand bằng FFmpeg từ file gốc trong S3 storage,
 * có watermark cố định "Bản quyền video thuộc CT TNHH Giáo Dục Epath".
 *
 * Mỗi session có 1 token riêng → user khác nhau sẽ có URL khác nhau
 * → server biết segment nào đang stream cho user nào.
 */

const SEGMENT_DURATION = 30; // giây / segment - tăng để giảm số lần FFmpeg

interface RouteContext {
  params: Promise<{ token: string }>;
}

function safeFilename(text: string): string {
  // Loại ký tự đặc biệt trong drawtext
  return text.replace(/[\\:'%]/g, "").slice(0, 60);
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const { token } = await ctx.params;
    const session = verifyStreamSession(token);
    if (!session) {
      return new Response("Invalid or expired token", { status: 401 });
    }
    if (session.kind !== "video") {
      return new Response("Only video sessions support HLS", { status: 400 });
    }

    // Lấy duration của video từ S3 storage
    const { duration, localPath } = await ensureSourceFile(session.fk);
    const totalSegments = Math.max(1, Math.ceil(duration / SEGMENT_DURATION));

    // Build m3u8 playlist
    const lines: string[] = [
      "#EXTM3U",
      "#EXT-X-VERSION:3",
      `#EXT-X-TARGETDURATION:${SEGMENT_DURATION + 5}`,
      "#EXT-X-MEDIA-SEQUENCE:0",
      "#EXT-X-PLAYLIST-TYPE:VOD",
    ];
    for (let i = 0; i < totalSegments; i++) {
      const start = i * SEGMENT_DURATION;
      lines.push(`#EXTINF:${SEGMENT_DURATION.toFixed(3)},`);
      lines.push(
        `/api/stream/${token}/segment/${i}.ts?n=${totalSegments}&d=${start}`
      );
    }
    lines.push("#EXT-X-ENDLIST");

    // Cleanup local file async
    void cleanupLocal(localPath);

    return new Response(lines.join("\n"), {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        // Cache playlist 60s - đủ để user tua qua tua lại
        "Cache-Control": "private, max-age=60, stale-while-revalidate=30",
      },
    });
  } catch (e) {
    console.error("[stream/playlist] error:", e);
    return new Response(
      `Internal error: ${e instanceof Error ? e.message : "unknown"}`,
      { status: 500 }
    );
  }
}

/** Download file từ S3 storage về local temp và lấy duration bằng ffprobe. */
async function ensureSourceFile(
  fileKey: string
): Promise<{ duration: number; localPath: string }> {
  if (!R2_CONFIGURED) {
    throw new Error("S3 Storage chưa được cấu hình");
  }
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "stream-src-"));
  const localPath = path.join(tmpDir, path.basename(fileKey));

  const client = new S3Client({
    region: process.env.S3_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
  });
  const obj = await client.send(
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: fileKey })
  );
  if (!obj.Body) throw new Error("S3 trả về body rỗng");

  const chunks: Buffer[] = [];
  for await (const chunk of obj.Body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  await fs.writeFile(localPath, Buffer.concat(chunks));

  const duration = await ffprobeDuration(localPath);
  return { duration, localPath };
}

async function ffprobeDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);
    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffprobe exit ${code}: ${err}`));
      const dur = parseFloat(out.trim());
      if (!Number.isFinite(dur)) return reject(new Error("Không đọc được duration"));
      resolve(dur);
    });
  });
}

async function cleanupLocal(filePath: string) {
  try {
    await fs.unlink(filePath);
    await fs.rmdir(path.dirname(filePath));
  } catch {
    // ignore
  }
}
