import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, isManager, bad, ok } from "@/lib/api-auth";

const DEFAULT_PASSWORD = "epath@123";

/**
 * POST /api/admin/users/reset-password
 * Body: { userId: string }
 * Admin/Manager: Reset password của user về "epath@123"
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return bad("Unauthorized", 401);
  if (!isAdmin(user) && !isManager(user)) {
    return bad("Forbidden - chỉ admin hoặc manager mới có quyền", 403);
  }

  let body: { userId?: string };
  try {
    body = (await req.json()) as { userId?: string };
  } catch {
    return bad("Body không phải JSON hợp lệ", 400);
  }

  const { userId } = body;
  if (!userId) return bad("userId bắt buộc");

  // Không thể reset password của chính mình
  if (userId === user.uid) {
    return bad("Không thể reset mật khẩu của chính bạn");
  }

  try {
    await adminAuth.updateUser(userId, {
      password: DEFAULT_PASSWORD,
    });
    return ok({ message: "Đã reset mật khẩu về 'epath@123'" });
  } catch (e) {
    console.error("[api/admin/users/reset-password][POST] error:", e);
    const code = (e as { code?: string })?.code;
    if (code === "auth/user-not-found") {
      return bad("User không tồn tại", 404);
    }
    return bad(e instanceof Error ? e.message : "Lỗi reset mật khẩu", 500);
  }
}
