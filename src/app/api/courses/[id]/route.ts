import { NextRequest, NextResponse } from "next/server";
import { getCourseById, updateCourse, deleteCourse, enrollInCourse } from "@/services/course";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const course = await getCourseById(id);

    if (!course) {
      return NextResponse.json(
        { success: false, error: "Course not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: course,
    });
  } catch (error) {
    console.error("Get course error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch course" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const data = await request.json();

    await updateCourse(id, data);

    return NextResponse.json({
      success: true,
      message: "Course updated successfully",
    });
  } catch (error) {
    console.error("Update course error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update course" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await deleteCourse(id);

    return NextResponse.json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error) {
    console.error("Delete course error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete course" },
      { status: 500 }
    );
  }
}
