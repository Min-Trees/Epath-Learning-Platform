import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { getAuthUser, bad, ok } from "@/lib/api-auth";

/**
 * POST /api/auth/change-password
 * Body: { newPassword: string }
 * User đã xác thực: Đổi mật khẩu của chính mình
 *
 * Lưu ý: Firebase Admin SDK không verify current password.
 * Client nên verify mật khẩu cũ trước khi gọi API này (re-authenticate).
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return bad("Unauthorized", 401);

  let body: { newPassword?: string };
  try {
    body = (await req.json()) as { newPassword?: string };
  } catch {
    return bad("Body không phải JSON hợp lệ", 400);
  }

  const { newPassword } = body;

  if (!newPassword) return bad("Mật khẩu mới bắt buộc");
  if (newPassword.length < 6) return bad("Mật khẩu mới tối thiểu 6 ký tự");

  try {
    await adminAuth.updateUser(user.uid, {
      password: newPassword,
    });
    return ok({ message: "Đổi mật khẩu thành công" });
  } catch (e) {
    console.error("[api/auth/change-password][POST] error:", e);
    return bad(e instanceof Error ? e.message : "Lỗi đổi mật khẩu", 500);
  }
}
