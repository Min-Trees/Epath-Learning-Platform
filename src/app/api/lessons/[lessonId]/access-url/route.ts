import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { bad } from "@/lib/api-auth";

/**
 * GET /api/lessons/:lessonId/access-url
 *
 * ĐÃ NGỪNG SỬ DỤNG: endpoint này trước đây trả presigned URL trực tiếp
 * tới R2 → user có thể copy và share. Đã thay bằng:
 *   - Video: POST /api/stream/token + HLS streaming (watermark per user)
 *   - PDF:   POST /api/stream/token + /api/stream/[token]/file
 *
 * Endpoint được giữ để tương thích ngược nhưng luôn trả 410 Gone.
 */
export async function GET(req: NextRequest, _ctx: { params: Promise<{ lessonId: string }> }) {
  try {
    // Verify vẫn check user để log hành vi bất thường
    const { getAuthUser } = await import("@/lib/api-auth");
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    void adminDb; // keep import
    return NextResponse.json(
      {
        success: false,
        error:
          "Endpoint này đã ngừng sử dụng. Dùng /api/stream/token thay thế.",
      },
      { status: 410 }
    );
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
