import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, ok, bad } from "@/lib/api-auth";

/**
 * POST /api/programs/:programId/publish - chỉ admin
 *  Validate: phải có ít nhất 1 lesson. Set status = "published".
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ programId: string }> }) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isAdmin(me)) return bad("Forbidden - chỉ admin", 403);
    const { programId } = await ctx.params;

    const ref = adminDb.collection("programs").doc(programId);
    const snap = await ref.get();
    if (!snap.exists) return bad("Program not found", 404);

    const lessonsSnap = await ref.collection("lessons").get();
    if (lessonsSnap.empty) {
      return bad("Chương trình phải có ít nhất 1 lesson trước khi publish", 400);
    }

    await ref.update({
      status: "published",
      publishedAt: new Date(),
      updatedAt: new Date(),
    });
    return ok();
  } catch (e) {
    console.error("[api/programs/:id/publish][POST] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}

/**
 * DELETE /api/programs/:programId/publish - chỉ admin
 *  Unpublish: set status = "draft".
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ programId: string }> }) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isAdmin(me)) return bad("Forbidden - chỉ admin", 403);
    const { programId } = await ctx.params;

    const ref = adminDb.collection("programs").doc(programId);
    const snap = await ref.get();
    if (!snap.exists) return bad("Program not found", 404);

    await ref.update({
      status: "draft",
      updatedAt: new Date(),
    });
    return ok();
  } catch (e) {
    console.error("[api/programs/:id/publish][DELETE] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}