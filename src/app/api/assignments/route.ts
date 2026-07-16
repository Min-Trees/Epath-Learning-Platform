import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, ok, bad } from "@/lib/api-auth";

/**
 * GET /api/assignments?userId=&programId=
 *  - Admin: lấy tất cả assignment (lọc theo userId / programId nếu có)
 *  - Employee: chỉ lấy của chính mình
 */
export async function GET(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);

    const { searchParams } = new URL(req.url);
    const userIdFilter = searchParams.get("userId");
    const programIdFilter = searchParams.get("programId");

    let ref: FirebaseFirestore.Query = adminDb.collection("assignments");
    if (isAdmin(me)) {
      if (userIdFilter) ref = ref.where("userId", "==", userIdFilter);
      if (programIdFilter) ref = ref.where("programId", "==", programIdFilter);
    } else {
      ref = ref.where("userId", "==", me.uid);
    }
    ref = ref.limit(500);
    const snap = await ref.get();
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }));
    return ok({ items });
  } catch (e) {
    console.error("[api/assignments][GET] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}

/**
 * POST /api/assignments
 *  Body: { userIds: string[], programId }
 *  Chỉ admin. Tạo / upsert assignment cho từng user.
 *  Trả về: { created: string[], skipped: string[] }
 */
export async function POST(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isAdmin(me)) return bad("Forbidden - chỉ admin", 403);

    const body = (await req.json().catch(() => ({}))) as {
      userIds?: string[];
      programId?: string;
    };
    if (!body.programId) return bad("programId bắt buộc");
    if (!Array.isArray(body.userIds) || body.userIds.length === 0) {
      return bad("userIds phải là mảng không rỗng");
    }
    // Check program tồn tại & published
    const progSnap = await adminDb
      .collection("programs")
      .doc(body.programId)
      .get();
    if (!progSnap.exists) return bad("Program not found", 404);
    if ((progSnap.data() as { status?: string } | undefined)?.status !== "published") {
      return bad("Chỉ gán được chương trình đã publish");
    }

    const created: string[] = [];
    const skipped: string[] = [];
    const batch = adminDb.batch();
    for (const uid of body.userIds) {
      const docId = `${uid}_${body.programId}`;
      const ref = adminDb.collection("assignments").doc(docId);
      const existing = await ref.get();
      if (existing.exists) {
        skipped.push(uid);
        continue;
      }
      batch.set(ref, {
        userId: uid,
        programId: body.programId,
        assignedAt: new Date(),
        assignedBy: me.uid,
        status: "not_started",
      });
      created.push(uid);
    }
    if (created.length > 0) await batch.commit();
    return ok({ created, skipped });
  } catch (e) {
    console.error("[api/assignments][POST] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
