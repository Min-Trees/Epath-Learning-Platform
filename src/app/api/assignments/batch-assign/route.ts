import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, isManager, ok, bad } from "@/lib/api-auth";

/**
 * POST /api/assignments/batch
 * Body: { userId: string, programIds: string[] }
 * - Admin: gán cho bất kỳ user nào
 * - Manager: chỉ gán cho nhân viên thuộc quyền và program của họ
 * Trả về: { created: string[], skipped: string[] }
 */
export async function POST(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isAdmin(me) && !isManager(me)) return bad("Forbidden", 403);

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

    // Manager: chỉ gán được cho nhân viên thuộc quyền
    if (!isAdmin(me)) {
      const userData = userSnap.data() as { managerId?: string };
      if (userData.managerId !== me.uid) {
        return bad("Forbidden - bạn không có quyền gán cho nhân viên này", 403);
      }
    }

    // Check all programs exist & published (và thuộc quyền nếu là manager)
    const validProgramIds: string[] = [];
    for (const programId of body.programIds) {
      const progSnap = await adminDb.collection("programs").doc(programId).get();
      if (!progSnap.exists) continue;
      const progData = progSnap.data() as { status?: string; assignedManagers?: string[] };
      if (progData.status !== "published") continue;
      // Manager: chỉ gán được program được gán cho họ qua assignedManagers
      if (!isAdmin(me) && (!progData.assignedManagers || !progData.assignedManagers.includes(me.uid))) continue;
      validProgramIds.push(programId);
    }

    if (validProgramIds.length === 0) {
      // Kiểm tra lý do không có program hợp lệ
      const reasons: string[] = [];
      for (const programId of body.programIds) {
        const progSnap = await adminDb.collection("programs").doc(programId).get();
        if (!progSnap.exists) {
          reasons.push(`Program "${programId}" không tồn tại`);
          continue;
        }
        const progData = progSnap.data() as { status?: string; assignedManagers?: string[]; title?: string };
        if (progData.status !== "published") {
          reasons.push(`"${progData.title || programId}" chưa được publish (trạng thái: ${progData.status})`);
        }
        if (!isAdmin(me) && (!progData.assignedManagers || !progData.assignedManagers.includes(me.uid))) {
          reasons.push(`"${progData.title || programId}" không thuộc quyền quản lý của bạn`);
        }
      }
      const detailMessage = reasons.length > 0 ? `: ${reasons.join("; ")}` : "";
      return bad("Không có chương trình nào hợp lệ (đã published và thuộc quyền)" + detailMessage, 400);
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
