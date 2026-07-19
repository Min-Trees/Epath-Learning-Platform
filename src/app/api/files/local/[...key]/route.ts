// Local "R2" serve endpoint - chỉ dùng khi R2 chưa cấu hình (R2_USE_LOCAL_FALLBACK=1).
// GET file đã upload từ local-receive.
// QUAN TRỌNG: route này KHÔNG đi qua session token nên chỉ cho admin truy cập
// (kể cả presigned URL). User thường phải dùng /api/stream/[token]/file.
import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { LOCAL_R2_DIR, R2_USE_LOCAL_FALLBACK } from "@/lib/r2";
import { getAuthUser, isAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";

function safeJoin(base: string, ...parts: string[]): string {
  const resolved = path.resolve(base, ...parts);
  if (!resolved.startsWith(path.resolve(base))) {
    throw new Error("Path traversal detected");
  }
  return resolved;
}

function guessMime(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (!ext) return "application/octet-stream";
  if (["mp4", "webm", "mov", "mkv", "m4v"].includes(ext)) {
    return ext === "mov" ? "video/quicktime" : `video/${ext}`;
  }
  if (ext === "pdf") return "application/pdf";
  if (ext === "pptx")
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  return "application/octet-stream";
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ key: string[] }> }
) {
  if (!R2_USE_LOCAL_FALLBACK) {
    return NextResponse.json(
      { success: false, error: "Local R2 fallback is not enabled" },
      { status: 400 }
    );
  }
  // Chỉ admin mới được truy cập file qua route này.
  // User thường phải dùng /api/stream/[token]/file (đã có session token).
  const me = await getAuthUser(req);
  if (!me || !isAdmin(me)) {
    return NextResponse.json(
      { success: false, error: "Forbidden - chỉ admin" },
      { status: 403 }
    );
  }
  try {
    const { searchParams } = new URL(req.url);
    const exp = Number(searchParams.get("exp") ?? "0");
    const sig = searchParams.get("sig");
    if (!exp || !sig) {
      return NextResponse.json(
        { success: false, error: "Missing exp/sig" },
        { status: 400 }
      );
    }
    if (Date.now() / 1000 > exp) {
      return NextResponse.json(
        { success: false, error: "Presigned URL expired" },
        { status: 410 }
      );
    }
    const segments = (await ctx.params).key;
    const key = segments
      .map((s) => decodeURIComponent(s))
      .join("/");
    const expected = Buffer.from(`${key}|${exp}`).toString("base64url");
    if (expected !== sig) {
      return NextResponse.json(
        { success: false, error: "Invalid signature" },
        { status: 403 }
      );
    }
    const target = safeJoin(LOCAL_R2_DIR, key);
    const st = await stat(target);
    if (!st.isFile()) {
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 }
      );
    }
    const buf = await readFile(target);
    const fileName = key.split("/").pop() ?? "file";
    const headers = new Headers();
    headers.set("Content-Type", guessMime(fileName));
    headers.set("Content-Length", String(st.size));
    headers.set("Cache-Control", "private, max-age=300");
    const dl = searchParams.get("dl");
    if (dl) headers.set("Content-Disposition", `attachment; filename="${dl}"`);
    // Range requests - để video tua được
    const range = req.headers.get("range");
    if (range) {
      const m = range.match(/^bytes=(\d*)-(\d*)$/);
      if (m) {
        const start = m[1] ? parseInt(m[1], 10) : 0;
        const end = m[2] ? parseInt(m[2], 10) : st.size - 1;
        if (start <= end && end < st.size) {
          const slice = buf.subarray(start, end + 1);
          headers.set("Content-Range", `bytes ${start}-${end}/${st.size}`);
          headers.set("Content-Length", String(slice.length));
          headers.set("Accept-Ranges", "bytes");
          return new NextResponse(slice, { status: 206, headers });
        }
      }
    }
    headers.set("Accept-Ranges", "bytes");
    return new NextResponse(buf, { status: 200, headers });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "ENOENT") {
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 }
      );
    }
    console.error("[api/files/local][GET] error:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
