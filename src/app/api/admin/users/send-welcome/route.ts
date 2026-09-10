import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, isManager, bad, ok } from "@/lib/api-auth";
import { sendEmail } from "@/lib/email";
import { buildWelcomeEmail, APP_NAME } from "@/lib/email-template";

/**
 * Gửi lại email thông tin đăng nhập cho user (dùng khi auto-send thất bại).
 * POST /api/admin/users/send-welcome
 * Body: { email, password, displayName, assignedProgramTitles? }
 * Only admin or manager.
 */

interface SendWelcomeBody {
  email?: string;
  password?: string;
  displayName?: string;
  assignedProgramTitles?: string[];
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return bad("Unauthorized - cần đăng nhập", 401);
  if (!isAdmin(user) && !isManager(user)) {
    return bad("Forbidden - chỉ admin hoặc manager mới có quyền", 403);
  }

  let body: SendWelcomeBody;
  try {
    body = (await req.json()) as SendWelcomeBody;
  } catch {
    return bad("Body không phải JSON hợp lệ", 400);
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const displayName = (body.displayName ?? "").trim();

  if (!email || !email.includes("@")) return bad("Email không hợp lệ");
  if (!password) return bad("Mật khẩu không được để trống");
  if (!displayName) return bad("Tên hiển thị không được để trống");

  let programTitles: string[] = [];
  if (Array.isArray(body.assignedProgramTitles) && body.assignedProgramTitles.length > 0) {
    programTitles = body.assignedProgramTitles.filter(Boolean);
  } else {
    try {
      const snap = await adminDb
        .collection("users")
        .where("email", "==", email)
        .limit(1)
        .get();
      if (!snap.empty) {
        const uid = snap.docs[0].id;
        const assignSnap = await adminDb
          .collection("assignments")
          .where("userId", "==", uid)
          .get();
        const ids = assignSnap.docs.map((d) => d.data().programId).filter(Boolean);
        if (ids.length > 0) {
          const progSnaps = await Promise.all(
            ids.map((id) => adminDb.collection("trainingPrograms").doc(String(id)).get())
          );
          programTitles = progSnaps
            .filter((s) => s.exists)
            .map((s) => s.data()?.title as string)
            .filter(Boolean);
        }
      }
    } catch (e) {
      console.warn("[api/admin/users/send-welcome] lookup programs warn:", e);
    }
  }

  const html = buildWelcomeEmail({ displayName, email, password, programTitles });

  try {
    await sendEmail({
      to: email,
      subject: `🎓 Chào mừng ${displayName} đến với ${APP_NAME}`,
      html,
    });
  } catch (e) {
    console.error("[api/admin/users/send-welcome] send email error:", e);
    return bad(
      `Không thể gửi email: ${e instanceof Error ? e.message : String(e)}`,
      500
    );
  }

  return ok({ sent: true, to: email, programCount: programTitles.length });
}
