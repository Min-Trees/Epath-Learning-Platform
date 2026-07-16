import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

/**
 * Proxy video từ URL external về, stream lại cho client.
 *
 * Client gọi: GET /api/video/{courseId}/{lessonId}
 * Server:
 *   1. Đọc lesson từ Firestore (admin SDK)
 *   2. Lấy content.videoUrl (URL trực tiếp từ CDN/YouTube embed)
 *   3. Stream về client, ẩn URL gốc
 *
 * Hỗ trợ Range requests để tua video.
 *
 * Lưu ý: KHÔNG còn dùng Firebase Storage. Toàn bộ video phải là URL
 * trực tiếp được admin lưu trong `lesson.content.videoUrl`.
 */

interface RouteContext {
  params: Promise<{ courseId: string; lessonId: string }>;
}

const ALLOWED_HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "videos.ctfassets.net",
  "commondatastorage.googleapis.com",
  ".cloudfront.net",
  ".s3.amazonaws.com",
];

function isAllowedUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    return ALLOWED_HOSTS.some(
      (host) => u.hostname === host || u.hostname.endsWith("." + host)
    );
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const { courseId, lessonId } = await ctx.params;

    const lessonSnap = await adminDb
      .collection("courses")
      .doc(courseId)
      .collection("lessons")
      .doc(lessonId)
      .get();

    if (!lessonSnap.exists) {
      return NextResponse.json(
        { success: false, error: "Lesson not found" },
        { status: 404 }
      );
    }

    const data = lessonSnap.data();
    const content = (data?.content as Record<string, unknown> | undefined) ?? {};
    const videoUrl =
      typeof content.videoUrl === "string" ? content.videoUrl : null;

    if (!videoUrl || videoUrl.startsWith("/")) {
      return NextResponse.json(
        {
          success: false,
          error: "Lesson không có videoUrl hợp lệ (URL trực tiếp .mp4 hoặc tương đương).",
        },
        { status: 400 }
      );
    }

    if (!isAllowedUrl(videoUrl)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "URL video không thuộc domain được phép. Liên hệ admin để thêm vào allowlist.",
        },
        { status: 403 }
      );
    }

    const range = req.headers.get("range");
    const upstreamHeaders: HeadersInit = {};
    if (range) upstreamHeaders["Range"] = range;

    const upstream = await fetch(videoUrl, {
      headers: upstreamHeaders,
      cache: "no-store",
    });

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { success: false, error: `Upstream trả về ${upstream.status}` },
        { status: 502 }
      );
    }

    const headers = new Headers();
    headers.set(
      "Content-Type",
      upstream.headers.get("content-type") ?? "video/mp4"
    );
    const cl = upstream.headers.get("content-length");
    if (cl) headers.set("Content-Length", cl);
    const acceptRanges = upstream.headers.get("accept-ranges");
    if (acceptRanges) headers.set("Accept-Ranges", acceptRanges);
    headers.set("Cache-Control", "private, max-age=3600");
    headers.set("X-Content-Type-Options", "nosniff");

    const status = upstream.status === 206 ? 206 : 200;
    return new NextResponse(upstream.body, { status, headers });
  } catch (e) {
    console.error("[api/video] error:", e);
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Internal error",
      },
      { status: 500 }
    );
  }
}