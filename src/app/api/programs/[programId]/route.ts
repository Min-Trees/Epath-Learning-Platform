import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, isManager, ok, bad } from "@/lib/api-auth";
import { invalidateAll, invalidateUsers } from "@/lib/cache/program-cache";

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
 * PUT /api/programs/:programId - admin hoặc manager được gán
 *  Body: { title?, description?, status?, groupId? }
 */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ programId: string }> }) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    const { programId } = await ctx.params;

    const ref = adminDb.collection("programs").doc(programId);
    const snap = await ref.get();
    if (!snap.exists) return bad("Program not found", 404);
    const programData = snap.data() as Record<string, unknown>;

    // Kiểm tra quyền: admin thì được sửa tất cả,
    // manager phải nằm trong assignedManagers
    const assignedManagers = (programData.assignedManagers as string[] | undefined) ?? [];
    const isAssignedManager = me.role === "manager" && assignedManagers.includes(me.uid);
    if (!isAdmin(me) && !isAssignedManager) {
      return bad("Forbidden - bạn không có quyền sửa chương trình này", 403);
    }

    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      description?: string;
      status?: "draft" | "published";
      groupId?: string | null;
    };

    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.title === "string" && body.title.trim()) update.title = body.title.trim();
    if (typeof body.description === "string") update.description = body.description;
    if (body.status === "draft" || body.status === "published") update.status = body.status;
    if (body.groupId !== undefined) update.groupId = body.groupId;

    await ref.update(update);

    // Khi title/description/groupId/status thay đổi → cache list của user được
    // gán program này đã stale. Đơn giản nhất là clear all (ít tốn).
    if (
      update.title !== undefined ||
      update.description !== undefined ||
      update.status !== undefined ||
      update.groupId !== undefined
    ) {
      invalidateAll();
    }

    return ok();
  } catch (e) {
    console.error("[api/programs/:id][PUT] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}

/**
 * DELETE /api/programs/:programId
 *  - Admin: xóa mọi program
 *  - Manager: chỉ xóa program được gán
 *  Xóa program, lessons, tests, assignments, progress.
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ programId: string }> }) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    const { programId } = await ctx.params;

    const ref = adminDb.collection("programs").doc(programId);
    const snap = await ref.get();
    if (!snap.exists) return bad("Program not found", 404);

    // Manager: chỉ xóa program được gán
    const progData = snap.data() as { assignedManagers?: string[] };
    const assignedManagers = progData.assignedManagers ?? [];
    const isAssignedManager = me.role === "manager" && assignedManagers.includes(me.uid);
    if (!isAdmin(me) && !isAssignedManager) {
      return bad("Forbidden - bạn không có quyền xóa chương trình này", 403);
    }

    // Thu thập userId đã được gán program này để clear cache trước khi xóa.
    let affectedUserIds: string[] = [];
    try {
      const assignSnap = await adminDb
        .collection("assignments")
        .where("programId", "==", programId)
        .get();
      affectedUserIds = assignSnap.docs
        .map((d) => (d.data() as { userId?: string }).userId ?? "")
        .filter(Boolean);
    } catch {
      // ignore, dùng invalidateAll bên dưới
    }

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

    // Clear cache của các user đã được gán program này. Nếu lỗi thì clear all.
    if (affectedUserIds.length > 0) {
      invalidateUsers(affectedUserIds);
    } else {
      invalidateAll();
    }

    return ok();
  } catch (e) {
    console.error("[api/programs/:id][DELETE] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}