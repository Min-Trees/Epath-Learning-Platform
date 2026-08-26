import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, isManager, isManagerOrAdmin, ok, bad } from "@/lib/api-auth";
import type { AuthUser } from "@/lib/api-auth";

interface EssayAnswer {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  programId: string;
  programTitle: string;
  lessonId: string;
  lessonTitle: string;
  attemptCount: number;
  answers: Record<string, string>; // question -> user answer
  createdAt: string;
  reviewed: boolean;
  reviewedAt?: string;
  reviewedBy?: string;
  earnedPoints?: Record<string, number>; // question -> points given
  maxPoints?: number;
}

interface TestQuestion {
  type: "essay" | "multiple_choice";
  question: string;
  sampleAnswer?: string;
  point: number;
}

/**
 * Lấy danh sách userId thuộc quản lý (nếu là manager).
 * Admin trả về null để không filter.
 */
async function getManagedUserIds(
  me: AuthUser,
): Promise<Set<string> | null> {
  if (isAdmin(me)) return null;
  if (!isManager(me)) return new Set();
  const snap = await adminDb
    .collection("users")
    .where("managerId", "==", me.uid)
    .get();
  return new Set(snap.docs.map((d) => d.id));
}

/**
 * GET /api/admin/tests/essay-reviews
 *  - Admin: trả về tất cả các câu trả lời tự luận cần chấm
 *  - Manager: chỉ trả về các câu trả lời của nhân viên dưới quyền
 */
export async function GET(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isManagerOrAdmin(me)) return bad("Forbidden", 403);

    const { searchParams } = new URL(req.url);
    const onlyPending = searchParams.get("pending") === "true";

    // Lấy danh sách userId được phép xem
    const allowedUserIds = await getManagedUserIds(me);

    // Get all essay answers
    const essayAnswersSnap = await adminDb
      .collection("test_essay_answers")
      .orderBy("createdAt", "desc")
      .get();

    const rows: EssayAnswer[] = [];

    for (const doc of essayAnswersSnap.docs) {
      const data = doc.data();

      // Manager: chỉ xem essay answers của nhân viên thuộc quyền
      if (allowedUserIds !== null && !allowedUserIds.has(data.userId)) {
        continue;
      }

      // Skip reviewed ones if filtering
      if (onlyPending && data.reviewed) continue;

      // Get user info
      let userName = "";
      let userEmail = "";
      try {
        const userDoc = await adminDb.collection("users").doc(data.userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          userName = (userData?.displayName as string) || (userData?.name as string) || "";
          userEmail = (userData?.email as string) || "";
        }
      } catch {
        // User might not exist
      }

      // Get program, lesson, and test questions info
      let programTitle = "";
      let lessonTitle = "";
      let totalMaxPoints = 0;

      try {
        const programDoc = await adminDb.collection("programs").doc(data.programId).get();
        if (programDoc.exists) {
          programTitle = (programDoc.data()?.title as string) || "";
        }

        const lessonDoc = await adminDb
          .collection("programs")
          .doc(data.programId)
          .collection("lessons")
          .doc(data.lessonId)
          .get();
        if (lessonDoc.exists) {
          lessonTitle = (lessonDoc.data()?.title as string) || "";
        }

        // Get test questions to calculate total max points for essay questions
        const testsSnap = await adminDb
          .collection("programs")
          .doc(data.programId)
          .collection("lessons")
          .doc(data.lessonId)
          .collection("test")
          .get();

        if (!testsSnap.empty) {
          const testData = testsSnap.docs[0].data();
          const questions = testData.questions as TestQuestion[];
          questions.forEach((q) => {
            if (q.type === "essay") {
              totalMaxPoints += q.point;
            }
          });
        }
      } catch {
        // Program/Lesson might not exist
      }

      rows.push({
        id: doc.id,
        userId: data.userId,
        userName,
        userEmail,
        programId: data.programId,
        programTitle,
        lessonId: data.lessonId,
        lessonTitle,
        attemptCount: data.attemptCount || 1,
        answers: data.answers || {},
        createdAt: data.createdAt
          ? new Date(data.createdAt.toDate()).toISOString()
          : new Date().toISOString(),
        reviewed: data.reviewed || false,
        reviewedAt: data.reviewedAt
          ? new Date(data.reviewedAt.toDate()).toISOString()
          : undefined,
        reviewedBy: data.reviewedBy,
        earnedPoints: data.earnedPoints,
        maxPoints: totalMaxPoints,
      });
    }

    return ok({ essays: rows });
  } catch (e) {
    console.error("[api/admin/tests/essay-reviews][GET] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
