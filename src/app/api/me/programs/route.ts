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
      program: { id: string; title: string; description: string; status: string } | null;
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
      const program = progSnap.exists
        ? {
            id: progSnap.id,
            title: (progSnap.data() as { title?: string }).title ?? "",
            description:
              (progSnap.data() as { description?: string }).description ?? "",
            status: (progSnap.data() as { status?: string }).status ?? "draft",
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
    return ok({ items });
  } catch (e) {
    console.error("[api/me/programs][GET] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
