import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getAuthUser, isAdmin, isManager, bad, ok } from "@/lib/api-auth";
import { sendEmail } from "@/lib/email";
import { buildWelcomeEmail, APP_NAME } from "@/lib/email-template";
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
 *
 * Sau khi tạo thành công sẽ TỰ ĐỘNG gửi email welcome cho user mới.
 */

interface CreateUserBody {
  email?: string;
  password?: string;
  displayName?: string;
  role?: UserRole;
  department?: string;
  managerId?: string;
  assignedProgramIds?: string[];
}

const ALLOWED_ROLES: UserRole[] = ["admin", "manager", "hr", "trainer", "employee"];

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
      emailVerified: true, // Admin tạo → bỏ qua xác thực email
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

  // 6. Tạo Firestore doc + assignments
  const assignedProgramIds: string[] = Array.isArray(body.assignedProgramIds)
    ? body.assignedProgramIds
    : [];

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
      createdBy: user.uid,
    };

    if (user.role === "manager" && requestedRole === "employee") {
      userData.managerId = user.uid;
    } else if (user.role === "admin" && body.managerId) {
      userData.managerId = body.managerId;
    }

    await adminDb.collection("users").doc(uid).set(userData, { merge: true });

    // Gán chương trình đào tạo
    if (assignedProgramIds.length > 0) {
      await Promise.all(
        assignedProgramIds.map(async (programId) => {
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
        })
      );
    }
  } catch (e) {
    // Rollback Auth nếu Firestore lỗi
    try {
      await adminAuth.deleteUser(uid);
    } catch (rollbackErr) {
      console.error("[api/admin/users POST] rollback deleteUser error:", rollbackErr);
    }
    console.error("[api/admin/users POST] firestore set error:", e);
    return bad(
      `Tạo user thất bại: ${e instanceof Error ? e.message : String(e)}`,
      500
    );
  }

  // 7. TỰ ĐỘNG gửi email welcome — không cần admin bấm tay
  let emailSent = false;
  let emailError: string | null = null;
  try {
    let programTitles: string[] = [];
    if (assignedProgramIds.length > 0) {
      const progSnaps = await Promise.all(
        assignedProgramIds.map((id) =>
          adminDb.collection("trainingPrograms").doc(String(id)).get()
        )
      );
      programTitles = progSnaps
        .filter((s) => s.exists)
        .map((s) => s.data()?.title as string)
        .filter(Boolean);
    }

    const html = buildWelcomeEmail({
      displayName,
      email,
      password,
      programTitles,
    });

    await sendEmail({
      to: email,
      subject: `🎓 Chào mừng ${displayName} đến với ${APP_NAME}`,
      html,
    });
    emailSent = true;
    console.log(`[api/admin/users POST] Welcome email auto-sent to ${email}`);
  } catch (e) {
    emailError = e instanceof Error ? e.message : String(e);
    console.error("[api/admin/users POST] auto-send welcome email error:", emailError);
    // User đã tạo thành công → không fail cả request
  }

  return ok({
    uid,
    email,
    displayName,
    role: requestedRole,
    department: department ?? null,
    managerId:
      user.role === "manager" && requestedRole === "employee"
        ? user.uid
        : user.role === "admin"
          ? body.managerId
          : undefined,
    assignedProgramIds,
    emailSent,
    emailError,
  });
}
