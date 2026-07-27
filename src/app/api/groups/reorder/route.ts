import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, ok, bad } from "@/lib/api-auth";

/**
 * PUT /api/groups/reorder
 *  Body: { groups: { id, order }[] }
 *  Batch update group order values.
 */
export async function PUT(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isAdmin(me)) return bad("Forbidden - chỉ admin", 403);

    const body = (await req.json().catch(() => null)) as {
      groups: { id: string; order: number }[];
    } | null;
    if (!body?.groups || !Array.isArray(body.groups)) {
      return bad("Invalid body: groups array required");
    }

    const batch = adminDb.batch();
    for (const g of body.groups) {
      const ref = adminDb.collection("programGroups").doc(g.id);
      batch.update(ref, { order: g.order, updatedAt: new Date() });
    }
    await batch.commit();

    return ok();
  } catch (e) {
    console.error("[api/groups/reorder][PUT] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
