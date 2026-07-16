import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function POST(request: NextRequest) {
  try {
    const { email, password, displayName, role } = await request.json();

    if (!email || !password || !displayName) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const credential = await createUserWithEmailAndPassword(auth, email, password);

    await updateProfile(credential.user, { displayName });

    const userData = {
      id: credential.user.uid,
      email,
      displayName,
      role: role || "employee",
      enrolledCourses: [],
      completedCourses: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isActive: true,
    };

    await setDoc(doc(db, "users", credential.user.uid), userData);

    return NextResponse.json({
      success: true,
      data: { userId: credential.user.uid },
      message: "User registered successfully",
    });
  } catch (error: unknown) {
    console.error("Registration error:", error);
    const errorMessage = error instanceof Error ? error.message : "Registration failed";

    let statusCode = 500;
    if (errorMessage.includes("email-already-in-use")) {
      statusCode = 400;
    } else if (errorMessage.includes("weak-password")) {
      statusCode = 400;
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: statusCode }
    );
  }
}
