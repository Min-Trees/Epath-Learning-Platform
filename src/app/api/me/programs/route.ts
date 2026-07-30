import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, ok, bad } from "@/lib/api-auth";

/**
 * GET /api/me/programs
 *  - Employee: lấy danh sách chương trình được gán + tóm tắt tiến độ
 *  - Admin: lấy tất cả (kèm role hint)
 */
export async function GET(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);

    let assignmentsSnap;
    if (isAdmin(me)) {
      assignmentsSnap = await adminDb
        .collection("assignments")
        .orderBy("assignedAt", "desc")
        .limit(500)
        .get();
    } else {
      assignmentsSnap = await adminDb
        .collection("assignments")
        .where("userId", "==", me.uid)
        .get();
    }

    const items: Array<{
      assignmentId: string;
      userId: string;
      programId: string;
      status: string;
      assignedAt: Date | null;
      program: { id: string; title: string; description: string; status: string; groupId?: string | null } | null;
      progress?: { totalLessons: number; completedLessons: number; percent: number };
    }> = [];

    for (const a of assignmentsSnap.docs) {
      const aData = a.data() as {
        userId: string;
        programId: string;
        status: string;
        assignedAt?: { toDate?: () => Date } | Date;
      };
      const progSnap = await adminDb
        .collection("programs")
        .doc(aData.programId)
        .get();
      
      // Employee: chỉ hiển thị chương trình đã publish
      // Admin: hiển thị tất cả
      const programData = progSnap.data() as { title?: string; description?: string; status?: string; groupId?: string | null } | undefined;
      const isPublished = programData?.status === "published";
      
      // Nếu là employee và chương trình chưa publish, bỏ qua
      if (!isAdmin(me) && !isPublished) continue;

      const program = progSnap.exists
        ? {
            id: progSnap.id,
            title: programData?.title ?? "",
            description: programData?.description ?? "",
            status: programData?.status ?? "draft",
            groupId: programData?.groupId ?? null,
          }
        : null;

      // Đếm lesson & progress cho assignment này
      let totalLessons = 0;
      let completedLessons = 0;
      if (progSnap.exists) {
        const lessonsSnap = await progSnap.ref
          .collection("lessons")
          .get();
        totalLessons = lessonsSnap.size;
        if (!isAdmin(me)) {
          const progDocRef = adminDb
            .collection("progress")
            .doc(`${aData.userId}_${aData.programId}`);
          const lpSnap = await progDocRef.collection("lessons").get();
          completedLessons = lpSnap.docs.filter(
            (d) => (d.data() as { lessonStatus?: string }).lessonStatus === "completed"
          ).length;
        }
      }
      const percent =
        totalLessons > 0
          ? Math.round((completedLessons / totalLessons) * 100)
          : 0;

      items.push({
        assignmentId: a.id,
        userId: aData.userId,
        programId: aData.programId,
        status: aData.status,
        assignedAt:
          aData.assignedAt instanceof Date
            ? aData.assignedAt
            : (aData.assignedAt as { toDate?: () => Date } | undefined)?.toDate?.() ??
              null,
        program,
        progress: { totalLessons, completedLessons, percent },
      });
    }

    // Fetch ALL program groups for grouping (không lọc theo role)
    const groupsSnap = await adminDb
      .collection("programGroups")
      .orderBy("order", "asc")
      .get();
    const groups = groupsSnap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, name: data.name, order: data.order ?? 0 };
    });

    return ok({ items, groups });
  } catch (e) {
    console.error("[api/me/programs][GET] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
