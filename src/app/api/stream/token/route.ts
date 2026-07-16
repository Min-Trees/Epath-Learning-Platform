import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, ok, bad } from "@/lib/api-auth";
import { signStreamSession } from "@/lib/stream-session";

/**
 * POST /api/stream/token
 * Body: { lessonId, programId, kind?: "video" | "pdf" }
 *
 * Tạo session token ngắn hạn (10 phút) cho phép user xem lesson.
 * Server verify:
 *   - User đã đăng nhập
 *   - User được assign chương trình chứa lesson này (hoặc là admin)
 *   - Lesson có fileKey hợp lệ
 *
 * Trả về: { token, expiresIn, sessionId }
 *
 * Client dùng token để gọi /api/stream/[token]/...
 */

interface RequestBody {
  lessonId?: string;
  programId?: string;
  kind?: "video" | "pdf";
}

const TTL_SECONDS = 600; // 10 phút

export async function POST(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const { lessonId, programId, kind = "video" } = body;
    if (!lessonId || !programId) {
      return bad("Thiếu lessonId hoặc programId");
    }
    if (kind !== "video" && kind !== "pdf") {
      return bad("kind phải là 'video' hoặc 'pdf'");
    }

    // Đọc lesson
    const lessonRef = adminDb
      .collection("programs")
      .doc(programId)
      .collection("lessons")
      .doc(lessonId);
    const lessonSnap = await lessonRef.get();
    if (!lessonSnap.exists) return bad("Lesson not found", 404);

    const lessonData = lessonSnap.data() ?? {};
    const fileKey = typeof lessonData.fileKey === "string" ? lessonData.fileKey : "";
    if (!fileKey) {
      return bad("Lesson chưa có file. Vui lòng upload trước.", 400);
    }

    // Check quyền: admin hoặc user được gán program
    if (!me.isAdmin) {
      const assignmentSnap = await adminDb
        .collection("assignments")
        .where("userId", "==", me.uid)
        .where("programId", "==", programId)
        .limit(1)
        .get();
      if (assignmentSnap.empty) {
        return bad("Bạn không có quyền truy cập chương trình này", 403);
      }
    }

    const sessionId = randomUUID();
    const token = signStreamSession(
      {
        uid: me.uid,
        email: me.email ?? "",
        lid: lessonId,
        fk: fileKey,
        kind,
        sid: sessionId,
      },
      TTL_SECONDS
    );

    // Log session để tracking
    await adminDb.collection("stream_sessions").doc(sessionId).set({
      uid: me.uid,
      email: me.email,
      programId,
      lessonId,
      fileKey,
      kind,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + TTL_SECONDS * 1000),
      ip: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "",
      userAgent: req.headers.get("user-agent") ?? "",
    });

    return ok({
      token,
      expiresIn: TTL_SECONDS,
      sessionId,
    });
  } catch (e) {
    console.error("[api/stream/token][POST] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
