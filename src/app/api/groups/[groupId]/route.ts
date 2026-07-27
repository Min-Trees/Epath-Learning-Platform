import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, ok, bad } from "@/lib/api-auth";

/**
 * PUT /api/groups/:groupId
 *  Body: { name }
 */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ groupId: string }> }) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isAdmin(me)) return bad("Forbidden - chỉ admin", 403);
    const { groupId } = await ctx.params;

    const ref = adminDb.collection("programGroups").doc(groupId);
    const snap = await ref.get();
    if (!snap.exists) return bad("Group not found", 404);

    const body = (await req.json().catch(() => ({}))) as { name?: string };
    const name = (body.name ?? "").trim();
    if (!name) return bad("Tên nhóm không được trống");

    await ref.update({ name, updatedAt: new Date() });
    return ok();
  } catch (e) {
    console.error("[api/groups/:id][PUT] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}

/**
 * DELETE /api/groups/:groupId
 *  Xóa nhóm; set groupId=null trên các program thuộc nhóm này.
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ groupId: string }> }) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isAdmin(me)) return bad("Forbidden - chỉ admin", 403);
    const { groupId } = await ctx.params;

    const ref = adminDb.collection("programGroups").doc(groupId);
    const snap = await ref.get();
    if (!snap.exists) return bad("Group not found", 404);

    // Clear groupId on all programs in this group
    const progSnap = await adminDb
      .collection("programs")
      .where("groupId", "==", groupId)
      .get();
    const batch = adminDb.batch();
    for (const p of progSnap.docs) {
      batch.update(p.ref, { groupId: null, updatedAt: new Date() });
    }
    batch.delete(ref);
    await batch.commit();

    return ok();
  } catch (e) {
    console.error("[api/groups/:id][DELETE] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
