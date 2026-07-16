import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, ok, bad } from "@/lib/api-auth";
import type { TestQuestion } from "@/types/training";

/**
 * POST /api/programs/:programId/lessons/:lessonId/test/submit
 *  Body: { answers: number[] }  - mảng index đáp án user chọn, theo thứ tự câu hỏi
 *  -> Chấm điểm, cập nhật progress, trả { score, passed, attemptCount }
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

    const body = (await req.json().catch(() => ({}))) as { answers?: number[] };
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

    let earned = 0;
    let total = 0;
    tData.questions.forEach((q, i) => {
      total += q.point;
      if (body.answers![i] === q.correctIndex) earned += q.point;
    });
    const score = total > 0 ? Math.round((earned / total) * 100) : 0;
    const passed = score >= tData.passScore;

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
        },
        updatedAt: new Date(),
      },
      { merge: true }
    );

    // Nếu pass -> cập nhật assignment thành in_progress (nếu chưa completed)
    if (passed) {
      const aData = assignSnap.data() as { status?: string } | undefined;
      if (aData?.status === "not_started") {
        await assignRef.update({ status: "in_progress", startedAt: new Date() });
      }
    }

    return ok({
      score,
      earned,
      total,
      passed,
      attemptCount,
      passScore: tData.passScore,
    });
  } catch (e) {
    console.error("[api/lessons/:id/test/submit][POST] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
