import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, ok, bad } from "@/lib/api-auth";
import type { TestQuestion, PublicTestQuestion } from "@/types/training";

/**
 * GET /api/programs/:programId/lessons/:lessonId/test
 *  - Admin: trả full questions (kèm correctIndex, sampleAnswer)
 *  - Employee đã gán: trả questions ẩn correctIndex và sampleAnswer
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

    // Admin và Manager (sở hữu program) được xem full câu hỏi
    let isFullAccess = isAdmin(me);
    if (!isFullAccess && me.role === "manager") {
      const progSnap = await adminDb.collection("programs").doc(programId).get();
      if (progSnap.exists) {
        const progData = progSnap.data() as { managerId?: string };
        if (progData.managerId === me.uid) {
          isFullAccess = true;
        }
      }
    }

    if (isFullAccess) {
      return ok({
        id: tDoc.id,
        questions: data.questions,
        passScore: data.passScore,
      });
    }

    // Ẩn correctIndex và sampleAnswer cho employee
    const safeQuestions: PublicTestQuestion[] = data.questions.map((q) => {
      if (q.type === "essay") {
        return {
          type: "essay" as const,
          question: q.question,
          point: q.point,
        };
      }
      return {
        type: "multiple_choice" as const,
        question: q.question,
        options: q.options,
        point: q.point,
      };
    });

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
    const { programId, lessonId } = await ctx.params;

    // Kiểm tra quyền: admin hoặc manager sở hữu program
    const progRef = adminDb.collection("programs").doc(programId);
    const progSnap = await progRef.get();
    if (!progSnap.exists) return bad("Program not found", 404);
    const progData = progSnap.data() as { managerId?: string };
    const isProgramOwner = me.role === "manager" && progData.managerId === me.uid;
    if (!isAdmin(me) && !isProgramOwner) {
      return bad("Forbidden - bạn không có quyền chỉnh sửa test của chương trình này", 403);
    }

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

      if (q.type === "essay") {
        // Essay question validation
        if (typeof q.point !== "number" || q.point <= 0) {
          return bad(`Câu hỏi #${i + 1}: điểm phải > 0`);
        }
        // sampleAnswer is optional - can be empty for manual grading
        if (typeof q.sampleAnswer !== "string") {
          return bad(`Câu hỏi #${i + 1}: thiếu đáp án mẫu (để trống nếu cần chấm thủ công)`);
        }
      } else if (q.type === "multiple_choice") {
        // Multiple choice validation
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
          return bad(`Câu hỏi #${i + 1}: điểm phải > 0`);
        }
      } else {
        return bad(`Câu hỏi #${i + 1}: loại câu hỏi không hợp lệ`);
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

/**
 * DELETE /api/programs/:programId/lessons/:lessonId/test
 *  Xóa test của lesson. Chỉ admin.
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ programId: string; lessonId: string }> }) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    const { programId, lessonId } = await ctx.params;

    // Kiểm tra quyền: admin hoặc manager sở hữu program
    const progRef = adminDb.collection("programs").doc(programId);
    const progSnap = await progRef.get();
    if (!progSnap.exists) return bad("Program not found", 404);
    const progData = progSnap.data() as { managerId?: string };
    const isProgramOwner = me.role === "manager" && progData.managerId === me.uid;
    if (!isAdmin(me) && !isProgramOwner) {
      return bad("Forbidden - bạn không có quyền xóa test của chương trình này", 403);
    }

    const lessonRef = adminDb
      .collection("programs")
      .doc(programId)
      .collection("lessons")
      .doc(lessonId);

    const testsSnap = await lessonRef.collection("test").get();
    if (!testsSnap.empty) {
      // Delete all tests in this lesson
      const batch = adminDb.batch();
      testsSnap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
    
    // Update lesson's hasTest flag
    await lessonRef.update({ hasTest: false, updatedAt: new Date() });
    
    return ok();
  } catch (e) {
    console.error("[api/lessons/:id/test][DELETE] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
