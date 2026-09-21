import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, isManager, ok, bad } from "@/lib/api-auth";
import { invalidateUser, invalidateUsers } from "@/lib/cache/program-cache";

/**
 * GET /api/assignments?userId=&programId=&status=
 *  - Admin: lấy tất cả assignment (lọc theo userId / programId / status nếu có)
 *  - Manager: lấy assignment của nhân viên thuộc quyền
 *  - Employee: chỉ lấy của chính mình
 */
export async function GET(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);

    const { searchParams } = new URL(req.url);
    const userIdFilter = searchParams.get("userId");
    const programIdFilter = searchParams.get("programId");
    const statusFilter = searchParams.get("status");

    let ref: FirebaseFirestore.Query = adminDb.collection("assignments");
    if (isAdmin(me)) {
      if (userIdFilter) ref = ref.where("userId", "==", userIdFilter);
      if (programIdFilter) ref = ref.where("programId", "==", programIdFilter);
      if (statusFilter) ref = ref.where("status", "==", statusFilter);
    } else if (isManager(me)) {
      // Manager chỉ thấy assignments của nhân viên thuộc quyền
      const usersSnap = await adminDb
        .collection("users")
        .where("managerId", "==", me.uid)
        .get();
      const managedUserIds = usersSnap.docs.map((d) => d.id);
      if (managedUserIds.length === 0) {
        return ok({ items: [] });
      }
      // Firestore 'in' giới hạn 10 giá trị - dùng array-contains-any hoặc query theo từng user
      // Đơn giản: lấy theo userId đầu tiên nếu có filter, hoặc lấy tất cả
      if (userIdFilter && managedUserIds.includes(userIdFilter)) {
        ref = ref.where("userId", "==", userIdFilter);
      } else if (userIdFilter) {
        // User filter không thuộc quyền
        return ok({ items: [] });
      } else {
        // Lấy tất cả rồi filter (giới hạn 500)
        ref = ref.limit(500);
      }
      if (programIdFilter) ref = ref.where("programId", "==", programIdFilter);
      if (statusFilter) ref = ref.where("status", "==", statusFilter);
    } else {
      ref = ref.where("userId", "==", me.uid);
    }
    ref = ref.limit(500);
    const snap = await ref.get();
    let items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }));

    // Manager: lọc lại các assignment của nhân viên không thuộc quyền (nếu chưa filter)
    if (isManager(me) && !isAdmin(me) && !userIdFilter) {
      const usersSnap = await adminDb
        .collection("users")
        .where("managerId", "==", me.uid)
        .get();
      const managedUserIds = new Set(usersSnap.docs.map((d) => d.id));
      items = items.filter((it) => managedUserIds.has((it as { userId?: string }).userId ?? ""));
    }

    return ok({ items });
  } catch (e) {
    console.error("[api/assignments][GET] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}

/**
 * POST /api/assignments
 *  Body: { userIds: string[], programId }
 *  - Admin: gán cho bất kỳ user nào
 *  - Manager: chỉ gán cho nhân viên thuộc quyền và program của họ
 *  Trả về: { created: string[], skipped: string[] }
 */
export async function POST(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isAdmin(me) && !isManager(me)) return bad("Forbidden", 403);

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
    const progData = progSnap.data() as {
      status?: string;
      assignedManagers?: string[];
    };

    // Manager: chỉ gán được program mà họ được phân công quản lý
    if (!isAdmin(me)) {
      const assigned = progData.assignedManagers ?? [];
      if (!assigned.includes(me.uid)) {
        return bad("Forbidden - bạn không có quyền gán chương trình này", 403);
      }
    }

    if (progData.status !== "published") {
      return bad("Chỉ gán được chương trình đã publish");
    }

    // Manager: kiểm tra tất cả userIds phải thuộc quyền
    if (!isAdmin(me) && isManager(me)) {
      const userChecks = await Promise.all(
        body.userIds.map((uid) => adminDb.collection("users").doc(uid).get())
      );
      const invalidUsers: string[] = [];
      for (let i = 0; i < body.userIds.length; i++) {
        const userDoc = userChecks[i];
        if (!userDoc.exists) {
          invalidUsers.push(body.userIds[i]);
          continue;
        }
        const userData = userDoc.data() as { managerId?: string };
        if (userData.managerId !== me.uid) {
          invalidUsers.push(body.userIds[i]);
        }
      }
      if (invalidUsers.length > 0) {
        return bad(`Bạn không có quyền gán cho các user: ${invalidUsers.join(", ")}`, 403);
      }
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

    // Sau khi gán → list "chương trình của tôi" của user được gán đã stale.
    invalidateUsers(created);

    return ok({ created, skipped });
  } catch (e) {
    console.error("[api/assignments][POST] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}

/**
 * PUT /api/assignments
 * Body:
 *  - Single: { userId: string, programId: string, status: "not_started" | "in_progress" | "completed" }
 *  - Batch: { items: Array<{ userId: string, programId: string, status: "not_started" | "in_progress" | "completed" }> }
 * Cho phép Admin (hoặc Manager đối với nhân viên thuộc quyền) cập nhật tiến độ hoàn thành.
 */
export async function PUT(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isAdmin(me) && !isManager(me)) return bad("Forbidden", 403);

    const body = (await req.json().catch(() => ({}))) as {
      userId?: string;
      programId?: string;
      status?: "not_started" | "in_progress" | "completed";
      items?: Array<{
        userId: string;
        programId: string;
        status: "not_started" | "in_progress" | "completed";
      }>;
    };

    let itemsToUpdate: Array<{
      userId: string;
      programId: string;
      status: "not_started" | "in_progress" | "completed";
    }> = [];

    if (Array.isArray(body.items) && body.items.length > 0) {
      itemsToUpdate = body.items;
    } else if (body.userId && body.programId && body.status) {
      itemsToUpdate = [
        {
          userId: body.userId,
          programId: body.programId,
          status: body.status,
        },
      ];
    } else {
      return bad("Thiếu thông tin cập nhật (userId, programId, status hoặc items)");
    }

    // Manager validation: kiểm tra nhân viên thuộc quyền
    if (!isAdmin(me)) {
      const usersSnap = await adminDb
        .collection("users")
        .where("managerId", "==", me.uid)
        .get();
      const managedUserIds = new Set(usersSnap.docs.map((d) => d.id));
      for (const item of itemsToUpdate) {
        if (!managedUserIds.has(item.userId)) {
          return bad(`Bạn không có quyền quản lý người dùng: ${item.userId}`, 403);
        }
      }
    }

    const validStatuses = ["not_started", "in_progress", "completed"];
    const updatedUsers = new Set<string>();

    for (const item of itemsToUpdate) {
      if (!validStatuses.includes(item.status)) continue;
      const docId = `${item.userId}_${item.programId}`;
      const assignRef = adminDb.collection("assignments").doc(docId);
      const progRef = adminDb.collection("progress").doc(docId);

      const assignSnap = await assignRef.get();
      if (!assignSnap.exists) {
        // Nếu chưa có assignment, tạo mới
        await assignRef.set({
          userId: item.userId,
          programId: item.programId,
          status: item.status,
          assignedAt: new Date(),
          assignedBy: me.uid,
          ...(item.status === "completed" ? { completedAt: new Date() } : {}),
          ...(item.status === "in_progress" ? { startedAt: new Date() } : {}),
        });
      } else {
        await assignRef.update({
          status: item.status,
          updatedAt: new Date(),
          ...(item.status === "completed" ? { completedAt: new Date() } : { completedAt: null }),
          ...(item.status === "in_progress" ? { startedAt: new Date() } : {}),
        });
      }

      await progRef.set(
        {
          userId: item.userId,
          programId: item.programId,
          status: item.status,
          updatedAt: new Date(),
          ...(item.status === "completed" ? { completedAt: new Date() } : { completedAt: null }),
          ...(item.status === "in_progress" ? { startedAt: new Date() } : {}),
        },
        { merge: true }
      );

      // Nếu trạng thái là completed: tự động cập nhật tất cả lessons của program thành completed
      if (item.status === "completed") {
        const lessonsSnap = await adminDb
          .collection("programs")
          .doc(item.programId)
          .collection("lessons")
          .get();

        if (!lessonsSnap.empty) {
          const batch = adminDb.batch();
          for (const lDoc of lessonsSnap.docs) {
            const lpRef = progRef.collection("lessons").doc(lDoc.id);
            batch.set(
              lpRef,
              {
                lessonStatus: "completed",
                updatedAt: new Date(),
                completedAt: new Date(),
              },
              { merge: true }
            );
          }
          await batch.commit();
        }
      } else if (item.status === "not_started") {
        // Reset lessons
        const lpSnap = await progRef.collection("lessons").get();
        if (!lpSnap.empty) {
          const batch = adminDb.batch();
          for (const lpDoc of lpSnap.docs) {
            batch.set(
              lpDoc.ref,
              {
                lessonStatus: "not_started",
                updatedAt: new Date(),
                completedAt: null,
              },
              { merge: true }
            );
          }
          await batch.commit();
        }
      }

      updatedUsers.add(item.userId);
    }

    if (updatedUsers.size > 0) {
      invalidateUsers(Array.from(updatedUsers));
    }

    return ok({ updatedCount: itemsToUpdate.length });
  } catch (e) {
    console.error("[api/assignments][PUT] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
