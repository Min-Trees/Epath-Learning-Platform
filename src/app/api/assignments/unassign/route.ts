import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, isManager, ok, bad } from "@/lib/api-auth";
import { invalidateUser } from "@/lib/cache/program-cache";

/**
 * DELETE /api/assignments?userId=&programId=
 *  - Admin: xóa bất kỳ assignment
 *  - Manager: chỉ xóa assignment của nhân viên thuộc quyền và program của họ
 *  Xóa assignment + progress liên quan.
 */
export async function DELETE(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isAdmin(me) && !isManager(me)) return bad("Forbidden", 403);
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const programId = searchParams.get("programId");
    if (!userId || !programId) return bad("Thiếu userId/programId");

    // Manager: kiểm tra user thuộc quyền và program thuộc quyền
    if (!isAdmin(me)) {
      const [userDoc, progDoc] = await Promise.all([
        adminDb.collection("users").doc(userId).get(),
        adminDb.collection("programs").doc(programId).get(),
      ]);
      const userData = userDoc.exists ? (userDoc.data() as { managerId?: string }) : null;
      const progData = progDoc.exists ? (progDoc.data() as { managerId?: string }) : null;
      if (!userData || userData.managerId !== me.uid) {
        return bad("Forbidden - bạn không có quyền hủy gán của nhân viên này", 403);
      }
      if (!progData || progData.managerId !== me.uid) {
        return bad("Forbidden - bạn không có quyền hủy gán chương trình này", 403);
      }
    }

    const ref = adminDb.collection("assignments").doc(`${userId}_${programId}`);
    const snap = await ref.get();
    if (!snap.exists) return bad("Assignment không tồn tại", 404);
    await ref.delete();
    // Xóa progress
    const progRef = adminDb
      .collection("progress")
      .doc(`${userId}_${programId}`);
    const progSnap = await progRef.get();
    if (progSnap.exists) {
      const lessonsSnap = await progRef.collection("lessons").get();
      for (const l of lessonsSnap.docs) await l.ref.delete();
      await progRef.delete();
    }

    // Clear cache của user bị hủy gán.
    invalidateUser(userId);

    return ok();
  } catch (e) {
    console.error("[api/assignments][DELETE] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
