import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, isManager, isManagerOrAdmin, ok, bad } from "@/lib/api-auth";

interface TestResult {
  id: string;
  progressId: string;
  userId: string;
  displayName?: string;
  email: string;
  programId: string;
  programTitle: string;
  lessonId: string;
  lessonTitle: string;
  score: number;
  passed: boolean;
  attemptCount: number;
  completedAt: string;
}

/**
 * GET /api/admin/tests/results
 *  - Admin: trả về danh sách tất cả kết quả test
 *  - Manager: chỉ trả về kết quả test của nhân viên thuộc quyền
 *  - Query params:
 *    - programId: lọc theo chương trình
 *    - userId: lọc theo user
 */
export async function GET(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isManagerOrAdmin(me)) return bad("Forbidden", 403);

    const { searchParams } = new URL(req.url);
    const filterProgramId = searchParams.get("programId");
    const filterUserId = searchParams.get("userId");

    // Lấy danh sách userId được phép xem (manager chỉ xem NV thuộc quyền)
    let allowedUserIds: Set<string> | null = null;
    if (isManager(me) && !isAdmin(me)) {
      const usersSnap = await adminDb
        .collection("users")
        .where("managerId", "==", me.uid)
        .get();
      allowedUserIds = new Set(usersSnap.docs.map((d) => d.id));
    }

    const progressSnap = await adminDb.collection("progress").get();
    const results: TestResult[] = [];

    for (const progressDoc of progressSnap.docs) {
      const progressData = progressDoc.data();
      const userId = progressData.userId as string;
      const programId = progressData.programId as string;

      // Manager: skip nếu user không thuộc quyền
      if (allowedUserIds !== null && !allowedUserIds.has(userId)) continue;

      // Apply filters
      if (filterProgramId && filterProgramId !== programId) continue;
      if (filterUserId && filterUserId !== userId) continue;

      // Get program title
      let programTitle = "Chương trình đã xóa";
      try {
        const programDoc = await adminDb.collection("programs").doc(programId).get();
        if (programDoc.exists) {
          const data = programDoc.data();
          programTitle = (data?.title as string) || programTitle;
        }
      } catch {
        // Program might not exist
      }

      // Get user info
      let displayName: string | undefined;
      let email = userId;
      try {
        const userDoc = await adminDb.collection("users").doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData) {
            displayName = userData.displayName as string | undefined;
            email = (userData.email as string) || email;
          }
        }
      } catch {
        // User might not exist
      }

      // Get lessons progress
      const lessonsSnap = await adminDb
        .collection("progress")
        .doc(progressDoc.id)
        .collection("lessons")
        .get();

      for (const lessonDoc of lessonsSnap.docs) {
        const lessonData = lessonDoc.data();
        const testResult = lessonData.testResult as {
          score: number;
          passed: boolean;
          attemptCount: number;
          lastAttemptAt?: { toDate: () => Date };
        } | undefined;

        if (!testResult) continue;

        // Get lesson title
        let lessonTitle = "Bài học đã xóa";
        try {
          const lessonDocRef = await adminDb
            .collection("programs")
            .doc(programId)
            .collection("lessons")
            .doc(lessonDoc.id)
            .get();
          if (lessonDocRef.exists) {
            const data = lessonDocRef.data();
            lessonTitle = (data?.title as string) || lessonTitle;
          }
        } catch {
          // Lesson might not exist
        }

        results.push({
          id: `${progressDoc.id}_${lessonDoc.id}`,
          progressId: progressDoc.id,
          userId,
          displayName,
          email,
          programId,
          programTitle,
          lessonId: lessonDoc.id,
          lessonTitle,
          score: testResult.score,
          passed: testResult.passed,
          attemptCount: testResult.attemptCount,
          completedAt: testResult.lastAttemptAt
            ? testResult.lastAttemptAt.toDate().toISOString()
            : new Date().toISOString(),
        });
      }
    }

    // Sort by completedAt descending
    results.sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );

    return ok({ results });
  } catch (e) {
    console.error("[api/admin/tests/results][GET] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
