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
 * Chuẩn hóa nhiều kiểu dữ liệu ngày về Date (Firestore Timestamp có .toDate(),
 * ISO string, number, Date object).
 */
function normalizeDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "object") {
    const toDate = (value as { toDate?: () => Date }).toDate;
    if (typeof toDate === "function") {
      try {
        const d = toDate.call(value);
        return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
      } catch {
        return null;
      }
    }
    const seconds = (value as { _seconds?: number; seconds?: number })._seconds
      ?? (value as { seconds?: number }).seconds;
    if (typeof seconds === "number") return new Date(seconds * 1000);
    return null;
  }
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

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

        // Tính % completed của chương trình (theo số lesson đã hoàn thành)
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

        // Đếm lesson đã completed — KHÔNG tính những lesson chưa tồn tại trong progress
        // (chỉ lesson mà user thực sự đã tương tác mới có record)
        const doneLessonIds = new Set(
          lpSnap.docs
            .filter(
              (d) =>
                (d.data() as { lessonStatus?: string }).lessonStatus ===
                "completed"
            )
            .map((d) => d.id)
        );
        // Đảm bảo chỉ tính những lesson thực sự thuộc chương trình
        const validLessonIds = new Set(lessonsSnap.docs.map((l) => l.id));
        let doneLessons = 0;
        for (const id of doneLessonIds) {
          if (validLessonIds.has(id)) doneLessons++;
        }

        // Mọi assignment đều phải được tính vào % tổng (kể cả chưa có lesson / chưa bắt đầu)
        const programPercent =
          totalLessons > 0
            ? Math.round((doneLessons / totalLessons) * 100)
            : aData.status === "completed"
              ? 100
              : 0;
        percents.push(programPercent);

        // Điểm test trung bình + last activity (chỉ tính test result của lesson thuộc chương trình)
        let progScoreSum = 0;
        let progScoreCount = 0;
        for (const lp of lpSnap.docs) {
          if (!validLessonIds.has(lp.id)) continue;
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
          const tsDate = normalizeDate(ts);
          if (tsDate && (!lastActivityAt || tsDate > lastActivityAt)) {
            lastActivityAt = tsDate;
          }
        }
        if (progScoreCount > 0) {
          userScores.push(Math.round(progScoreSum / progScoreCount));
        }

        // updatedAt của progress doc (cập nhật gần nhất của chương trình)
        const progData = lpProgSnap.data() as
          | { updatedAt?: { toDate?: () => Date } | Date | null }
          | undefined;
        const progTsDate = normalizeDate(progData?.updatedAt);
        if (progTsDate && (!lastActivityAt || progTsDate > lastActivityAt)) {
          lastActivityAt = progTsDate;
        }

        // Còn tính lastActivity từ assignment.updatedAt / startedAt / completedAt
        const progAssignments = a as { data(): unknown };
        const aFull = progAssignments.data() as {
          updatedAt?: unknown;
          startedAt?: unknown;
          completedAt?: unknown;
          assignedAt?: unknown;
        };
        for (const field of [
          aFull.updatedAt,
          aFull.startedAt,
          aFull.completedAt,
          aFull.assignedAt,
        ]) {
          const d = normalizeDate(field);
          if (d && (!lastActivityAt || d > lastActivityAt)) {
            lastActivityAt = d;
          }
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
        // Trả về ISO string để JSON serialize an toàn (Date không serialize qua JSON)
        lastActivityAt: lastActivityAt ? lastActivityAt.toISOString() : null,
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
