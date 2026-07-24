import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, isManager, ok, bad } from "@/lib/api-auth";
import type { AuthUser } from "@/lib/api-auth";
import type { LessonContentType } from "@/types/training";

function canManageLessons(user: AuthUser | null): boolean {
  return isAdmin(user) || isManager(user);
}

/**
 * GET /api/programs/:programId/lessons
 *  Trả về tất cả lesson (metadata). Với employee đã được gán chương trình.
 *  Hoặc nếu lesson có allowedRoles, kiểm tra role của user.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ programId: string }> }) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    const { programId } = await ctx.params;

    // Check quyền: Admin/Manager được xem tất cả
    // Employee cần được gán chương trình HOẶC có role được phép
    let hasAccess = isAdmin(me) || isManager(me);
    
    if (!hasAccess) {
      const assignSnap = await adminDb
        .collection("assignments")
        .doc(`${me.uid}_${programId}`)
        .get();
      hasAccess = assignSnap.exists;
    }

    // Kiểm tra program-level allowedRoles
    if (!hasAccess) {
      const progSnap = await adminDb.collection("programs").doc(programId).get();
      if (progSnap.exists) {
        const progData = progSnap.data() as { allowedRoles?: string[] } | undefined;
        if (progData?.allowedRoles && progData.allowedRoles.length > 0) {
          hasAccess = progData.allowedRoles.includes(me.role);
        }
      }
    }

    if (!hasAccess) return bad("Forbidden", 403);

    const snap = await adminDb
      .collection("programs")
      .doc(programId)
      .collection("lessons")
      .orderBy("order")
      .get();
    const lessons = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      // Ẩn fileKey với non-admin/manager
      if (!isAdmin(me) && !isManager(me)) {
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
 *  Body: { title, order, contentType: "text"|"video"|"pdf", textContent?, allowedRoles? }
 *  Tạo lesson dạng text ngay. Với video/pdf: lesson được tạo "rỗng" (chưa có file),
 *  frontend sau đó gọi presign-upload rồi confirm-upload để gắn file.
 *  Admin và Manager đều có thể tạo.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ programId: string }> }) {
  try {
    const me = await getAuthUser(req);
    if (!me) return bad("Unauthorized", 401);
    if (!canManageLessons(me)) return bad("Forbidden - chỉ admin và manager mới có quyền", 403);
    const { programId } = await ctx.params;

    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      order?: number;
      contentType?: LessonContentType;
      textContent?: string;
      allowedRoles?: string[];
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
      // Các role được phép xem lesson này (nếu có)
      ...(body.allowedRoles ? { allowedRoles: body.allowedRoles } : {}),
    };
    if (contentType === "text") {
      const tc = body.textContent ?? "";
      // Firestore giới hạn mỗi field ~1 MiB (1,048,487 bytes). Vượt quá sẽ trả
      // INVALID_ARGUMENT và khó debug. Validate sớm để trả thông báo rõ ràng.
      const MAX_TEXT_CONTENT = 1_000_000; // ~1MB an toàn (còn chỗ cho metadata)
      if (typeof tc !== "string") return bad("textContent phải là string");
      if (Buffer.byteLength(tc, "utf8") > MAX_TEXT_CONTENT) {
        return bad(
          `Nội dung text quá lớn (giới hạn ~${MAX_TEXT_CONTENT / 1024} KB). Hãy chia thành nhiều lesson hoặc upload file PDF/video.`,
          413
        );
      }
      data.textContent = tc;
    }
    const ref = await programRef.collection("lessons").add(data);
    return ok({ lessonId: ref.id });
  } catch (e) {
    console.error("[api/programs/:id/lessons][POST] error:", e);
    return bad(e instanceof Error ? e.message : "Internal error", 500);
  }
}
