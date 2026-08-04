import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, ok, bad } from "@/lib/api-auth";

interface TestRow {
  id: string;
  testId: string;
  programId: string;
  programTitle: string;
  lessonId: string;
  lessonTitle: string;
  questionCount: number;
  passScore: number;
  createdAt: string;
  updatedAt?: string;
}

/**
 * GET /api/admin/tests
 *  - Admin: trả về danh sách tất cả tests từ các chương trình
 */
export async function GET(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isAdmin(me)) return bad("Forbidden", 403);

    const programsSnap = await adminDb.collection("programs").get();
    const rows: TestRow[] = [];

    for (const programDoc of programsSnap.docs) {
      const programData = programDoc.data();
      const programTitle = (programData.title as string) || "(không có tiêu đề)";

      const lessonsSnap = await adminDb
        .collection("programs")
        .doc(programDoc.id)
        .collection("lessons")
        .get();

      for (const lessonDoc of lessonsSnap.docs) {
        const lessonData = lessonDoc.data();
        const lessonTitle = (lessonData.title as string) || "(không có tiêu đề)";

        // Check if lesson has test
        if (!(lessonData.hasTest as boolean)) continue;

        const testsSnap = await adminDb
          .collection("programs")
          .doc(programDoc.id)
          .collection("lessons")
          .doc(lessonDoc.id)
          .collection("test")
          .get();

        for (const testDoc of testsSnap.docs) {
          const testData = testDoc.data();
          const questions = Array.isArray(testData.questions)
            ? testData.questions.length
            : (testData.questionCount as number) ?? 0;

          rows.push({
            id: `${programDoc.id}/${lessonDoc.id}/${testDoc.id}`,
            testId: testDoc.id,
            programId: programDoc.id,
            programTitle,
            lessonId: lessonDoc.id,
            lessonTitle,
            questionCount: questions,
            passScore: (testData.passScore as number) ?? 70,
            createdAt: testData.createdAt
              ? new Date(testData.createdAt.toDate()).toISOString()
              : new Date().toISOString(),
            updatedAt: testData.updatedAt
              ? new Date(testData.updatedAt.toDate()).toISOString()
              : undefined,
          });
        }
      }
    }

    return ok({ tests: rows });
  } catch (e) {
    console.error("[api/admin/tests][GET] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
