import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, ok, bad } from "@/lib/api-auth";
import type { TestQuestion } from "@/types/training";

/**
 * GET /api/programs/:programId/lessons/:lessonId/test
 *  - Admin: trả full questions (kèm correctIndex)
 *  - Employee đã gán: trả questions ẩn correctIndex
 *  - Ngược lại: 403
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ programId: string; lessonId: string }> }) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    const { programId, lessonId } = await ctx.params;

    let allowed = isAdmin(me);
    if (!allowed) {
      const a = await adminDb
        .collection("assignments")
        .doc(`${me.uid}_${programId}`)
        .get();
      allowed = a.exists;
    }
    if (!allowed) return bad("Forbidden", 403);

    const lessonRef = adminDb
      .collection("programs")
      .doc(programId)
      .collection("lessons")
      .doc(lessonId);
    const lessonSnap = await lessonRef.get();
    if (!lessonSnap.exists) return bad("Lesson not found", 404);
    if (!(lessonSnap.data() as { hasTest?: boolean } | undefined)?.hasTest) {
      return bad("Lesson chưa có bài test", 404);
    }

    const testsSnap = await lessonRef.collection("test").get();
    if (testsSnap.empty) return bad("Test chưa được tạo", 404);
    // Lấy test đầu tiên (mỗi lesson 1 test)
    const tDoc = testsSnap.docs[0];
    const data = tDoc.data() as {
      questions: TestQuestion[];
      passScore: number;
    };
    if (isAdmin(me)) {
      return ok({
        id: tDoc.id,
        questions: data.questions,
        passScore: data.passScore,
      });
    }
    // Ẩn correctIndex
    const safeQuestions = data.questions.map((q) => ({
      question: q.question,
      options: q.options,
      point: q.point,
    }));
    return ok({
      id: tDoc.id,
      questions: safeQuestions,
      passScore: data.passScore,
    });
  } catch (e) {
    console.error("[api/lessons/:id/test][GET] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}

/**
 * POST /api/programs/:programId/lessons/:lessonId/test
 *  Body: { questions, passScore }
 *  Tạo / cập nhật test. Set hasTest=true. Chỉ admin.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ programId: string; lessonId: string }> }) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isAdmin(me)) return bad("Forbidden - chỉ admin", 403);
    const { programId, lessonId } = await ctx.params;

    const body = (await req.json().catch(() => ({}))) as {
      questions?: TestQuestion[];
      passScore?: number;
    };
    if (!Array.isArray(body.questions) || body.questions.length === 0) {
      return bad("Cần ít nhất 1 câu hỏi");
    }
    for (const [i, q] of body.questions.entries()) {
      if (!q.question || typeof q.question !== "string") {
        return bad(`Câu hỏi #${i + 1}: thiếu nội dung`);
      }
      if (!Array.isArray(q.options) || q.options.length < 2) {
        return bad(`Câu hỏi #${i + 1}: cần ≥ 2 đáp án`);
      }
      if (
        typeof q.correctIndex !== "number" ||
        q.correctIndex < 0 ||
        q.correctIndex >= q.options.length
      ) {
        return bad(`Câu hỏi #${i + 1}: correctIndex không hợp lệ`);
      }
      if (typeof q.point !== "number" || q.point <= 0) {
        return bad(`Câu hỏi #${i + 1}: point phải > 0`);
      }
    }
    const passScore = Number(body.passScore ?? 70);
    if (passScore < 0 || passScore > 100) {
      return bad("passScore phải trong [0,100]");
    }

    const lessonRef = adminDb
      .collection("programs")
      .doc(programId)
      .collection("lessons")
      .doc(lessonId);
    const lessonSnap = await lessonRef.get();
    if (!lessonSnap.exists) return bad("Lesson not found", 404);

    const testsSnap = await lessonRef.collection("test").get();
    const payload = {
      questions: body.questions,
      passScore,
      updatedAt: new Date(),
    };
    if (testsSnap.empty) {
      await lessonRef.collection("test").add({
        ...payload,
        createdAt: new Date(),
      });
    } else {
      await testsSnap.docs[0].ref.update(payload);
    }
    await lessonRef.update({ hasTest: true, updatedAt: new Date() });
    return ok();
  } catch (e) {
    console.error("[api/lessons/:id/test][POST] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
