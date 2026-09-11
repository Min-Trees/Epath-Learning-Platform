import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, isManager, ok, bad } from "@/lib/api-auth";
import { invalidateUser, invalidateUsers } from "@/lib/cache/program-cache";

/**
 * DELETE /api/assignments/batch
 * Body: { items: Array<{ userId: string, programId: string }> }
 * - Admin: xóa mọi assignment
 * - Manager: chỉ xóa assignment của nhân viên thuộc quyền và program của họ
 * Trả về: { success: string[], failed: string[] }
 */
export async function DELETE(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isAdmin(me) && !isManager(me)) return bad("Forbidden", 403);

    const body = (await req.json().catch(() => ({}))) as {
      items?: Array<{ userId: string; programId: string }>;
    };
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return bad("items phải là mảng không rỗng");
    }

    // Manager: kiểm tra tất cả items phải thuộc quyền
    if (!isAdmin(me) && isManager(me)) {
      for (const { userId, programId } of body.items) {
        const [userDoc, progDoc] = await Promise.all([
          adminDb.collection("users").doc(userId).get(),
          adminDb.collection("programs").doc(programId).get(),
        ]);
        const userData = userDoc.exists ? (userDoc.data() as { managerId?: string }) : null;
        const progData = progDoc.exists ? (progDoc.data() as { managerId?: string }) : null;
        if (!userData || userData.managerId !== me.uid) {
          return bad(`Forbidden - user ${userId} không thuộc quyền của bạn`, 403);
        }
        if (!progData || progData.managerId !== me.uid) {
          return bad(`Forbidden - program ${programId} không thuộc quyền của bạn`, 403);
        }
      }
    }

    const success: string[] = [];
    const failed: string[] = [];
    const affectedUsers = new Set<string>();

    for (const { userId, programId } of body.items) {
      if (!userId || !programId) continue;
      try {
        const docId = `${userId}_${programId}`;
        const ref = adminDb.collection("assignments").doc(docId);
        const snap = await ref.get();
        if (!snap.exists) {
          failed.push(`${userId}_${programId}`);
          continue;
        }
        await ref.delete();

        // Xóa progress
        const progRef = adminDb
          .collection("progress")
          .doc(`${userId}_${programId}`);
        const progSnap = await progRef.get();
        if (progSnap.exists) {
          const lessonsSnap = await progRef.collection("lessons").get();
          const batchDelete = adminDb.batch();
          lessonsSnap.docs.forEach((l) => batchDelete.delete(l.ref));
          batchDelete.delete(progRef);
          await batchDelete.commit();
        }

        success.push(`${userId}_${programId}`);
        affectedUsers.add(userId);
      } catch {
        failed.push(`${userId}_${programId}`);
      }
    }

    // Clear cache của các user bị ảnh hưởng.
    invalidateUsers(affectedUsers);

    return ok({ success, failed });
  } catch (e) {
    console.error("[api/assignments/batch][DELETE] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
