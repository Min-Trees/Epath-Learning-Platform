import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getAuthUser, bad, ok } from "@/lib/api-auth";
import type { UserRole } from "@/types";

/**
 * Admin: tạo user mới (Firebase Auth + Firestore users/{uid}).
 * POST /api/admin/users
 * Body: { email, password, displayName, role?, department? }
 * Chỉ admin mới được gọi.
 *
 * Lưu ý: Dùng Firebase Admin SDK để bypass Firestore rules
 * và tạo user trong Auth mà không cần client context.
 */

interface CreateUserBody {
  email?: string;
  password?: string;
  displayName?: string;
  role?: UserRole;
  department?: string;
}

const ALLOWED_ROLES: UserRole[] = ["admin", "hr", "trainer", "employee"];

export async function POST(req: NextRequest) {
  // 1. Xác thực Bearer token
  const user = await getAuthUser(req);
  if (!user) return bad("Unauthorized - cần đăng nhập", 401);
  if (!user.isAdmin) return bad("Forbidden - chỉ admin mới có quyền", 403);

  // 2. Parse body
  let body: CreateUserBody;
  try {
    body = (await req.json()) as CreateUserBody;
  } catch {
    return bad("Body không phải JSON hợp lệ", 400);
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const displayName = (body.displayName ?? "").trim();
  const role: UserRole = ALLOWED_ROLES.includes(body.role as UserRole)
    ? (body.role as UserRole)
    : "employee";
  const department = (body.department ?? "").trim() || undefined;

  // 3. Validate
  if (!email || !email.includes("@")) {
    return bad("Email không hợp lệ");
  }
  if (!password || password.length < 6) {
    return bad("Mật khẩu tối thiểu 6 ký tự");
  }
  if (!displayName) {
    return bad("Tên hiển thị không được để trống");
  }

  // 4. Tạo user trong Firebase Auth
  let uid: string;
  try {
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName,
      // Vô hiệu hóa email verification cho user admin tạo (tránh block đăng nhập)
      emailVerified: true,
    });
    uid = userRecord.uid;
  } catch (e) {
    const code = (e as { code?: string })?.code;
    let msg = e instanceof Error ? e.message : String(e);
    if (code === "auth/email-already-in-use") {
      msg = `Email "${email}" đã được sử dụng.`;
    } else if (code === "auth/invalid-email") {
      msg = "Email không hợp lệ.";
    } else if (code === "auth/weak-password") {
      msg = "Mật khẩu quá yếu (tối thiểu 6 ký tự).";
    }
    console.error("[api/admin/users POST] createUser error:", code, msg);
    return bad(msg, 400);
  }

  // 5. Tạo Firestore doc
  try {
    await adminDb
      .collection("users")
      .doc(uid)
      .set(
        {
          id: uid,
          email,
          displayName,
          role,
          department: department ?? null,
          enrolledCourses: [],
          completedCourses: [],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          // Đánh dấu user được tạo bởi admin này
          createdBy: user.uid,
        },
        { merge: true }
      );
  } catch (e) {
    // Nếu ghi Firestore lỗi → rollback Auth user để tránh trạng thái lủng củng
    try {
      await adminAuth.deleteUser(uid);
    } catch (rollbackErr) {
      console.error(
        "[api/admin/users POST] rollback deleteUser error:",
        rollbackErr
      );
    }
    console.error("[api/admin/users POST] firestore set error:", e);
    return bad(
      `Tạo user thất bại: ${e instanceof Error ? e.message : String(e)}`,
      500
    );
  }

  return ok({
    uid,
    email,
    displayName,
    role,
    department: department ?? null,
  });
}