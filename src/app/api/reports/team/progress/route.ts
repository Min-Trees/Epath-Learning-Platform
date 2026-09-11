import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import {
  getAuthUser,
  isAdmin,
  isManagerOrAdmin,
  ok,
  bad,
} from "@/lib/api-auth";
import type { TeamMemberProgress, TeamReportSummary } from "@/types/training";

/**
 * GET /api/reports/team/progress
 *  - Manager: tổng quan tiến độ của các nhân viên thuộc quyền (managerId === me.uid)
 *  - Admin: mặc định lấy tất cả employee trong hệ thống
 *  Query:
 *    - scope: "managed" (mặc định cho manager) hoặc "all" (chỉ admin)
 *    - department: lọc theo phòng ban (optional)
 *
 * Trả về: tổng quan team + danh sách nhân viên kèm tiến độ học tập.
 */
export async function GET(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isManagerOrAdmin(me)) {
      return bad("Forbidden - chỉ admin hoặc manager mới có quyền", 403);
    }

    const { searchParams } = new URL(req.url);
    const department = searchParams.get("department") || undefined;

    // Quyết định scope:
    // - manager mặc định chỉ thấy NV thuộc quyền (managerId == me.uid)
    // - admin mặc định thấy tất cả; có thể ?scope=managed để giới hạn về NV do mình quản lý
    let targetUserIds: string[] | null = null;
    if (isAdmin(me)) {
      if (searchParams.get("scope") === "managed") {
        const snap = await adminDb
          .collection("users")
          .where("managerId", "==", me.uid)
          .get();
        targetUserIds = snap.docs.map((d) => d.id);
      }
    } else {
      // Manager: bắt buộc chỉ lấy NV thuộc quyền
      const snap = await adminDb
        .collection("users")
        .where("managerId", "==", me.uid)
        .get();
      targetUserIds = snap.docs.map((d) => d.id);
    }

    // Query users
    let usersSnap;
    if (targetUserIds !== null) {
      if (targetUserIds.length === 0) {
        return ok({
          managerId: me.uid,
          totalEmployees: 0,
          totalAssigned: 0,
          completed: 0,
          inProgress: 0,
          notStarted: 0,
          completionRate: 0,
          averageTestScore: 0,
          members: [],
        } satisfies TeamReportSummary);
      }
      // Firestore `in` giới hạn 30 ids/lần — chia batch nếu cần
      const batches: string[][] = [];
      for (let i = 0; i < targetUserIds.length; i += 30) {
        batches.push(targetUserIds.slice(i, i + 30));
      }
      const allDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
      for (const batch of batches) {
        const s = await adminDb
          .collection("users")
          .where("__name__", "in", batch)
          .get();
        allDocs.push(...s.docs);
      }
      usersSnap = { docs: allDocs, size: allDocs.length, empty: allDocs.length === 0 };
    } else {
      // Admin "all": lấy toàn bộ user active (không filter role để giữ đơn giản)
      usersSnap = await adminDb.collection("users").get();
    }

    const members: TeamMemberProgress[] = [];
    let totalAssigned = 0;
    let totalCompleted = 0;
    let totalInProgress = 0;
    let totalNotStarted = 0;
    let scoreSum = 0;
    let scoreCount = 0;

    for (const userDoc of usersSnap.docs) {
      const uData = userDoc.data() as {
        displayName?: string;
        email?: string;
        department?: string;
        managerId?: string;
      };
      if (department && uData.department !== department) continue;

      const userId = userDoc.id;
      const assignsSnap = await adminDb
        .collection("assignments")
        .where("userId", "==", userId)
        .get();

      let userCompleted = 0;
      let userInProgress = 0;
      let userNotStarted = 0;
      const percents: number[] = [];
      const userScores: number[] = [];
      let lastActivityAt: Date | null = null;

      for (const a of assignsSnap.docs) {
        const aData = a.data() as { status: string; programId: string };
        if (aData.status === "completed") userCompleted++;
        else if (aData.status === "in_progress") userInProgress++;
        else userNotStarted++;

        // Tính % completed của chương trình
        const lpRef = adminDb
          .collection("progress")
          .doc(`${userId}_${aData.programId}`);
        const [lpProgSnap, lessonsSnap] = await Promise.all([
          lpRef.get(),
          adminDb
            .collection("programs")
            .doc(aData.programId)
            .collection("lessons")
            .get(),
        ]);
        const totalLessons = lessonsSnap.size;
        const lpSnap = await lpRef.collection("lessons").get();
        const doneLessons = lpSnap.docs.filter(
          (d) =>
            (d.data() as { lessonStatus?: string }).lessonStatus === "completed"
        ).length;
        if (totalLessons > 0) {
          percents.push(Math.round((doneLessons / totalLessons) * 100));
        }

        // Điểm test trung bình + last activity
        let progScoreSum = 0;
        let progScoreCount = 0;
        for (const lp of lpSnap.docs) {
          const d = lp.data() as {
            lessonStatus?: string;
            testResult?: { score?: number };
            updatedAt?: { toDate?: () => Date } | Date | null;
          };
          if (typeof d.testResult?.score === "number") {
            progScoreSum += d.testResult.score;
            progScoreCount++;
          }
          const ts = d.updatedAt;
          const tsDate =
            ts && typeof (ts as { toDate?: () => Date }).toDate === "function"
              ? (ts as { toDate: () => Date }).toDate()
              : ts instanceof Date
                ? ts
                : null;
          if (tsDate && (!lastActivityAt || tsDate > lastActivityAt)) {
            lastActivityAt = tsDate;
          }
        }
        if (progScoreCount > 0) {
          userScores.push(Math.round(progScoreSum / progScoreCount));
        }

        // updatedAt của progress doc
        const progData = lpProgSnap.data() as
          | { updatedAt?: { toDate?: () => Date } | Date | null }
          | undefined;
        const progTs = progData?.updatedAt;
        const progTsDate =
          progTs &&
          typeof (progTs as { toDate?: () => Date }).toDate === "function"
            ? (progTs as { toDate: () => Date }).toDate()
            : progTs instanceof Date
              ? progTs
              : null;
        if (progTsDate && (!lastActivityAt || progTsDate > lastActivityAt)) {
          lastActivityAt = progTsDate;
        }
      }

      const overallPercent =
        percents.length > 0
          ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length)
          : 0;
      const userAvg =
        userScores.length > 0
          ? Math.round(userScores.reduce((a, b) => a + b, 0) / userScores.length)
          : 0;
      const userTotalAssigned = assignsSnap.size;

      members.push({
        userId,
        displayName: uData.displayName,
        email: uData.email ?? "",
        department: uData.department,
        totalAssigned: userTotalAssigned,
        completed: userCompleted,
        inProgress: userInProgress,
        notStarted: userNotStarted,
        overallPercent,
        averageTestScore: userAvg,
        lastActivityAt,
      });

      totalAssigned += userTotalAssigned;
      totalCompleted += userCompleted;
      totalInProgress += userInProgress;
      totalNotStarted += userNotStarted;
      if (userScores.length > 0) {
        scoreSum += userAvg;
        scoreCount++;
      }
    }

    // Sắp xếp: cần nhắc nhở trước (overallPercent thấp + chưa hoàn thành) → theo email
    members.sort((a, b) => {
      if (a.overallPercent !== b.overallPercent)
        return a.overallPercent - b.overallPercent;
      return (a.email || "").localeCompare(b.email || "");
    });

    const summary: TeamReportSummary = {
      managerId: me.uid,
      totalEmployees: members.length,
      totalAssigned,
      completed: totalCompleted,
      inProgress: totalInProgress,
      notStarted: totalNotStarted,
      completionRate:
        totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0,
      averageTestScore:
        scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 0,
      members,
    };
    return ok(summary);
  } catch (e) {
    console.error("[api/reports/team/progress][GET] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
