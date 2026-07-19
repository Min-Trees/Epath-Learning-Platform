import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, ok, bad } from "@/lib/api-auth";
import type { LessonContentType } from "@/types/training";

/**
 * GET /api/programs/:programId/lessons/:lessonId
 *  Trả về chi tiết lesson (kèm textContent). Với non-admin: ẩn fileKey.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ programId: string; lessonId: string }> }) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    const { programId, lessonId } = await ctx.params;

    if (!isAdmin(me)) {
      const assignSnap = await adminDb
        .collection("assignments")
        .doc(`${me.uid}_${programId}`)
        .get();
      if (!assignSnap.exists) return bad("Forbidden", 403);
    }

    const ref = adminDb
      .collection("programs")
      .doc(programId)
      .collection("lessons")
      .doc(lessonId);
    const snap = await ref.get();
    if (!snap.exists) return bad("Lesson not found", 404);
    const data = snap.data() as Record<string, unknown>;
    if (!isAdmin(me)) {
      const { fileKey, ...rest } = data;
      return ok({ id: snap.id, ...rest });
    }
    return ok({ id: snap.id, ...data });
  } catch (e) {
    console.error("[api/lessons/:id][GET] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}

/**
 * PUT /api/programs/:programId/lessons/:lessonId
 *  Body: { title?, order?, contentType?, textContent?, fileKey?, fileMeta? }
 *  Chỉ admin.
 */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ programId: string; lessonId: string }> }) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isAdmin(me)) return bad("Forbidden - chỉ admin", 403);
    const { programId, lessonId } = await ctx.params;

    const ref = adminDb
      .collection("programs")
      .doc(programId)
      .collection("lessons")
      .doc(lessonId);
    const snap = await ref.get();
    if (!snap.exists) return bad("Lesson not found", 404);

    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      order?: number;
      contentType?: LessonContentType;
      textContent?: string | null;
      fileKey?: string | null;
      fileMeta?: { fileName: string; size: number; mimeType: string; duration?: number } | null;
    };

    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.title === "string" && body.title.trim()) {
      update.title = body.title.trim();
    }
    if (typeof body.order === "number") update.order = body.order;
    if (body.contentType) {
      if (!["text", "video", "pdf", "ppt"].includes(body.contentType)) {
        return bad("contentType không hợp lệ");
      }
      update.contentType = body.contentType;
    }
    if (typeof body.textContent === "string") update.textContent = body.textContent;
    if (body.textContent === null) update.textContent = null;
    if (typeof body.fileKey === "string") update.fileKey = body.fileKey;
    if (body.fileKey === null) update.fileKey = null;
    if (body.fileMeta) update.fileMeta = body.fileMeta;
    if (body.fileMeta === null) update.fileMeta = null;

    await ref.update(update);
    return ok();
  } catch (e) {
    console.error("[api/lessons/:id][PUT] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}

/**
 * DELETE /api/programs/:programId/lessons/:lessonId - chỉ admin
 *  Xóa cả test subcollection + progress lesson.
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ programId: string; lessonId: string }> }) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isAdmin(me)) return bad("Forbidden - chỉ admin", 403);
    const { programId, lessonId } = await ctx.params;

    const ref = adminDb
      .collection("programs")
      .doc(programId)
      .collection("lessons")
      .doc(lessonId);
    const snap = await ref.get();
    if (!snap.exists) return bad("Lesson not found", 404);

    // Xóa tests
    const testsSnap = await ref.collection("test").get();
    for (const t of testsSnap.docs) await t.ref.delete();

    // Xóa progress lesson của mọi user
    const progressSnap = await adminDb
      .collection("progress")
      .where("programId", "==", programId)
      .get();
    for (const p of progressSnap.docs) {
      const lp = await p.ref.collection("lessons").doc(lessonId).get();
      if (lp.exists) await lp.ref.delete();
    }

    await ref.delete();
    return ok();
  } catch (e) {
    console.error("[api/lessons/:id][DELETE] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
