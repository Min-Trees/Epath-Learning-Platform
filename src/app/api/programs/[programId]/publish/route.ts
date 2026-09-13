import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, isManager, ok, bad } from "@/lib/api-auth";
import { invalidateAll, invalidateUser, invalidateUsers } from "@/lib/cache/program-cache";

/**
 * POST /api/programs/:programId/publish
 *  - Admin: publish mọi chương trình
 *  - Manager: chỉ publish chương trình của họ
 *  Validate: phải có ít nhất 1 lesson. Set status = "published".
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ programId: string }> }) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isAdmin(me) && !isManager(me)) return bad("Forbidden - chỉ admin và manager", 403);
    const { programId } = await ctx.params;

    const ref = adminDb.collection("programs").doc(programId);
    const snap = await ref.get();
    if (!snap.exists) return bad("Program not found", 404);

    // Manager: chỉ publish program được gán cho họ (qua assignedManagers)
    const progData = snap.data() as {
      status?: string;
      assignedManagers?: string[];
    };
    const isProgramOwner =
      me.role === "manager" &&
      (progData.assignedManagers ?? []).includes(me.uid);
    if (!isAdmin(me) && !isProgramOwner) {
      return bad("Forbidden - bạn không có quyền publish chương trình này", 403);
    }

    const lessonsSnap = await ref.collection("lessons").get();
    if (lessonsSnap.empty) {
      return bad("Chương trình phải có ít nhất 1 lesson trước khi publish", 400);
    }

    await ref.update({
      status: "published",
      publishedAt: new Date(),
      updatedAt: new Date(),
    });

    // === Auto-sync assignments cho managers trong assignedManagers ===
    // Khi chuyển từ draft → published, các manager đã được gán quản lý nhưng
    // chưa có assignment (vì auto-create ở /managers PUT bị skip khi draft)
    // giờ sẽ tự động có document assignment để thấy trong "Chương trình của tôi".
    const managerIds = progData.assignedManagers ?? [];
    const createdManagerAssignments: string[] = [];
    if (managerIds.length > 0) {
      const batch = adminDb.batch();
      const existing = await Promise.all(
        managerIds.map((uid) =>
          adminDb.collection("assignments").doc(`${uid}_${programId}`).get()
        )
      );
      for (let i = 0; i < managerIds.length; i++) {
        const uid = managerIds[i];
        if (existing[i].exists) continue;
        const assignRef = adminDb
          .collection("assignments")
          .doc(`${uid}_${programId}`);
        batch.set(assignRef, {
          userId: uid,
          programId,
          assignedAt: new Date(),
          assignedBy: me.uid,
          status: "not_started",
          source: "auto_from_publish",
        });
        createdManagerAssignments.push(uid);
      }
      if (createdManagerAssignments.length > 0) {
        await batch.commit();
      }
    }

    // Publish ảnh hưởng đến mọi user có thể được gán chương trình này,
    // nên xóa cache của tất cả user (an toàn hơn).
    invalidateAll();

    return ok({
      success: true,
      managersAutoAssigned: createdManagerAssignments,
    });
  } catch (e) {
    console.error("[api/programs/:id/publish][POST] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}

/**
 * DELETE /api/programs/:programId/publish
 *  - Admin: unpublish mọi chương trình
 *  - Manager: chỉ unpublish chương trình của họ
 *  Unpublish: set status = "draft".
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ programId: string }> }) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isAdmin(me) && !isManager(me)) return bad("Forbidden - chỉ admin và manager", 403);
    const { programId } = await ctx.params;

    const ref = adminDb.collection("programs").doc(programId);
    const snap = await ref.get();
    if (!snap.exists) return bad("Program not found", 404);

    // Manager: chỉ unpublish program được gán cho họ
    const progData = snap.data() as { assignedManagers?: string[] };
    const isProgramOwner =
      me.role === "manager" &&
      (progData.assignedManagers ?? []).includes(me.uid);
    if (!isAdmin(me) && !isProgramOwner) {
      return bad("Forbidden - bạn không có quyền unpublish chương trình này", 403);
    }

    await ref.update({
      status: "draft",
      updatedAt: new Date(),
    });

    // Lấy danh sách user đã được gán program này để clear cache đúng user.
    // Tránh trường hợp employee vẫn thấy program đã bị unpublish trong 30s.
    try {
      const assignSnap = await adminDb
        .collection("assignments")
        .where("programId", "==", programId)
        .get();
      invalidateUsers(assignSnap.docs.map((d) => (d.data() as { userId?: string }).userId ?? "").filter(Boolean));
    } catch {
      // Fallback: clear all nếu không query được
      invalidateAll();
    }

    return ok();
  } catch (e) {
    console.error("[api/programs/:id/publish][DELETE] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}