import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, ok, bad } from "@/lib/api-auth";

/**
 * POST /api/assignments/batch
 * Body: { userId: string, programIds: string[] }
 * Chỉ admin. Gán nhiều chương trình cho một nhân viên.
 * Trả về: { created: string[], skipped: string[] }
 */
export async function POST(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isAdmin(me)) return bad("Forbidden - chỉ admin", 403);

    const body = (await req.json().catch(() => ({}))) as {
      userId?: string;
      programIds?: string[];
    };

    if (!body.userId) return bad("userId bắt buộc");
    if (!Array.isArray(body.programIds) || body.programIds.length === 0) {
      return bad("programIds phải là mảng không rỗng");
    }

    // Check user exists
    const userSnap = await adminDb.collection("users").doc(body.userId).get();
    if (!userSnap.exists) return bad("User not found", 404);

    // Check all programs exist & published
    const validProgramIds: string[] = [];
    for (const programId of body.programIds) {
      const progSnap = await adminDb.collection("programs").doc(programId).get();
      if (progSnap.exists && (progSnap.data() as { status?: string })?.status === "published") {
        validProgramIds.push(programId);
      }
    }

    if (validProgramIds.length === 0) {
      return bad("Không có chương trình nào hợp lệ (đã published)", 400);
    }

    const created: string[] = [];
    const skipped: string[] = [];

    for (const programId of validProgramIds) {
      const docId = `${body.userId}_${programId}`;
      const ref = adminDb.collection("assignments").doc(docId);
      const existing = await ref.get();
      if (existing.exists) {
        skipped.push(programId);
        continue;
      }
      await ref.set({
        userId: body.userId,
        programId,
        assignedAt: new Date(),
        assignedBy: me.uid,
        status: "not_started",
      });
      created.push(programId);
    }

    return ok({ created, skipped });
  } catch (e) {
    console.error("[api/assignments/batch][POST] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
