import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, ok, bad } from "@/lib/api-auth";
import { v4 as uuidv4 } from "uuid";

/**
 * GET /api/groups
 *  - Admin: lấy tất cả nhóm
 */
export async function GET(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isAdmin(me)) return bad("Forbidden - chỉ admin", 403);

    const snap = await adminDb
      .collection("programGroups")
      .orderBy("order", "asc")
      .orderBy("createdAt", "asc")
      .get();
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }));
    return ok({ items });
  } catch (e) {
    console.error("[api/groups][GET] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}

/**
 * POST /api/groups
 *  Body: { name }
 *  Tạo nhóm mới.
 */
export async function POST(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isAdmin(me)) return bad("Forbidden - chỉ admin", 403);

    const body = (await req.json().catch(() => ({}))) as { name?: string };
    const name = (body.name ?? "").trim();
    if (!name) return bad("Tên nhóm không được trống");

    // Get max order
    const snap = await adminDb
      .collection("programGroups")
      .orderBy("order", "desc")
      .limit(1)
      .get();
    const maxOrder = snap.empty ? 0 : ((snap.docs[0].data() as { order: number }).order ?? 0);

    const ref = await adminDb.collection("programGroups").add({
      name,
      order: maxOrder + 1,
      createdAt: new Date(),
    });
    return ok({ groupId: ref.id });
  } catch (e) {
    console.error("[api/groups][POST] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
