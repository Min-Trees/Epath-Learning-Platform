import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, ok, bad } from "@/lib/api-auth";

/**
 * PUT /api/programs/reorder
 *  Body: { programs: { id, order, groupId? }[] }
 *  Batch update program order and groupId values.
 */
export async function PUT(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isAdmin(me)) return bad("Forbidden - chỉ admin", 403);

    const body = (await req.json().catch(() => null)) as {
      programs: { id: string; order: number; groupId?: string | null }[];
    } | null;
    if (!body?.programs || !Array.isArray(body.programs)) {
      return bad("Invalid body: programs array required");
    }

    const batch = adminDb.batch();
    for (const p of body.programs) {
      const ref = adminDb.collection("programs").doc(p.id);
      const updates: { [k: string]: any } = { order: p.order, updatedAt: new Date() };
      if ("groupId" in p) {
        updates.groupId = p.groupId ?? null;
      }
      batch.update(ref, updates);
    }
    await batch.commit();

    return ok();
  } catch (e) {
    console.error("[api/programs/reorder][PUT] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
