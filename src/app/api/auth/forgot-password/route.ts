import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/firebase";
import { sendPasswordResetEmail } from "firebase/auth";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    await sendPasswordResetEmail(auth, email);

    return NextResponse.json({
      success: true,
      message: "Password reset email sent",
    });
  } catch (error: unknown) {
    console.error("Password reset error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to send reset email";

    let statusCode = 500;
    if (errorMessage.includes("user-not-found")) {
      statusCode = 404;
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: statusCode }
    );
  }
}
