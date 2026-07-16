import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, ok, bad } from "@/lib/api-auth";
import type { UserReportSummary } from "@/types/training";

/**
 * GET /api/reports/users/:userId/progress
 *  Chỉ admin. Trả về tất cả chương trình được gán + chi tiết từng lesson.
 *  Employee có thể gọi với userId của chính mình.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    const { userId } = await ctx.params;
    if (!isAdmin(me) && userId !== me.uid) {
      return bad("Forbidden", 403);
    }

    const userSnap = await adminDb.collection("users").doc(userId).get();
    const userData = userSnap.data() as
      | { displayName?: string; email?: string }
      | undefined;
    if (!userSnap.exists) return bad("User not found", 404);

    const assignsSnap = await adminDb
      .collection("assignments")
      .where("userId", "==", userId)
      .get();

    let totalAssigned = 0;
    let completed = 0;
    let inProgress = 0;
    let notStarted = 0;
    let totalScore = 0;
    let scoreCount = 0;
    const programReports: UserReportSummary["programs"] = [];

    for (const a of assignsSnap.docs) {
      totalAssigned++;
      const aData = a.data() as { programId: string; status: string };
      if (aData.status === "completed") completed++;
      else if (aData.status === "in_progress") inProgress++;
      else notStarted++;

      const progRef = adminDb.collection("programs").doc(aData.programId);
      const progSnap = await progRef.get();
      const programTitle = (progSnap.data() as { title?: string })?.title ?? "(không tiêu đề)";
      const lessonsSnap = await progRef.collection("lessons").orderBy("order").get();

      const lpRef = adminDb
        .collection("progress")
        .doc(`${userId}_${aData.programId}`);
      const lpSnap = await lpRef.collection("lessons").get();
      const lpMap = new Map(
        lpSnap.docs.map((d) => [d.id, d.data() as { lessonStatus?: string; testResult?: { score?: number; passed?: boolean; attemptCount?: number } }])
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
      if (programScores.length > 0) {
        totalScore += programAvg;
        scoreCount += 1;
      }

      const completedCount = lessons.filter(
        (l) => l.lessonStatus === "completed"
      ).length;
      const percent =
        lessons.length > 0
          ? Math.round((completedCount / lessons.length) * 100)
          : 0;

      programReports.push({
        programId: aData.programId,
        programTitle,
        status: aData.status as "not_started" | "in_progress" | "completed",
        percent,
        averageTestScore: programAvg,
        lessons,
      });
    }

    const summary: UserReportSummary = {
      userId,
      displayName: userData?.displayName,
      email: userData?.email ?? "",
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
