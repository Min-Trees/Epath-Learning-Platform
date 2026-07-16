// Local "R2" receive endpoint - chỉ dùng khi R2 chưa cấu hình (R2_USE_LOCAL_FALLBACK=1).
// PUT file vào file path dưới LOCAL_R2_DIR.
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { LOCAL_R2_DIR, R2_USE_LOCAL_FALLBACK } from "@/lib/r2";
import { getAuthUser } from "@/lib/api-auth";

export const runtime = "nodejs";

function safeJoin(base: string, ...parts: string[]): string {
  const resolved = path.resolve(base, ...parts);
  if (!resolved.startsWith(path.resolve(base))) {
    throw new Error("Path traversal detected");
  }
  return resolved;
}

export async function PUT(req: NextRequest) {
  if (!R2_USE_LOCAL_FALLBACK) {
    return NextResponse.json(
      { success: false, error: "Local R2 fallback is not enabled" },
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

    const buf = Buffer.from(await req.arrayBuffer());
    if (buf.length === 0) {
      return NextResponse.json(
        { success: false, error: "Empty body" },
        { status: 400 }
      );
    }
    const target = safeJoin(LOCAL_R2_DIR, key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, buf);
    return NextResponse.json({
      success: true,
      key,
      size: buf.length,
    });
  } catch (e) {
    console.error("[api/uploads/local-receive][PUT] error:", e);
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
