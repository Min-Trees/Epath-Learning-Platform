import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, ok, bad } from "@/lib/api-auth";

/**
 * DELETE /api/assignments?userId=&programId=
 *  Chỉ admin. Xóa assignment + progress liên quan.
 */
export async function DELETE(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isAdmin(me)) return bad("Forbidden - chỉ admin", 403);
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const programId = searchParams.get("programId");
    if (!userId || !programId) return bad("Thiếu userId/programId");
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
    return ok();
  } catch (e) {
    console.error("[api/assignments][DELETE] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
