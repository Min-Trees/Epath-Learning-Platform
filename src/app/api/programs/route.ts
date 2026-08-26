import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, isManagerOrAdmin, ok, bad } from "@/lib/api-auth";

/**
 * GET /api/programs
 *  - Admin: lấy tất cả chương trình
 *  - Manager: chỉ lấy chương trình được gán cho họ (qua assignedManagers)
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

    if (isAdmin(me)) {
      // Admin: thấy tất cả, có thể filter theo status
      if (status) {
        ref = ref.where("status", "==", status);
      }
    } else if (me.role === "manager") {
      // Manager: chỉ thấy programs được gán qua assignedManagers array
      ref = ref.where("assignedManagers", "array-contains", me.uid);
      // Không filter theo status để xem được cả draft
    } else {
      // Employee: chỉ thấy published
      ref = ref.where("status", "==", "published");
    }

    ref = ref.orderBy("createdAt", "desc").limit(200);

    const snap = await ref.get();
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }));

    // Admin/Manager: also fetch groups
    const groups =
      isAdmin(me) || me.role === "manager"
        ? await adminDb
            .collection("programGroups")
            .orderBy("order", "asc")
            .get()
            .then((gs) => gs.docs.map((d) => ({ id: d.id, ...(d.data() as object) })))
        : [];

    return ok({ items, groups });
  } catch (e) {
    console.error("[api/programs][GET] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}

/**
 * POST /api/programs
 *  Body: { title, description?, groupId?, assignedManagers?: string[] }
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
      groupId?: string | null;
      assignedManagers?: string[];
    };
    const title = (body.title ?? "").trim();
    if (!title) return bad("Tiêu đề không được trống");
    const description = (body.description ?? "").trim();

    // Admin có thể gán managers, manager chỉ được tự gán mình
    let assignedManagers: string[] = [];
    if (isAdmin(me)) {
      // Admin: có thể gán nhiều managers
      assignedManagers = body.assignedManagers ?? [];
    } else if (me.role === "manager") {
      // Manager tạo program: tự động thêm mình vào assignedManagers
      assignedManagers = [me.uid];
    }

    const ref = await adminDb.collection("programs").add({
      title,
      description,
      status: "draft",
      createdBy: me.uid,
      createdAt: new Date(),
      updatedAt: new Date(),
      assignedManagers,
      ...(body.groupId !== undefined ? { groupId: body.groupId } : {}),
    });
    return ok({ programId: ref.id });
  } catch (e) {
    console.error("[api/programs][POST] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
