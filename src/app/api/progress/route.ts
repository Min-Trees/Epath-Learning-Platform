import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, ok, bad } from "@/lib/api-auth";

/**
 * GET /api/progress?programId=&userId=
 *  - Employee: lấy progress của mình
 *  - Admin: lấy của userId bất kỳ (mặc định lấy của mình)
 *  Trả về: { progress, lessons: [{ lessonId, lessonStatus, testResult }] }
 */
export async function GET(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);

    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("programId");
    if (!programId) return bad("programId bắt buộc");

    const userId = isAdmin(me) && searchParams.get("userId")
      ? searchParams.get("userId")!
      : me.uid;

    const progRef = adminDb
      .collection("progress")
      .doc(`${userId}_${programId}`);
    const progSnap = await progRef.get();
    const lpSnap = await progRef.collection("lessons").get();
    const lessons = lpSnap.docs.map((d) => {
      const data = d.data() as {
        lessonStatus?: string;
        testResult?: unknown;
        updatedAt?: unknown;
      };
      return {
        id: d.id,
        lessonStatus: data.lessonStatus,
        testResult: data.testResult,
        updatedAt: data.updatedAt,
      };
    });
    return ok({
      progress: progSnap.exists ? progSnap.data() : null,
      lessons,
    });
  } catch (e) {
    console.error("[api/progress][GET] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}

/**
 * POST /api/progress
 *  Body: { programId, lessonId, lessonStatus }
 *  Employee: đánh dấu lesson completed (sau khi xem nội dung).
 *  - Tự động cập nhật assignment.status nếu tất cả lesson done.
 */
export async function POST(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    const body = (await req.json().catch(() => ({}))) as {
      programId?: string;
      lessonId?: string;
      lessonStatus?: "in_progress" | "completed";
    };
    if (!body.programId || !body.lessonId || !body.lessonStatus) {
      return bad("Thiếu programId/lessonId/lessonStatus");
    }
    if (!["in_progress", "completed"].includes(body.lessonStatus)) {
      return bad("lessonStatus không hợp lệ");
    }

    const assignRef = adminDb
      .collection("assignments")
      .doc(`${me.uid}_${body.programId}`);
    const assignSnap = await assignRef.get();
    if (!assignSnap.exists) return bad("Bạn chưa được gán chương trình này", 403);

    const progRef = adminDb
      .collection("progress")
      .doc(`${me.uid}_${body.programId}`);
    const lessonProgRef = progRef.collection("lessons").doc(body.lessonId);
    const lpSnap = await lessonProgRef.get();
    await progRef.set(
      {
        userId: me.uid,
        programId: body.programId,
        status:
          (assignSnap.data() as { status?: string } | undefined)?.status ??
          "in_progress",
        startedAt:
          (assignSnap.data() as { startedAt?: Date } | undefined)?.startedAt ??
          new Date(),
        updatedAt: new Date(),
      },
      { merge: true }
    );
    await lessonProgRef.set(
      {
        lessonStatus: body.lessonStatus,
        updatedAt: new Date(),
        ...(body.lessonStatus === "in_progress" && !lpSnap.exists
          ? { startedAt: new Date() }
          : {}),
      },
      { merge: true }
    );

    // Nếu status = completed -> cập nhật assignment nếu chưa có
    const aData = assignSnap.data() as { status?: string; startedAt?: Date } | undefined;
    if (aData?.status === "not_started") {
      await assignRef.update({ status: "in_progress", startedAt: new Date() });
    }

    // Kiểm tra nếu TẤT CẢ lesson trong program đã completed -> assignment = completed
    const programRef = adminDb.collection("programs").doc(body.programId);
    const lessonsSnap = await programRef.collection("lessons").get();
    const allLp = await progRef.collection("lessons").get();
    const completedSet = new Set(
      allLp.docs
        .filter(
          (d) =>
            (d.data() as { lessonStatus?: string }).lessonStatus === "completed"
        )
        .map((d) => d.id)
    );
    const allDone = lessonsSnap.docs.every((l) => completedSet.has(l.id));
    if (allDone && lessonsSnap.size > 0) {
      const currentA = (
        await assignRef.get()
      ).data() as { status?: string } | undefined;
      if (currentA?.status !== "completed") {
        await assignRef.update({
          status: "completed",
          completedAt: new Date(),
        });
      }
      await progRef.set({ status: "completed", completedAt: new Date() }, { merge: true });
    }

    return ok();
  } catch (e) {
    console.error("[api/progress][POST] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
