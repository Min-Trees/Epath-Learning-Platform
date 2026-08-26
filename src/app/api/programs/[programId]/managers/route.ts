import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, ok, bad } from "@/lib/api-auth";

/**
 * PUT /api/programs/:programId/managers
 *  Chỉ admin mới có quyền gán manager vào program
 *  Body: { managerIds: string[] } - mảng user IDs của managers
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

    const body = (await req.json().catch(() => ({}))) as {
      managerIds?: string[];
    };

    if (!Array.isArray(body.managerIds)) {
      return bad("managerIds phải là mảng");
    }

    await ref.update({
      assignedManagers: body.managerIds,
      updatedAt: new Date(),
    });

    return ok({ success: true });
  } catch (e) {
    console.error("[api/programs/:id/managers][PUT] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
