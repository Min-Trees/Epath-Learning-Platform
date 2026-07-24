import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, isManagerOrAdmin, ok, bad } from "@/lib/api-auth";

/**
 * GET /api/programs
 *  - Admin: lấy tất cả chương trình
 *  - Employee: lấy tất cả chương trình đã published
 *  Query: ?status=draft|published
 */
export async function GET(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? undefined;

    let ref: FirebaseFirestore.Query = adminDb.collection("programs");
    if ((isAdmin(me) || me.role === "manager") && status) {
      ref = ref.where("status", "==", status);
    } else if (!isAdmin(me) && me.role !== "manager") {
      ref = ref.where("status", "==", "published");
    }
    ref = ref.orderBy("createdAt", "desc").limit(200);

    const snap = await ref.get();
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }));
    return ok({ items });
  } catch (e) {
    console.error("[api/programs][GET] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}

/**
 * POST /api/programs
 *  Body: { title, description }
 *  -> Tạo chương trình ở trạng thái draft (admin/manager).
 */
export async function POST(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isManagerOrAdmin(me)) return bad("Forbidden - chỉ admin/manager", 403);

    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      description?: string;
    };
    const title = (body.title ?? "").trim();
    if (!title) return bad("Tiêu đề không được trống");
    const description = (body.description ?? "").trim();

    const ref = await adminDb.collection("programs").add({
      title,
      description,
      status: "draft",
      createdBy: me.uid,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return ok({ programId: ref.id });
  } catch (e) {
    console.error("[api/programs][POST] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
