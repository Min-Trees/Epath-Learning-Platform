import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, isManager, isManagerOrAdmin, ok, bad } from "@/lib/api-auth";
import type {
  ProgramReportSummary,
  UserReportSummary,
} from "@/types/training";

/**
 * GET /api/reports/programs/:programId/progress
 *  - Admin: xem tất cả
 *  - Manager: chỉ xem chương trình của họ (chỉ thống kê NV thuộc quyền)
 *  Trả về tổng quan: tất cả user được gán + % hoàn thành.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ programId: string }> }) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isManagerOrAdmin(me)) return bad("Forbidden", 403);
    const { programId } = await ctx.params;

    const programSnap = await adminDb
      .collection("programs")
      .doc(programId)
      .get();
    if (!programSnap.exists) return bad("Program not found", 404);
    const programData = programSnap.data() as { title?: string; managerId?: string };
    const programTitle = programData.title ?? "(không tiêu đề)";

    // Manager: kiểm tra program thuộc quyền
    if (!isAdmin(me)) {
      if (programData.managerId !== me.uid) {
        return bad("Forbidden - bạn không có quyền xem báo cáo của chương trình này", 403);
      }
    }

    // Manager: lấy danh sách nhân viên thuộc quyền để filter
    let managedUserIds: Set<string> | null = null;
    if (!isAdmin(me) && isManager(me)) {
      const usersSnap = await adminDb
        .collection("users")
        .where("managerId", "==", me.uid)
        .get();
      managedUserIds = new Set(usersSnap.docs.map((d) => d.id));
    }

    // Lấy assignments và lessons song song
    const [assignsSnap, lessonsSnap] = await Promise.all([
      adminDb
        .collection("assignments")
        .where("programId", "==", programId)
        .get(),
      adminDb
        .collection("programs")
        .doc(programId)
        .collection("lessons")
        .get(),
    ]);
    const totalLessons = lessonsSnap.size;

    // Lọc các assignment liên quan (Manager: chỉ thống kê NV thuộc quyền)
    const relevantAssigns = assignsSnap.docs.filter((a) => {
      const aData = a.data() as { userId: string };
      return managedUserIds === null || managedUserIds.has(aData.userId);
    });

    // Batch fetch thông tin tất cả users liên quan trong 1 lần gọi
    const uniqueUserIds = Array.from(
      new Set(relevantAssigns.map((a) => (a.data() as { userId: string }).userId))
    );
    const userMap = new Map<string, { displayName?: string; email?: string }>();
    if (uniqueUserIds.length > 0) {
      const userRefs = uniqueUserIds.map((uid) =>
        adminDb.collection("users").doc(uid)
      );
      const userDocs = await adminDb.getAll(...userRefs);
      for (const u of userDocs) {
        if (u.exists) {
          userMap.set(
            u.id,
            u.data() as { displayName?: string; email?: string }
          );
        }
      }
    }

    let notStarted = 0;
    let inProgress = 0;
    let completed = 0;
    let totalScore = 0;
    let scoreCount = 0;
    const atRisk: ProgramReportSummary["atRiskUsers"] = [];

    // Xử lý song song tất cả assignments
    const results = await Promise.all(
      relevantAssigns.map(async (a) => {
        const aData = a.data() as { userId: string; status: string };
        const userData = userMap.get(aData.userId);

        let percent = 0;
        let userAvg = 0;
        let hasScore = false;

        if (aData.status === "not_started") {
          percent = 0;
        } else {
          // Tính % complete từ progress
          const progRef = adminDb
            .collection("progress")
            .doc(`${aData.userId}_${programId}`);
          const lpSnap = await progRef.collection("lessons").get();
          const done = lpSnap.docs.filter(
            (d) =>
              (d.data() as { lessonStatus?: string }).lessonStatus === "completed"
          ).length;
          percent =
            totalLessons > 0
              ? Math.round((done / totalLessons) * 100)
              : aData.status === "completed"
                ? 100
                : 0;

          // Tính điểm test trung bình
          const scores: number[] = [];
          for (const lp of lpSnap.docs) {
            const tr = (
              lp.data() as { testResult?: { score?: number; passed?: boolean } }
            ).testResult;
            if (tr && typeof tr.score === "number") scores.push(tr.score);
          }
          if (scores.length > 0) {
            userAvg = Math.round(
              scores.reduce((sum, b) => sum + b, 0) / scores.length
            );
            hasScore = true;
          }
        }

        return {
          userId: aData.userId,
          status: aData.status,
          percent,
          userAvg,
          hasScore,
          userData,
        };
      })
    );

    for (const r of results) {
      if (r.status === "not_started") notStarted++;
      else if (r.status === "in_progress") inProgress++;
      else if (r.status === "completed") completed++;

      if (r.hasScore) {
        totalScore += r.userAvg;
        scoreCount += 1;
      }

      if (r.status !== "completed" && r.percent < 50) {
        atRisk.push({
          userId: r.userId,
          displayName: r.userData?.displayName,
          email: r.userData?.email ?? "",
          status:
            (r.status as "not_started" | "in_progress" | "completed") ??
            "not_started",
          percent: r.percent,
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
