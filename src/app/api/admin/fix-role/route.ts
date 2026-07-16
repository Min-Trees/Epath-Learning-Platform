import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

/**
 * /api/admin/fix-role — ép role của user theo email.
 *
 * Body: { email: string, role: "admin" | "trainer" | "employee" }
 *
 * Không có rào cản "hasAdmin" — dùng được ngay cả khi hệ thống đã có admin.
 * Dùng để bootstrap / sửa lỗi role cho user đã tồn tại.
 *
 * Sau khi sửa xong nên xóa route này khỏi codebase.
 */

type Role = "admin" | "trainer" | "employee";

const VALID_ROLES: Role[] = ["admin", "trainer", "employee"];

export async function POST(req: NextRequest) {
  let body: { email?: string; role?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Body không phải JSON hợp lệ." },
      { status: 400 }
    );
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const role = body.role as Role | undefined;

  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { success: false, error: "Email không hợp lệ." },
      { status: 400 }
    );
  }

  if (!role || !VALID_ROLES.includes(role)) {
    return NextResponse.json(
      {
        success: false,
        error: `Role không hợp lệ. Chỉ chấp nhận: ${VALID_ROLES.join(", ")}`,
      },
      { status: 400 }
    );
  }

  try {
    const userRecord = await adminAuth.getUserByEmail(email);
    const uid = userRecord.uid;

    await adminDb.collection("users").doc(uid).set(
      {
        role,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      data: { uid, email, role },
    });
  } catch (e) {
    const code = (e as { code?: string })?.code;
    let msg = e instanceof Error ? e.message : String(e);
    if (code === "auth/user-not-found") {
      msg = `Không tìm thấy user với email ${email} trong Firebase Auth.`;
    }
    return NextResponse.json(
      { success: false, error: msg },
      { status: 404 }
    );
  }
}