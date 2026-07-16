import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

/**
 * /api/admin/check-doc?email=...
 * Đọc doc users/{uid} thật sự từ Firestore để debug.
 */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json(
      { success: false, error: "Thiếu ?email=" },
      { status: 400 }
    );
  }

  try {
    const ur = await adminAuth.getUserByEmail(email);
    const snap = await adminDb.collection("users").doc(ur.uid).get();
    return NextResponse.json({
      success: true,
      data: {
        uid: ur.uid,
        email: ur.email,
        emailVerified: ur.emailVerified,
        customClaims: ur.customClaims,
        docExists: snap.exists,
        docData: snap.exists ? snap.data() : null,
      },
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