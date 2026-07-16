import { NextRequest } from "next/server";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { verifyStreamSession } from "@/lib/stream-session";
import { R2_BUCKET, R2_CONFIGURED } from "@/lib/r2";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/stream/[token]/segment/[N].ts
 *
 * Trả về 1 segment .ts của HLS. Mỗi segment là kết quả của FFmpeg
 * transcode phần [start, start+SEGMENT_DURATION] của video gốc,
 * kèm watermark cố định "Bản quyền video thuộc CT TNHH Giáo Dục Epath".
 *
 * Tối ưu: Cache segment đã transcode (vì watermark cố định cho mọi user).
 *
 * Tham số query:
 *   n: tổng số segment (để tính thời lượng đoạn cuối)
 *   d: start time (giây)
 */

const SEGMENT_DURATION = 30; // giây / segment - tăng để giảm số lần FFmpeg

/**
 * Watermark cố định cho mọi user.
 */
const COPYRIGHT_TEXT = "Bản quyền video thuộc CT TNHH Giáo Dục Epath";

interface RouteContext {
  params: Promise<{ token: string; filename: string }>;
}

/**
 * Cache file nguồn theo session id (in-memory).
 * Key: sid
 */
const sourceCache = new Map<string, { path: string; expiresAt: number }>();

/**
 * Cache segment đã transcode (vì watermark cố định).
 * Key: `${sid}:${segIndex}:${startTime}`
 */
const segmentCache = new Map<string, { buffer: Buffer; expiresAt: number }>();

async function ensureSourceFileCached(sid: string, fileKey: string): Promise<{ localPath: string }> {
  const now = Date.now();
  const cached = sourceCache.get(sid);
  if (cached && cached.expiresAt > now) {
    return { localPath: cached.path };
  }
  if (!R2_CONFIGURED) throw new Error("S3 Storage chưa được cấu hình");

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
  const obj = await client.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: fileKey }));
  if (!obj.Body) throw new Error("S3 trả về body rỗng");

  const chunks: Buffer[] = [];
  // @ts-expect-error - Body là Node Readable trong Node runtime
  for await (const chunk of obj.Body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  await fs.writeFile(localPath, Buffer.concat(chunks));

  // Cache 60 phút
  sourceCache.set(sid, { path: localPath, expiresAt: now + 60 * 60 * 1000 });

  // Cleanup entry cũ
  for (const [k, v] of sourceCache.entries()) {
    if (v.expiresAt <= now) {
      sourceCache.delete(k);
      try {
        await fs.unlink(v.path).catch(() => {});
        await fs.rmdir(path.dirname(v.path)).catch(() => {});
      } catch { /* ignore */ }
    }
  }

  return { localPath };
}

function getCachedSegment(sid: string, segIndex: number, startTime: number): Buffer | null {
  const cacheKey = `${sid}:${segIndex}:${startTime}`;
  const now = Date.now();
  const cached = segmentCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.buffer;
  }
  return null;
}

function setCachedSegment(sid: string, segIndex: number, startTime: number, buffer: Buffer): void {
  const cacheKey = `${sid}:${segIndex}:${startTime}`;
  segmentCache.set(cacheKey, { buffer, expiresAt: Date.now() + 30 * 60 * 1000 });

  // Cleanup nếu cache quá lớn
  if (segmentCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of segmentCache.entries()) {
      if (v.expiresAt <= now) segmentCache.delete(k);
    }
    if (segmentCache.size > 500) {
      const keys = Array.from(segmentCache.keys()).slice(0, 250);
      keys.forEach((k) => segmentCache.delete(k));
    }
  }
}

function ffmpegSegmentWithWatermark(opts: {
  inputPath: string;
  startTime: number;
  duration: number;
  watermarkText: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const args = [
      "-ss", opts.startTime.toString(),
      "-i", opts.inputPath,
      "-t", opts.duration.toString(),
      "-vf", [
        `drawtext=fontfile='C\\:/Windows/Fonts/segoeui.ttf':text='${escapeDrawtext(opts.watermarkText)}':` +
          `fontcolor=white@0.75:fontsize=14:` +
          `box=1:boxcolor=black@0.45:boxborderw=4:` +
          `x=if(lt(t\\,2)\\,(W-tw-20)+(t*4)\\,if(lt(t\\,4)\\,W-tw-20\\,W-tw-20-(t-4)*4)):` +
          `y=H-th-30`,
        `drawtext=fontfile='C\\:/Windows/Fonts/segoeui.ttf':text='%{pts\\:hms}':` +
          `fontcolor=white@0.5:fontsize=12:` +
          `x=20:y=20:` +
          `box=1:boxcolor=black@0.35:boxborderw=2`,
      ].join(","),
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "28",
      "-c:a", "aac",
      "-b:a", "96k",
      "-ac", "2",
      "-f", "mpegts",
      "-",
    ];

    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    let errOut = "";
    proc.stdout.on("data", (d) => chunks.push(Buffer.from(d)));
    proc.stderr.on("data", (d) => (errOut += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg exit ${code}: ${errOut.slice(-500)}`));
      resolve(Buffer.concat(chunks));
    });
  });
}

function escapeDrawtext(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/:/g, "\\:").replace(/%/g, "\\%");
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const { token, filename } = await ctx.params;

    const match = /^(\d+)\.ts$/.exec(filename);
    if (!match) return new Response("Invalid segment filename", { status: 400 });
    const segIndex = parseInt(match[1], 10);

    const session = verifyStreamSession(token);
    if (!session) return new Response("Invalid or expired token", { status: 401 });
    if (session.kind !== "video") return new Response("Only video sessions", { status: 400 });

    const url = new URL(req.url);
    const startTime = parseFloat(url.searchParams.get("d") ?? "0");

    // Thử lấy từ cache trước (vì watermark cố định)
    const cachedBuffer = getCachedSegment(session.sid, segIndex, startTime);
    if (cachedBuffer) {
      return new Response(cachedBuffer, {
        headers: {
          "Content-Type": "video/mp2t",
          "Cache-Control": "private, max-age=900",
          "X-Cache": "HIT",
        },
      });
    }

    // Tải file gốc từ R2 (cache per-session)
    const { localPath } = await ensureSourceFileCached(session.sid, session.fk);

    // Transcode segment với watermark
    const tsBuffer = await ffmpegSegmentWithWatermark({
      inputPath: localPath,
      startTime,
      duration: SEGMENT_DURATION,
      watermarkText: COPYRIGHT_TEXT,
    });

    // Lưu vào cache
    setCachedSegment(session.sid, segIndex, startTime, tsBuffer);

    return new Response(tsBuffer, {
      headers: {
        "Content-Type": "video/mp2t",
        "Cache-Control": "private, max-age=900",
        "X-Cache": "MISS",
      },
    });
  } catch (e) {
    console.error("[stream/segment] error:", e);
    return new Response(`Internal error: ${e instanceof Error ? e.message : "unknown"}`, { status: 500 });
  }
}
