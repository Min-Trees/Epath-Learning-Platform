import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, isManager, bad, ok } from "@/lib/api-auth";
import type { UserRole } from "@/types";

/**
 * Admin: tạo user mới (Firebase Auth + Firestore users/{uid}).
 * Manager: có thể tạo employee dưới quyền mình.
 * POST /api/admin/users
 * Body: { email, password, displayName, role?, department?, assignedProgramIds? }
 * Chỉ admin hoặc manager mới được gọi.
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
  managerId?: string; // Admin có thể chỉ định manager
  assignedProgramIds?: string[];
}

const ALLOWED_ROLES: UserRole[] = ["admin", "manager", "hr", "trainer", "employee"];

// Admin có thể tạo bất kỳ role nào
// Manager chỉ có thể tạo employee dưới quyền
function canCreateRole(creatorRole: UserRole, targetRole: UserRole): boolean {
  if (creatorRole === "admin") return true;
  if (creatorRole === "manager" && targetRole === "employee") return true;
  return false;
}

export async function POST(req: NextRequest) {
  // 1. Xác thực Bearer token
  const user = await getAuthUser(req);
  if (!user) return bad("Unauthorized - cần đăng nhập", 401);
  if (!isAdmin(user) && !isManager(user)) {
    return bad("Forbidden - chỉ admin hoặc manager mới có quyền", 403);
  }

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
  const department = (body.department ?? "").trim() || undefined;

  // 3. Validate role
  const requestedRole: UserRole = ALLOWED_ROLES.includes(body.role as UserRole)
    ? (body.role as UserRole)
    : "employee";

  // Check permission to create this role
  if (!canCreateRole(user.role, requestedRole)) {
    return bad(
      `Không có quyền tạo user với role "${requestedRole}". Manager chỉ có thể tạo nhân viên.`,
      403
    );
  }

  // 4. Validate
  if (!email || !email.includes("@")) {
    return bad("Email không hợp lệ");
  }
  if (!password || password.length < 6) {
    return bad("Mật khẩu tối thiểu 6 ký tự");
  }
  if (!displayName) {
    return bad("Tên hiển thị không được để trống");
  }

  // 5. Tạo user trong Firebase Auth
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

  // 6. Tạo Firestore doc
  try {
    const userData: Record<string, unknown> = {
      id: uid,
      email,
      displayName,
      role: requestedRole,
      department: department ?? null,
      enrolledCourses: [],
      completedCourses: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      // Đánh dấu user được tạo bởi admin/manager nào
      createdBy: user.uid,
    };

    // Nếu là manager tạo employee, gán managerId
    // Admin có thể chỉ định managerId cụ thể
    if (user.role === "manager" && requestedRole === "employee") {
      userData.managerId = user.uid;
    } else if (user.role === "admin" && body.managerId) {
      userData.managerId = body.managerId;
    }

    await adminDb
      .collection("users")
      .doc(uid)
      .set(userData, { merge: true });

    // 7. Gán các chương trình đào tạo nếu có
    if (body.assignedProgramIds && body.assignedProgramIds.length > 0) {
      const assignmentPromises = body.assignedProgramIds.map(async (programId) => {
        const assignmentId = `${uid}_${programId}`;
        await adminDb
          .collection("assignments")
          .doc(assignmentId)
          .set({
            userId: uid,
            programId,
            assignedAt: new Date(),
            assignedBy: user.uid,
            status: "not_started",
          });
      });
      await Promise.all(assignmentPromises);
    }
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
    role: requestedRole,
    department: department ?? null,
    managerId: user.role === "manager" && requestedRole === "employee" 
      ? user.uid 
      : (user.role === "admin" ? body.managerId : undefined),
    assignedProgramIds: body.assignedProgramIds,
  });
}