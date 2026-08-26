import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, ok, bad } from "@/lib/api-auth";
import type { TestQuestion, QuestionGradingResult } from "@/types/training";

/**
 * POST /api/programs/:programId/lessons/:lessonId/test/submit
 *  Body: { answers: (number | string)[], includeDetails?: boolean }
 *  - answers: mảng đáp án theo thứ tự câu hỏi (number cho trắc nghiệm, string cho tự luận)
 *  - includeDetails: true để trả về chi tiết từng câu
 *  -> Chấm điểm, cập nhật progress, trả { score, passed, attemptCount }
 *
 *  Với câu tự luận:
 *  - Nếu có sampleAnswer: tự động so sánh (so khớp keywords đơn giản)
 *  - Nếu không có sampleAnswer: đánh dấu pendingReview, 0 điểm tạm thời
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ programId: string; lessonId: string }> }) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    const { programId, lessonId } = await ctx.params;

    // Phải có assignment
    const assignRef = adminDb.collection("assignments").doc(`${me.uid}_${programId}`);
    const assignSnap = await assignRef.get();
    if (!assignSnap.exists) return bad("Bạn chưa được gán chương trình này", 403);

    const body = (await req.json().catch(() => ({}))) as {
      answers?: (number | string)[];
      includeDetails?: boolean;
    };
    if (!Array.isArray(body.answers)) return bad("answers phải là mảng");

    const lessonRef = adminDb
      .collection("programs")
      .doc(programId)
      .collection("lessons")
      .doc(lessonId);
    const lessonSnap = await lessonRef.get();
    if (!lessonSnap.exists) return bad("Lesson not found", 404);
    if (!(lessonSnap.data() as { hasTest?: boolean } | undefined)?.hasTest) {
      return bad("Lesson chưa có bài test", 400);
    }
    const testsSnap = await lessonRef.collection("test").get();
    if (testsSnap.empty) return bad("Test chưa có câu hỏi", 400);
    const tDoc = testsSnap.docs[0];
    const tData = tDoc.data() as { questions: TestQuestion[]; passScore: number };
    const questions = tData.questions;

    // Chấm điểm
    let earned = 0;
    let total = 0;
    let hasPendingReview = false;
    const questionResults: QuestionGradingResult[] = [];

    questions.forEach((q, i) => {
      total += q.point;
      const userAnswer = body.answers![i];
      const isEssay = q.type === "essay";

      if (isEssay) {
        // Essay grading
        const essayQ = q;
        const userText = typeof userAnswer === "string" ? userAnswer.trim().toLowerCase() : "";
        let earnedPoint = 0;
        let isCorrect = false;
        let isPending = false;

        if (!userText) {
          // Chưa trả lời
          isPending = false;
          isCorrect = false;
        } else if (essayQ.sampleAnswer && essayQ.sampleAnswer.trim()) {
          // Có đáp án mẫu - so sánh keywords
          const sampleKeywords = essayQ.sampleAnswer
            .toLowerCase()
            .split(/[\s,.!?;:'"()]+/)
            .filter((k) => k.length >= 3);
          const userKeywords = userText.split(/[\s,.!?;:'"()]+/).filter((k) => k.length >= 3);

          // Đếm số keywords trùng khớp
          const matchedKeywords = sampleKeywords.filter((sk) =>
            userKeywords.some((uk) => uk.includes(sk) || sk.includes(uk))
          );
          const matchRatio = sampleKeywords.length > 0 ? matchedKeywords.length / sampleKeywords.length : 0;

          // Nếu match >= 50% -> full điểm, >= 30% -> 70% điểm, < 30% -> 0 điểm
          if (matchRatio >= 0.5) {
            earnedPoint = essayQ.point;
            isCorrect = true;
          } else if (matchRatio >= 0.3) {
            earnedPoint = Math.round(essayQ.point * 0.7);
            isCorrect = false; // Chưa đạt full điểm
          }
          // else: 0 điểm
        } else {
          // Không có đáp án mẫu -> cần admin check
          isPending = true;
          hasPendingReview = true;
          earnedPoint = 0;
          isCorrect = false;
        }

        earned += earnedPoint;
        questionResults.push({
          questionIndex: i,
          question: q.question,
          type: "essay",
          point: q.point,
          earnedPoint,
          isCorrect,
          userAnswerText: typeof userAnswer === "string" ? userAnswer : "",
          sampleAnswer: essayQ.sampleAnswer,
          isPendingReview: isPending,
        });
      } else {
        // Multiple choice grading
        const mcQ = q;
        const userAnswerIndex = typeof userAnswer === "number" ? userAnswer : -1;
        const isCorrect = userAnswerIndex === mcQ.correctIndex;
        const earnedPoint = isCorrect ? mcQ.point : 0;

        earned += earnedPoint;
        questionResults.push({
          questionIndex: i,
          question: q.question,
          type: "multiple_choice",
          point: q.point,
          earnedPoint,
          isCorrect,
          userAnswerIndex,
          correctIndex: mcQ.correctIndex,
        });
      }
    });

    // Tính điểm - chỉ tính trên phần đã chấm (không tính pending)
    const gradedTotal = hasPendingReview
      ? questions.filter((q, i) => {
          const result = questionResults[i];
          return !result.isPendingReview;
        }).reduce((sum, q) => sum + q.point, 0)
      : total;

    const gradedEarned = hasPendingReview
      ? questionResults.filter((r) => !r.isPendingReview).reduce((sum, r) => sum + r.earnedPoint, 0)
      : earned;

    const score = gradedTotal > 0 ? Math.round((gradedEarned / gradedTotal) * 100) : 0;

    // Với pending review, không thể pass được (cần admin check)
    const passed = !hasPendingReview && score >= tData.passScore;

    // Cập nhật progress (per user + program + lesson)
    const progRef = adminDb
      .collection("progress")
      .doc(`${me.uid}_${programId}`);
    const lessonProgRef = progRef.collection("lessons").doc(lessonId);
    const lpSnap = await lessonProgRef.get();
    const prevAttempt =
      (lpSnap.data() as { testResult?: { attemptCount?: number } } | undefined)
        ?.testResult?.attemptCount ?? 0;
    const attemptCount = prevAttempt + 1;

    await progRef.set(
      {
        userId: me.uid,
        programId,
        updatedAt: new Date(),
        ...(assignSnap.data() as { status?: string } | undefined)?.status ===
          "not_started"
          ? { status: "in_progress", startedAt: new Date() }
          : {},
      },
      { merge: true }
    );

    await lessonProgRef.set(
      {
        lessonStatus: passed ? "completed" : "in_progress",
        testResult: {
          score,
          passed,
          attemptCount,
          lastAttemptAt: new Date(),
          hasPendingReview,
        },
        updatedAt: new Date(),
      },
      { merge: true }
    );

    // Lưu câu trả lời tự luận để admin review sau
    if (hasPendingReview) {
      const essayAnswersRef = adminDb
        .collection("test_essay_answers")
        .doc(`${me.uid}_${programId}_${lessonId}_attempt${attemptCount}`);
      const essayAnswers: Record<string, string> = {};
      questions.forEach((q, i) => {
        if (q.type === "essay") {
          essayAnswers[q.question] = typeof body.answers![i] === "string" ? body.answers![i] : "";
        }
      });
      await essayAnswersRef.set({
        userId: me.uid,
        programId,
        lessonId,
        attemptCount,
        answers: essayAnswers,
        reviewed: false,
        reviewedAt: null,
        reviewedBy: null,
        createdAt: new Date(),
      });
    }

    // Nếu pass -> cập nhật assignment thành in_progress (nếu chưa completed)
    if (passed) {
      const aData = assignSnap.data() as { status?: string } | undefined;
      if (aData?.status === "not_started") {
        await assignRef.update({ status: "in_progress", startedAt: new Date() });
      }
    }

    const result = {
      score,
      earnedPoint: gradedEarned,
      totalPoint: gradedTotal,
      passed,
      attemptCount,
      hasEssayPendingReview: hasPendingReview,
    };

    if (body.includeDetails) {
      return ok({
        ...result,
        questionResults,
      });
    }

    return ok(result);
  } catch (e) {
    console.error("[api/lessons/:id/test/submit][POST] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
