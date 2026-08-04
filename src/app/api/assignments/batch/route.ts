import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, ok, bad } from "@/lib/api-auth";

/**
 * DELETE /api/assignments/batch
 * Body: { items: Array<{ userId: string, programId: string }> }
 * Chỉ admin. Xóa nhiều assignment cùng lúc.
 * Trả về: { success: string[], failed: string[] }
 */
export async function DELETE(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isAdmin(me)) return bad("Forbidden - chỉ admin", 403);

    const body = (await req.json().catch(() => ({}))) as {
      items?: Array<{ userId: string; programId: string }>;
    };
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return bad("items phải là mảng không rỗng");
    }

    const success: string[] = [];
    const failed: string[] = [];

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
      } catch {
        failed.push(`${userId}_${programId}`);
      }
    }

    return ok({ success, failed });
  } catch (e) {
    console.error("[api/assignments/batch][DELETE] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
