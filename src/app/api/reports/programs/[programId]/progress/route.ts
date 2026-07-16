import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, ok, bad } from "@/lib/api-auth";
import type {
  ProgramReportSummary,
  UserReportSummary,
} from "@/types/training";

/**
 * GET /api/reports/programs/:programId/progress
 *  Chỉ admin. Trả về tổng quan: tất cả user được gán + % hoàn thành.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ programId: string }> }) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isAdmin(me)) return bad("Forbidden - chỉ admin", 403);
    const { programId } = await ctx.params;

    const programSnap = await adminDb
      .collection("programs")
      .doc(programId)
      .get();
    if (!programSnap.exists) return bad("Program not found", 404);
    const programData = programSnap.data() as { title?: string };
    const programTitle = programData.title ?? "(không tiêu đề)";

    // Lấy assignments
    const assignsSnap = await adminDb
      .collection("assignments")
      .where("programId", "==", programId)
      .get();
    // Lấy lessons
    const lessonsSnap = await adminDb
      .collection("programs")
      .doc(programId)
      .collection("lessons")
      .get();
    const totalLessons = lessonsSnap.size;

    let notStarted = 0;
    let inProgress = 0;
    let completed = 0;
    let totalScore = 0;
    let scoreCount = 0;
    const atRisk: ProgramReportSummary["atRiskUsers"] = [];

    for (const a of assignsSnap.docs) {
      const aData = a.data() as { userId: string; status: string };
      const userSnap = await adminDb
        .collection("users")
        .doc(aData.userId)
        .get();
      const userData = userSnap.data() as
        | { displayName?: string; email?: string }
        | undefined;

      // Tính % complete
      const progRef = adminDb
        .collection("progress")
        .doc(`${aData.userId}_${programId}`);
      const lpSnap = await progRef.collection("lessons").get();
      const done = lpSnap.docs.filter(
        (d) => (d.data() as { lessonStatus?: string }).lessonStatus === "completed"
      ).length;
      const percent = totalLessons > 0 ? Math.round((done / totalLessons) * 100) : 0;

      // Tính điểm test trung bình
      const scores: number[] = [];
      for (const lp of lpSnap.docs) {
        const tr = (lp.data() as { testResult?: { score?: number; passed?: boolean } })
          .testResult;
        if (tr && typeof tr.score === "number") scores.push(tr.score);
      }
      const userAvg = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;
      if (scores.length > 0) {
        totalScore += userAvg;
        scoreCount += 1;
      }

      if (aData.status === "not_started") notStarted++;
      else if (aData.status === "in_progress") inProgress++;
      else if (aData.status === "completed") completed++;

      if (aData.status !== "completed" && percent < 50) {
        atRisk.push({
          userId: aData.userId,
          displayName: userData?.displayName,
          email: userData?.email ?? "",
          status:
            (aData.status as "not_started" | "in_progress" | "completed") ??
            "not_started",
          percent,
        });
      }
    }

    const totalAssigned = assignsSnap.size;
    const completionRate =
      totalAssigned > 0 ? Math.round((completed / totalAssigned) * 100) : 0;
    const averageTestScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;

    const summary: ProgramReportSummary = {
      programId,
      programTitle,
      totalAssigned,
      notStarted,
      inProgress,
      completed,
      completionRate,
      averageTestScore,
      atRiskUsers: atRisk,
    };
    return ok(summary);
  } catch (e) {
    console.error("[api/reports/programs/:id/progress][GET] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
