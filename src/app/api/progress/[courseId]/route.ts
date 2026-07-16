import { NextRequest, NextResponse } from "next/server";
import { getUserProgress, calculateCourseProgress, markLessonComplete } from "@/services/progress";

interface RouteParams {
  params: Promise<{ courseId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { courseId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId is required" },
        { status: 400 }
      );
    }

    const progress = await getUserProgress(userId, courseId);

    return NextResponse.json({
      success: true,
      data: progress,
    });
  } catch (error) {
    console.error("Get progress error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch progress" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { courseId } = await params;
    const { userId, lessonId } = await request.json();

    if (!userId || !lessonId) {
      return NextResponse.json(
        { success: false, error: "userId and lessonId are required" },
        { status: 400 }
      );
    }

    await markLessonComplete(userId, courseId, lessonId);

    return NextResponse.json({
      success: true,
      message: "Lesson marked as complete",
    });
  } catch (error) {
    console.error("Mark complete error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to mark lesson as complete" },
      { status: 500 }
    );
  }
}
