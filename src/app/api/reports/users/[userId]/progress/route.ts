import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, isManager, ok, bad } from "@/lib/api-auth";
import type { UserReportSummary } from "@/types/training";

/**
 * GET /api/reports/users/:userId/progress
 *  - Admin: xem bất kỳ user
 *  - Manager: chỉ xem nhân viên thuộc quyền
 *  - Employee: chỉ xem của chính mình
 *  Trả về tất cả chương trình được gán + chi tiết từng lesson.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    const { userId } = await ctx.params;
    if (!isAdmin(me) && me.role !== "hr" && userId !== me.uid) {
      // Manager: bắt buộc chỉ xem nhân viên thuộc quyền quản lý của mình
      if (isManager(me)) {
        const targetUserSnap = await adminDb.collection("users").doc(userId).get();
        if (!targetUserSnap.exists) return bad("User not found", 404);
        const targetUserData = targetUserSnap.data() as { managerId?: string };
        if (targetUserData.managerId !== me.uid) {
          return bad("Forbidden - bạn chỉ có quyền xem tiến độ của nhân viên thuộc sự quản lý của mình", 403);
        }
      } else {
        return bad("Forbidden - bạn không có quyền xem báo cáo của nhân viên này", 403);
      }
    }

    const userSnap = await adminDb.collection("users").doc(userId).get();
    if (!userSnap.exists) return bad("User not found", 404);
    const userData = userSnap.data() as
      | { displayName?: string; email?: string; department?: string; position?: string; managerId?: string }
      | undefined;

    let managerName: string | undefined = undefined;
    if (userData?.managerId) {
      try {
        const mgrSnap = await adminDb.collection("users").doc(userData.managerId).get();
        if (mgrSnap.exists) {
          const mgrData = mgrSnap.data() as { displayName?: string; email?: string };
          managerName = mgrData.displayName || mgrData.email;
        }
      } catch {
        // ignore
      }
    }

    const assignsSnap = await adminDb
      .collection("assignments")
      .where("userId", "==", userId)
      .get();

    let totalAssigned = assignsSnap.size;
    let completed = 0;
    let inProgress = 0;
    let notStarted = 0;
    let totalScore = 0;
    let scoreCount = 0;

    const programReports = await Promise.all(
      assignsSnap.docs.map(async (a) => {
        const aData = a.data() as { programId: string; status: string };
        const progRef = adminDb.collection("programs").doc(aData.programId);
        const lpRef = adminDb
          .collection("progress")
          .doc(`${userId}_${aData.programId}`);

        const [progSnap, lessonsSnap, lpSnap] = await Promise.all([
          progRef.get(),
          progRef.collection("lessons").orderBy("order").get(),
          lpRef.collection("lessons").get(),
        ]);

        const programTitle =
          (progSnap.data() as { title?: string })?.title ?? "(không tiêu đề)";
        const lpMap = new Map(
          lpSnap.docs.map((d) => [
            d.id,
            d.data() as {
              lessonStatus?: string;
              testResult?: { score?: number; passed?: boolean; attemptCount?: number };
            },
          ])
        );

        const programScores: number[] = [];
        const lessons = lessonsSnap.docs.map((l) => {
          const lp = lpMap.get(l.id);
          const tr = lp?.testResult;
          if (tr && typeof tr.score === "number") programScores.push(tr.score);
          return {
            lessonId: l.id,
            title: (l.data() as { title?: string }).title ?? "(không tiêu đề)",
            order: (l.data() as { order?: number }).order ?? 0,
            lessonStatus:
              (lp?.lessonStatus as "not_started" | "in_progress" | "completed") ??
              "not_started",
            testPassed: tr?.passed,
            testScore: tr?.score,
            attemptCount: tr?.attemptCount,
          };
        });

        const programAvg =
          programScores.length > 0
            ? Math.round(
                programScores.reduce((a, b) => a + b, 0) / programScores.length
              )
            : 0;

        const completedCount = lessons.filter(
          (l) => l.lessonStatus === "completed"
        ).length;
        const percent =
          lessons.length > 0
            ? Math.round((completedCount / lessons.length) * 100)
            : aData.status === "completed"
              ? 100
              : 0;

        return {
          programId: aData.programId,
          programTitle,
          status: aData.status as "not_started" | "in_progress" | "completed",
          percent,
          averageTestScore: programAvg,
          lessons,
          hasScore: programScores.length > 0,
        };
      })
    );

    for (const pr of programReports) {
      if (pr.status === "completed") completed++;
      else if (pr.status === "in_progress") inProgress++;
      else notStarted++;

      if (pr.hasScore) {
        totalScore += pr.averageTestScore;
        scoreCount += 1;
      }
    }

    const summary: UserReportSummary = {
      userId,
      displayName: userData?.displayName,
      email: userData?.email ?? "",
      department: userData?.department,
      position: userData?.position,
      managerName,
      totalAssigned,
      completed,
      inProgress,
      notStarted,
      averageTestScore: scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0,
      programs: programReports,
    };
    return ok(summary);
  } catch (e) {
    console.error("[api/reports/users/:id/progress][GET] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
