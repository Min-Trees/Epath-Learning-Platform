import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, ok, bad } from "@/lib/api-auth";
import type { LessonContentType } from "@/types/training";

/**
 * GET /api/programs/:programId/lessons
 *  Trả về tất cả lesson (metadata). Với employee đã được gán chương trình.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ programId: string }> }) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    const { programId } = await ctx.params;

    // Check quyền
    if (!isAdmin(me)) {
      const assignSnap = await adminDb
        .collection("assignments")
        .doc(`${me.uid}_${programId}`)
        .get();
      if (!assignSnap.exists) return bad("Forbidden", 403);
    }

    const snap = await adminDb
      .collection("programs")
      .doc(programId)
      .collection("lessons")
      .orderBy("order")
      .get();
    const lessons = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      // Ẩn fileKey với non-admin
      if (!isAdmin(me)) {
        const { fileKey, ...rest } = data;
        return { id: d.id, ...rest };
      }
      return { id: d.id, ...data };
    });
    return ok({ lessons });
  } catch (e) {
    console.error("[api/programs/:id/lessons][GET] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}

/**
 * POST /api/programs/:programId/lessons
 *  Body: { title, order, contentType: "text"|"video"|"pdf", textContent? }
 *  Tạo lesson dạng text ngay. Với video/pdf: lesson được tạo "rỗng" (chưa có file),
 *  frontend sau đó gọi presign-upload rồi confirm-upload để gắn file.
 *  Chỉ admin.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ programId: string }> }) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!isAdmin(me)) return bad("Forbidden - chỉ admin", 403);
    const { programId } = await ctx.params;

    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      order?: number;
      contentType?: LessonContentType;
      textContent?: string;
    };
    const title = (body.title ?? "").trim();
    if (!title) return bad("Tiêu đề lesson không được trống");
    const contentType = body.contentType ?? "text";
    if (!["text", "video", "pdf"].includes(contentType)) {
      return bad("contentType không hợp lệ");
    }
    if (contentType === "text" && !body.textContent) {
      return bad("textContent không được trống với lesson dạng text");
    }
    if (contentType !== "text" && !body.textContent === false) {
      // cho phép nhưng không yêu cầu
    }

    const programRef = adminDb.collection("programs").doc(programId);
    const progSnap = await programRef.get();
    if (!progSnap.exists) return bad("Program not found", 404);

    const data: Record<string, unknown> = {
      title,
      order: body.order ?? Date.now(),
      contentType,
      hasTest: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    if (contentType === "text") {
      data.textContent = body.textContent ?? "";
    }
    const ref = await programRef.collection("lessons").add(data);
    return ok({ lessonId: ref.id });
  } catch (e) {
    console.error("[api/programs/:id/lessons][POST] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
