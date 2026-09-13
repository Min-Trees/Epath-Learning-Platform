import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, isManagerOrAdmin, ok, bad } from "@/lib/api-auth";
import { invalidateUser } from "@/lib/cache/program-cache";

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
    console.log("[api/programs][GET] Total programs:", snap.size);
    // Lọc bỏ "ghost" programs - documents không có title (thường là data
    // rỗng/bị xóa dở). Vẫn an toàn sau khi orderBy + limit vì data rỗng
    // không thể bị che bởi limit 200 trong thực tế.
    const items = snap.docs
      .map((d) => ({ id: d.id, raw: d.data() as Record<string, unknown> }))
      .filter(({ raw }) => {
        const title = raw.title;
        return typeof title === "string" && title.trim().length > 0;
      })
      .map(({ id, raw }) => {
        console.log(`[api/programs][GET] Program ${id}:`, raw.title, "| assignedManagers:", raw.assignedManagers);
        return { id, ...(raw as object) };
      });

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

    // Auto-tạo assignment cho từng manager trong assignedManagers để họ thấy
    // chương trình ngay trong "Chương trình của tôi" khi chương trình được
    // publish. Nếu program vẫn ở trạng thái draft, /api/me/programs sẽ lọc ra
    // cho non-admin — nhưng document assignment vẫn tồn tại để khi publish
    // không cần đồng bộ lại.
    if (assignedManagers.length > 0) {
      const batch = adminDb.batch();
      for (const uid of assignedManagers) {
        const assignRef = adminDb
          .collection("assignments")
          .doc(`${uid}_${ref.id}`);
        batch.set(assignRef, {
          userId: uid,
          programId: ref.id,
          assignedAt: new Date(),
          assignedBy: me.uid,
          status: "not_started",
          source: "auto_creator",
        });
      }
      await batch.commit();
      // Clear cache của các manager được gán tự động
      for (const uid of assignedManagers) invalidateUser(uid);
    }

    return ok({ programId: ref.id });
  } catch (e) {
    console.error("[api/programs][POST] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
