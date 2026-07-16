import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

/**
 * Setup Admin API — chỉ dùng để bootstrap admin đầu tiên.
 *
 * POST /api/admin/setup-admin
 * Body: {
 *   mode: "create" | "promote",
 *   email: string,
 *   password: string,         // chỉ dùng cho mode=create
 *   displayName?: string,
 * }
 *
 * Sau khi có ít nhất 1 admin, route vẫn cho phép tạo admin bổ sung
 * (dùng cho bootstrap). Trong production nên xóa route này khỏi codebase.
 */

interface SetupBody {
  mode?: "create" | "promote";
  email?: string;
  password?: string;
  displayName?: string;
}

async function hasAnyAdmin(): Promise<boolean> {
  // Query users có role=admin (giới hạn 1 kết quả để tiết kiệm)
  const snap = await adminDb
    .collection("users")
    .where("role", "==", "admin")
    .limit(1)
    .get();
  return !snap.empty;
}

export async function POST(req: NextRequest) {
  let body: SetupBody;
  try {
    body = (await req.json()) as SetupBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "Body không phải JSON hợp lệ." },
      { status: 400 }
    );
  }

  const mode = body.mode ?? "create";
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const displayName = body.displayName?.trim() || email.split("@")[0];

  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { success: false, error: "Email không hợp lệ." },
      { status: 400 }
    );
  }

  try {
    let uid: string;

    if (mode === "create") {
      if (password.length < 6) {
        return NextResponse.json(
          { success: false, error: "Mật khẩu tối thiểu 6 ký tự." },
          { status: 400 }
        );
      }
      try {
        const userRecord = await adminAuth.createUser({
          email,
          password,
          displayName,
        });
        uid = userRecord.uid;
      } catch (e) {
        const code = (e as { code?: string })?.code;
        let msg = e instanceof Error ? e.message : String(e);
        if (code === "auth/email-already-in-use") {
          msg =
            "Email này đã có tài khoản trong Firebase Auth. Dùng mode=promote thay thế.";
        }
        return NextResponse.json(
          { success: false, error: msg },
          { status: 400 }
        );
      }
    } else {
      // mode=promote
      try {
        const userRecord = await adminAuth.getUserByEmail(email);
        uid = userRecord.uid;
      } catch (e) {
        return NextResponse.json(
          {
            success: false,
            error: `Không tìm thấy user với email ${email}. Dùng mode=create để tạo mới.`,
          },
          { status: 404 }
        );
      }
    }

    // Ghi doc users/{uid} với role=admin (bypass rules vì dùng Admin SDK)
    await adminDb.collection("users").doc(uid).set(
      {
        id: uid,
        email,
        displayName,
        role: "admin",
        enrolledCourses: [],
        completedCourses: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      data: {
        uid,
        email,
        role: "admin",
      },
    });
  } catch (e) {
    console.error("[api/admin/setup-admin POST] error:", e);
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Internal error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  // GET chỉ để check trạng thái
  try {
    const exists = await hasAnyAdmin();
    return NextResponse.json({
      success: true,
      data: { hasAdmin: exists },
    });
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}