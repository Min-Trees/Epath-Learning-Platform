import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, ok, bad, getBaseUrl } from "@/lib/api-auth";
import { buildFileKey, presignPutUrl, R2_USE_LOCAL_FALLBACK } from "@/lib/r2";

/**
 * POST /api/uploads/presign
 *  Body: { fileName, mimeType, programId, lessonId, size? }
 *  Trả về: { uploadUrl, fileKey, expiresIn }
 *  Chỉ admin.
 */
export async function POST(req: NextRequest) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isAdmin(me)) return bad("Forbidden - chỉ admin", 403);

    const body = (await req.json().catch(() => ({}))) as {
      fileName?: string;
      mimeType?: string;
      programId?: string;
      lessonId?: string;
      size?: number;
    };
    const { fileName, mimeType, programId, lessonId } = body;
    if (!fileName || !mimeType || !programId || !lessonId) {
      return bad("Thiếu fileName/mimeType/programId/lessonId");
    }
    // Validate mimeType theo contentType dự kiến
    if (mimeType.startsWith("video/") || mimeType === "application/pdf") {
      // ok
    } else {
      return bad("Chỉ hỗ trợ video/* hoặc application/pdf");
    }

    // Validate size: chỉ yêu cầu size > 0, không giới hạn trên.
    if (typeof body.size !== "number" || body.size <= 0) {
      return bad("Thiếu hoặc sai kích thước file (size)");
    }

    // Kiểm tra lesson tồn tại (chỉ bắt buộc khi update - với lesson mới, ta cho
    // presign trước rồi lesson sẽ được tạo khi user bấm "Lưu lesson")
    if (lessonId !== "new") {
      const lessonRef = adminDb
        .collection("programs")
        .doc(programId)
        .collection("lessons")
        .doc(lessonId);
      const snap = await lessonRef.get();
      if (!snap.exists) return bad("Lesson not found", 404);
    }

    // Với lesson mới (id="new") thì tạo key placeholder; khi Lưu lesson xong,
    // frontend gọi confirm-upload sẽ re-key theo lessonId thật.
    const effectiveLessonId = lessonId === "new" ? `pending-${Date.now()}` : lessonId;
    const fileKey = buildFileKey({ programId, lessonId: effectiveLessonId, fileName });
    const expiresIn = 600; // 10 phút
    const uploadUrl = await presignPutUrl({
      fileKey,
      contentType: mimeType,
      contentLength: body.size,
      expiresInSeconds: expiresIn,
      appBaseUrl: getBaseUrl(req),
    });
    return ok({ uploadUrl, fileKey, expiresIn, localFallback: R2_USE_LOCAL_FALLBACK });
  } catch (e) {
    console.error("[api/uploads/presign][POST] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
