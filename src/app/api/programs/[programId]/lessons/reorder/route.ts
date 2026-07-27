import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, ok, bad } from "@/lib/api-auth";

/**
 * PUT /api/programs/:programId/lessons/reorder
 *  Body: { lessons: { id, order }[] }
 *  Batch update lesson order values for a specific program.
 */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ programId: string }> }) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isAdmin(me)) return bad("Forbidden - chỉ admin", 403);
    const { programId } = await ctx.params;

    const body = (await req.json().catch(() => null)) as {
      lessons: { id: string; order: number }[];
    } | null;
    if (!body?.lessons || !Array.isArray(body.lessons)) {
      return bad("Invalid body: lessons array required");
    }

    const batch = adminDb.batch();
    for (const l of body.lessons) {
      const ref = adminDb
        .collection("programs")
        .doc(programId)
        .collection("lessons")
        .doc(l.id);
      batch.update(ref, { order: l.order, updatedAt: new Date() });
    }
    await batch.commit();

    return ok();
  } catch (e) {
    console.error("[api/programs/:id/lessons/reorder][PUT] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
