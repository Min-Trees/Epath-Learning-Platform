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
    if (!isManagerOrAdmin(me) && me.role !== "hr") {
      return bad("Forbidden - chỉ admin, quản lý hoặc HR mới có quyền", 403);
    }

    const { searchParams } = new URL(req.url);
    const department = searchParams.get("department") || undefined;

    // Quyết định scope:
    // - manager: bắt buộc chỉ thấy NV thuộc quyền quản lý trực tiếp (managerId === me.uid)
    // - admin / HR: mặc định thấy tất cả; có thể ?scope=managed để giới hạn về NV do mình quản lý
    let targetUserIds: string[] | null = null;
    if (isAdmin(me) || me.role === "hr") {
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

    // Batch fetch assignments
    const assignsByUserId = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();
    if (targetUserIds !== null) {
      const batches: string[][] = [];
      for (let i = 0; i < targetUserIds.length; i += 30) {
        batches.push(targetUserIds.slice(i, i + 30));
      }
      const assignDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
      await Promise.all(
        batches.map(async (batch) => {
          const s = await adminDb
            .collection("assignments")
            .where("userId", "in", batch)
            .get();
          assignDocs.push(...s.docs);
        })
      );
      for (const doc of assignDocs) {
        const uid = (doc.data() as { userId?: string }).userId;
        if (!uid) continue;
        const list = assignsByUserId.get(uid) || [];
        list.push(doc);
        assignsByUserId.set(uid, list);
      }
    } else {
      const allAssignsSnap = await adminDb.collection("assignments").get();
      for (const doc of allAssignsSnap.docs) {
        const uid = (doc.data() as { userId?: string }).userId;
        if (!uid) continue;
        const list = assignsByUserId.get(uid) || [];
        list.push(doc);
        assignsByUserId.set(uid, list);
      }
    }

    // Program lessons cache (tránh query lặp đi lặp lại cùng 1 chương trình qua mạng)
    const programLessonsCache = new Map<
      string,
      Promise<{ totalLessons: number; validLessonIds: Set<string> }>
    >();

    function getProgramLessons(programId: string) {
      let p = programLessonsCache.get(programId);
      if (!p) {
        p = (async () => {
          const snap = await adminDb
            .collection("programs")
            .doc(programId)
            .collection("lessons")
            .get();
          return {
            totalLessons: snap.size,
            validLessonIds: new Set(snap.docs.map((d) => d.id)),
          };
        })();
        programLessonsCache.set(programId, p);
      }
      return p;
    }

    const userDocsToProcess = usersSnap.docs.filter((userDoc) => {
      const uData = userDoc.data() as { department?: string };
      return !department || uData.department === department;
    });

    const members: TeamMemberProgress[] = await Promise.all(
      userDocsToProcess.map(async (userDoc) => {
        const uData = userDoc.data() as {
          displayName?: string;
          email?: string;
          department?: string;
          managerId?: string;
        };
        const userId = userDoc.id;
        const userAssigns = assignsByUserId.get(userId) || [];

        const assignResults = await Promise.all(
          userAssigns.map(async (a) => {
            const aData = a.data() as {
              status: string;
              programId: string;
              updatedAt?: unknown;
              startedAt?: unknown;
              completedAt?: unknown;
              assignedAt?: unknown;
            };

            let activityAt: Date | null = null;
            // Activity date từ assignment
            for (const field of [
              aData.updatedAt,
              aData.startedAt,
              aData.completedAt,
              aData.assignedAt,
            ]) {
              const d = normalizeDate(field);
              if (d && (!activityAt || d > activityAt)) {
                activityAt = d;
              }
            }

            const { totalLessons, validLessonIds } = await getProgramLessons(
              aData.programId
            );

            // Nếu chưa bắt đầu, bỏ qua truy vấn progress doc và lessons subcollection
            if (aData.status === "not_started") {
              return {
                status: aData.status,
                percent: 0,
                avgScore: null,
                activityAt,
              };
            }

            // Với in_progress hoặc completed, query progress doc & lessons subcollection song song
            const lpRef = adminDb
              .collection("progress")
              .doc(`${userId}_${aData.programId}`);
            const [lpProgSnap, lpSnap] = await Promise.all([
              lpRef.get(),
              lpRef.collection("lessons").get(),
            ]);

            const doneLessonIds = new Set(
              lpSnap.docs
                .filter(
                  (d) =>
                    (d.data() as { lessonStatus?: string }).lessonStatus ===
                    "completed"
                )
                .map((d) => d.id)
            );

            let doneLessons = 0;
            for (const id of doneLessonIds) {
              if (validLessonIds.has(id)) doneLessons++;
            }

            const programPercent =
              totalLessons > 0
                ? Math.round((doneLessons / totalLessons) * 100)
                : aData.status === "completed"
                  ? 100
                  : 0;

            let progScoreSum = 0;
            let progScoreCount = 0;
            for (const lp of lpSnap.docs) {
              if (!validLessonIds.has(lp.id)) continue;
              const d = lp.data() as {
                lessonStatus?: string;
                testResult?: { score?: number };
                updatedAt?: unknown;
              };
              if (typeof d.testResult?.score === "number") {
                progScoreSum += d.testResult.score;
                progScoreCount++;
              }
              const tsDate = normalizeDate(d.updatedAt);
              if (tsDate && (!activityAt || tsDate > activityAt)) {
                activityAt = tsDate;
              }
            }

            const progData = lpProgSnap.data() as
              | { updatedAt?: unknown }
              | undefined;
            const progTsDate = normalizeDate(progData?.updatedAt);
            if (progTsDate && (!activityAt || progTsDate > activityAt)) {
              activityAt = progTsDate;
            }

            return {
              status: aData.status,
              percent: programPercent,
              avgScore:
                progScoreCount > 0
                  ? Math.round(progScoreSum / progScoreCount)
                  : null,
              activityAt,
            };
          })
        );

        let userCompleted = 0;
        let userInProgress = 0;
        let userNotStarted = 0;
        const percents: number[] = [];
        const userScores: number[] = [];
        let lastActivityAt: Date | null = null;

        for (const r of assignResults) {
          if (r.status === "completed") userCompleted++;
          else if (r.status === "in_progress") userInProgress++;
          else userNotStarted++;

          percents.push(r.percent);
          if (typeof r.avgScore === "number") userScores.push(r.avgScore);
          if (r.activityAt && (!lastActivityAt || r.activityAt > lastActivityAt)) {
            lastActivityAt = r.activityAt;
          }
        }

        const overallPercent =
          percents.length > 0
            ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length)
            : 0;
        const userAvg =
          userScores.length > 0
            ? Math.round(
                userScores.reduce((a, b) => a + b, 0) / userScores.length
              )
            : 0;
        const userTotalAssigned = userAssigns.length;

        return {
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
          lastActivityAt: lastActivityAt ? lastActivityAt.toISOString() : null,
        };
      })
    );

    let totalAssigned = 0;
    let totalCompleted = 0;
    let totalInProgress = 0;
    let totalNotStarted = 0;
    let scoreSum = 0;
    let scoreCount = 0;

    for (const m of members) {
      totalAssigned += m.totalAssigned;
      totalCompleted += m.completed;
      totalInProgress += m.inProgress;
      totalNotStarted += m.notStarted;
      if (m.averageTestScore > 0) {
        scoreSum += m.averageTestScore;
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
