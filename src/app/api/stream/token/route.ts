import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, ok, bad } from "@/lib/api-auth";
import { signStreamSession } from "@/lib/stream-session";

interface RequestBody {
  lessonId?: string;
  programId?: string;
  kind?: "video" | "pdf";
}

// Token TTL: phải đủ dài để cover toàn bộ thời lượng video.
//
// Mỗi Range request tới /api/stream/[token]/file đều verify lại JWT
// (xem src/app/api/stream/[token]/file/route.ts), nên nếu TTL quá ngắn,
// browser sẽ bị 401 giữa chừng khi buffer cạn → hiện lỗi "video bị xóa".
//
// TTL 4 giờ phủ hầu hết video training hiện tại. Với video > 4h, client
// (SecureVideoPlayer) sẽ tự refresh token trước khi hết hạn.
const TTL_SECONDS = 4 * 60 * 60; // 4 giờ

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

    if (!me.isAdmin && !me.isManager) {
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

    const sessionId = crypto.randomUUID();
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

    return ok({
      token,
      expiresIn: TTL_SECONDS,
      sessionId,
      fileKey,
    });
  } catch (e) {
    console.error("[api/stream/token][POST] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
