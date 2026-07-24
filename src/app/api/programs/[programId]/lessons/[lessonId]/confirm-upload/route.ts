import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isManagerOrAdmin, ok, bad } from "@/lib/api-auth";

/**
 * POST /api/programs/:programId/lessons/:lessonId/confirm-upload
 *  Body: { fileKey, fileMeta: { fileName, size, mimeType, duration? } }
 *  Lưu fileKey + fileMeta vào lesson. Đánh dấu hasTest = false (test là bước sau).
 *  Chỉ admin.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ programId: string; lessonId: string }> }) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isManagerOrAdmin(me)) return bad("Forbidden - chỉ admin và manager", 403);
    const { programId, lessonId } = await ctx.params;

    const body = (await req.json().catch(() => ({}))) as {
      fileKey?: string;
      fileMeta?: { fileName: string; size: number; mimeType: string; duration?: number };
    };
    if (!body.fileKey) return bad("fileKey bắt buộc");
    if (!body.fileMeta) return bad("fileMeta bắt buộc");

    const ref = adminDb
      .collection("programs")
      .doc(programId)
      .collection("lessons")
      .doc(lessonId);
    const snap = await ref.get();
    if (!snap.exists) return bad("Lesson not found", 404);

    await ref.update({
      fileKey: body.fileKey,
      fileMeta: body.fileMeta,
      updatedAt: new Date(),
    });
    return ok();
  } catch (e) {
    console.error("[api/lessons/:id/confirm-upload][POST] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
