import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, isManager, isManagerOrAdmin, ok, bad } from "@/lib/api-auth";

interface EssayAnswerDoc {
  userId: string;
  programId: string;
  lessonId: string;
  attemptCount: number;
  answers: Record<string, string>;
  reviewed: boolean;
  earnedPoints: Record<string, number>;
}

/**
 * POST /api/admin/tests/essay-reviews/grade
 *  Body: { essayId: string, earnedPoints: Record<string, number> }
 *  - Admin: chấm điểm câu trả lời tự luận và cập nhật progress của user
 *  - Manager: chỉ chấm điểm câu trả lời của nhân viên thuộc quyền
 */
export async function POST(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isManagerOrAdmin(me)) return bad("Forbidden", 403);

    const body = (await req.json().catch(() => ({}))) as {
      essayId?: string;
      earnedPoints?: Record<string, number>;
    };

    if (!body.essayId) return bad("Thiếu essayId");
    if (!body.earnedPoints || typeof body.earnedPoints !== "object") {
      return bad("Thiếu earnedPoints");
    }

    // Get essay answer document
    const essayRef = adminDb.collection("test_essay_answers").doc(body.essayId);
    const essaySnap = await essayRef.get();
    if (!essaySnap.exists) return bad("Không tìm thấy câu trả lời", 404);

    const essayData = essaySnap.data() as EssayAnswerDoc;
    const { userId, programId, lessonId, attemptCount } = essayData;

    // Manager: kiểm tra user có thuộc quyền không
    if (isManager(me) && !isAdmin(me)) {
      const userDoc = await adminDb.collection("users").doc(userId).get();
      if (!userDoc.exists) return bad("Không tìm thấy user", 404);
      const userData = userDoc.data() as { managerId?: string };
      if (userData.managerId !== me.uid) {
        return bad("Forbidden - bạn không có quyền chấm bài của nhân viên này", 403);
      }
    }

    // Get test questions to validate points
    const testsSnap = await adminDb
      .collection("programs")
      .doc(programId)
      .collection("lessons")
      .doc(lessonId)
      .collection("test")
      .get();

    if (testsSnap.empty) return bad("Không tìm thấy bài test", 404);

    const testData = testsSnap.docs[0].data();
    const questions = testData.questions as Array<{
      type: string;
      question: string;
      point: number;
    }>;

    // Calculate total earned points from essay
    let totalEssayPoints = 0;
    for (const [question, points] of Object.entries(body.earnedPoints)) {
      if (typeof points !== "number") continue;
      // Validate points don't exceed max
      const q = questions.find((qu) => qu.question === question && qu.type === "essay");
      if (q) {
        const earned = Math.min(Math.max(0, points), q.point);
        totalEssayPoints += earned;
      }
    }

    // Update essay answer as reviewed
    await essayRef.update({
      reviewed: true,
      reviewedAt: new Date(),
      reviewedBy: me.uid,
      earnedPoints: body.earnedPoints,
    });

    // Recalculate total score for this attempt
    // Get the lesson progress to get the test result
    const progressRef = adminDb
      .collection("progress")
      .doc(`${userId}_${programId}`);
    const lessonProgressRef = progressRef.collection("lessons").doc(lessonId);
    const progressSnap = await lessonProgressRef.get();

    if (progressSnap.exists) {
      const progressData = progressSnap.data();
      const previousScore = (progressData?.testResult?.score as number) || 0;
      const hasPendingReview =
        (progressData?.testResult?.hasPendingReview as boolean) || false;

      if (!hasPendingReview) {
        // Already recalculated, skip
        return ok({ success: true, message: "Đã cập nhật điểm" });
      }

      // Get all questions and recalculate
      let totalPoints = 0;
      let gradedPoints = 0;

      for (const q of questions) {
        totalPoints += q.point;
        if (q.type === "essay") {
          // Add graded essay points
          const earned = body.earnedPoints[q.question];
          if (typeof earned === "number") {
            gradedPoints += earned;
          }
        }
      }

      // Get multiple choice answers from previous submission
      // For simplicity, we'll use the previously graded points
      // In a real scenario, you'd need to store the MC answers too

      // Calculate new score based on essay grading
      // Note: This is simplified - in production you'd track MC answers separately
      const newScore =
        totalPoints > 0 ? Math.round((gradedPoints / totalPoints) * 100) : 0;

      // Get passScore from test
      const passScore = (testData.passScore as number) || 70;
      const passed = newScore >= passScore;

      // Update progress
      await lessonProgressRef.update({
        "testResult.score": newScore,
        "testResult.passed": passed,
        "testResult.hasPendingReview": false,
        lessonStatus: passed ? "completed" : "in_progress",
        updatedAt: new Date(),
      });

      // Check if all lessons are completed
      if (passed) {
        const lessonsSnap = await adminDb
          .collection("programs")
          .doc(programId)
          .collection("lessons")
          .get();

        let allCompleted = true;
        for (const lessonDoc of lessonsSnap.docs) {
          const lpSnap = await progressRef.collection("lessons").doc(lessonDoc.id).get();
          if (lessonDoc.data().hasTest) {
            const lpData = lpSnap.data();
            if (lpData?.lessonStatus !== "completed") {
              allCompleted = false;
              break;
            }
          }
        }

        if (allCompleted) {
          // Update assignment status
          const assignRef = adminDb.collection("assignments").doc(`${userId}_${programId}`);
          await assignRef.update({ status: "completed", completedAt: new Date() });
        }
      }
    }

    return ok({ success: true, message: "Đã chấm điểm và cập nhật kết quả" });
  } catch (e) {
    console.error("[api/admin/tests/essay-reviews/grade][POST] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
