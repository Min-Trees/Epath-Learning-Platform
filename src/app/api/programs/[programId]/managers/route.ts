import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, ok, bad } from "@/lib/api-auth";
import { invalidateUsers } from "@/lib/cache/program-cache";

/**
 * PUT /api/programs/:programId/managers
 *  Chỉ admin mới có quyền gán manager vào program
 *  Body: { managerIds: string[] } - mảng user IDs của managers
 *
 * Hành vi:
 *  - Cập nhật assignedManagers của program.
 *  - Với MỖI manager MỚI được thêm (có trong managerIds mới nhưng chưa có trong
 *    assignedManagers cũ), tự động tạo 1 document trong collection `assignments`
 *    để họ thấy chương trình ngay trong "Chương trình của tôi" của trang
 *    /dashboard/programs.
 *  - Nếu chương trình chưa publish (status !== "published") → KHÔNG tạo
 *    assignment cho manager (giống như /api/assignments).
 *  - Nếu assignment đã tồn tại → bỏ qua (idempotent).
 *  - KHÔNG xoá assignment khi manager bị gỡ khỏi assignedManagers (nếu họ
 *    đang học thì vẫn tiếp tục học được — chỉ mất quyền quản lý).
 */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ programId: string }> }) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isAdmin(me)) return bad("Forbidden - chỉ admin mới có quyền gán manager", 403);

    const { programId } = await ctx.params;

    const ref = adminDb.collection("programs").doc(programId);
    const snap = await ref.get();
    if (!snap.exists) return bad("Program not found", 404);

    const programData = snap.data() as {
      assignedManagers?: string[];
      status?: string;
      title?: string;
    };

    const body = (await req.json().catch(() => ({}))) as {
      managerIds?: string[];
    };

    if (!Array.isArray(body.managerIds)) {
      return bad("managerIds phải là mảng");
    }

    // Loại bỏ trùng lặp và giá trị rỗng
    const newManagerIds = Array.from(
      new Set(body.managerIds.filter((id) => typeof id === "string" && id.length > 0))
    );

    const oldManagerIds = Array.from(
      new Set(programData.assignedManagers ?? [])
    );

    console.log(
      `[api/programs/:id/managers][PUT] programId: ${programId}, old: [${oldManagerIds.join(
        ", "
      )}], new: [${newManagerIds.join(", ")}]`
    );

    // Tính managers MỚI (có trong new nhưng chưa có trong old)
    const addedManagerIds = newManagerIds.filter((id) => !oldManagerIds.includes(id));

    // Cập nhật assignedManagers
    await ref.update({
      assignedManagers: newManagerIds,
      updatedAt: new Date(),
    });

    // Verify the update
    const updatedSnap = await ref.get();
    const updatedData = updatedSnap.data();
    console.log(
      `[api/programs/:id/managers][PUT] After update - assignedManagers:`,
      updatedData?.assignedManagers
    );

    // === Auto-sync assignments cho managers mới ===
    const createdAssignments: string[] = [];
    const skippedReasons: { uid: string; reason: string }[] = [];

    if (addedManagerIds.length > 0) {
      // Chỉ tạo assignment khi chương trình đã publish
      if (programData.status !== "published") {
        for (const uid of addedManagerIds) {
          skippedReasons.push({
            uid,
            reason: `Chương trình "${programData.title || programId}" chưa được publish`,
          });
        }
      } else {
        // Kiểm tra user tồn tại + tạo assignment theo batch
        const batch = adminDb.batch();
        const existingDocs = await Promise.all(
          addedManagerIds.map((uid) =>
            adminDb.collection("assignments").doc(`${uid}_${programId}`).get()
          )
        );

        for (let i = 0; i < addedManagerIds.length; i++) {
          const uid = addedManagerIds[i];
          const existing = existingDocs[i];
          if (existing.exists) {
            skippedReasons.push({ uid, reason: "Assignment đã tồn tại" });
            continue;
          }
          const assignmentRef = adminDb
            .collection("assignments")
            .doc(`${uid}_${programId}`);
          batch.set(assignmentRef, {
            userId: uid,
            programId,
            assignedAt: new Date(),
            assignedBy: me.uid,
            status: "not_started",
            source: "auto_from_manager", // đánh dấu được tạo tự động từ gán quản lý
          });
          createdAssignments.push(uid);
        }

        if (createdAssignments.length > 0) {
          await batch.commit();
        }
      }

      // Invalidate cache "chương trình của tôi" của tất cả managers mới
      // (kể cả những người bị skip vì chương trình chưa publish, để cache stale được refresh)
      invalidateUsers(addedManagerIds);
    }

    return ok({
      success: true,
      managersAdded: addedManagerIds,
      assignmentsCreated: createdAssignments,
      assignmentsSkipped: skippedReasons,
    });
  } catch (e) {
    console.error("[api/programs/:id/managers][PUT] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
