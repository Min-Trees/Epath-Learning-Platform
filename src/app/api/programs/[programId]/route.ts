import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, isManager, ok, bad } from "@/lib/api-auth";

/**
 * GET /api/programs/:programId
 *  Trả về chi tiết program + danh sách lessons (không kèm test).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ programId: string }> }) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    const { programId } = await ctx.params;

    const ref = adminDb.collection("programs").doc(programId);
    const snap = await ref.get();
    if (!snap.exists) return bad("Program not found", 404);
    const data = snap.data() as Record<string, unknown>;

    // Employee chỉ xem được program đã published; Manager xem được cả draft
    const canViewDraft = isAdmin(me) || isManager(me);
    if (!canViewDraft && data.status !== "published") {
      return bad("Forbidden", 403);
    }

    const lessonsSnap = await ref.collection("lessons").orderBy("order", "asc").get();
    const lessons = lessonsSnap.docs.map((d) => {
      const ld = d.data() as Record<string, unknown>;
      // Employee không thấy fileKey; Manager và Admin được thấy
      const hideFileKey = !isAdmin(me) && !isManager(me);
      if (hideFileKey) {
        const { fileKey: _fk, ...rest } = ld;
        return { id: d.id, ...rest };
      }
      return { id: d.id, ...ld };
    });

    return ok({ program: { id: snap.id, ...data }, lessons });
  } catch (e) {
    console.error("[api/programs/:id][GET] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}

/**
 * PUT /api/programs/:programId - chỉ admin
 *  Body: { title?, description?, status? }
 */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ programId: string }> }) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isAdmin(me)) return bad("Forbidden - chỉ admin", 403);
    const { programId } = await ctx.params;

    const ref = adminDb.collection("programs").doc(programId);
    const snap = await ref.get();
    if (!snap.exists) return bad("Program not found", 404);

    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      description?: string;
      status?: "draft" | "published";
    };

    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.title === "string" && body.title.trim()) update.title = body.title.trim();
    if (typeof body.description === "string") update.description = body.description;
    if (body.status === "draft" || body.status === "published") update.status = body.status;

    await ref.update(update);
    return ok();
  } catch (e) {
    console.error("[api/programs/:id][PUT] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}

/**
 * DELETE /api/programs/:programId - chỉ admin
 *  Xóa program, lessons, tests, assignments, progress.
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ programId: string }> }) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isAdmin(me)) return bad("Forbidden - chỉ admin", 403);
    const { programId } = await ctx.params;

    const ref = adminDb.collection("programs").doc(programId);
    const snap = await ref.get();
    if (!snap.exists) return bad("Program not found", 404);

    // Xóa lessons + tests của lessons
    const lessonsSnap = await ref.collection("lessons").get();
    for (const lessonDoc of lessonsSnap.docs) {
      const testsSnap = await lessonDoc.ref.collection("test").get();
      for (const t of testsSnap.docs) await t.ref.delete();
      await lessonDoc.ref.delete();
    }

    // Xóa assignments của program
    const assignSnap = await adminDb
      .collection("assignments")
      .where("programId", "==", programId)
      .get();
    for (const a of assignSnap.docs) await a.ref.delete();

    // Xóa progress của program
    const progressSnap = await adminDb
      .collection("progress")
      .where("programId", "==", programId)
      .get();
    for (const p of progressSnap.docs) {
      const lessonsProg = await p.ref.collection("lessons").get();
      for (const lp of lessonsProg.docs) await lp.ref.delete();
      await p.ref.delete();
    }

    await ref.delete();
    return ok();
  } catch (e) {
    console.error("[api/programs/:id][DELETE] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}