import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isManagerOrAdmin, ok, bad, getBaseUrl } from "@/lib/api-auth";
import { buildFileKey, presignPutUrl, S3_USE_LOCAL_FALLBACK, S3_CONFIGURED } from "@/lib/s3";

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
    if (!isManagerOrAdmin(me)) return bad("Forbidden - chỉ admin và manager", 403);

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
    if (
      mimeType.startsWith("video/") ||
      mimeType === "application/pdf"
    ) {
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
    // Expires dài hơn cho file lớn - file 2GB qua mạng chậm có thể mất >30 phút.
    // Khi dùng local fallback thì để 600s là đủ; khi upload thẳng lên S3 thì để 2 giờ.
    const expiresIn = S3_USE_LOCAL_FALLBACK ? 600 : 2 * 60 * 60;
    const uploadUrl = await presignPutUrl({
      fileKey,
      contentType: mimeType,
      contentLength: body.size,
      expiresInSeconds: expiresIn,
      appBaseUrl: getBaseUrl(req),
    });
    // Log debug: cho biết URL trỏ về đâu (S3 thật hay local fallback)
    let uploadTarget: string;
    try {
      uploadTarget = new URL(uploadUrl).origin;
    } catch {
      uploadTarget = "invalid-url";
    }
    console.log(
      `[presign] fileKey=${fileKey} size=${body.size} mode=${S3_USE_LOCAL_FALLBACK ? "local-fallback" : "direct-s3"} target=${uploadTarget}`
    );
    return ok({
      uploadUrl,
      fileKey,
      expiresIn,
      localFallback: S3_USE_LOCAL_FALLBACK,
      // Khi S3 đã cấu hình, client có thể chọn upload qua proxy server-side
      // (bypass CORS). URL proxy đặt cùng origin, không cần bucket CORS.
      proxyUrl: S3_CONFIGURED
        ? `${getBaseUrl(req)}/api/uploads/s3-proxy?key=${encodeURIComponent(fileKey)}&contentType=${encodeURIComponent(mimeType)}`
        : null,
      // Max size do S3 provider giới hạn (mặc định 5GB cho PUT single object).
      // Multipart upload cho file >5GB — xem tài liệu.
      maxSizeBytes: 5 * 1024 * 1024 * 1024,
    });
  } catch (e) {
    console.error("[api/uploads/presign][POST] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
