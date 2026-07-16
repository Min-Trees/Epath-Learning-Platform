import { NextRequest, NextResponse } from "next/server";
import { getCourses, getCourseById, createCourse, updateCourse, deleteCourse } from "@/services/course";
import type { CourseFilters } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const filters: CourseFilters = {
      category: searchParams.get("category") as CourseFilters["category"] || undefined,
      level: searchParams.get("level") as CourseFilters["level"] || undefined,
      status: searchParams.get("status") as CourseFilters["status"] || undefined,
      search: searchParams.get("search") || undefined,
    };

    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "10");

    const result = await getCourses({
      filters,
      pagination: { page, pageSize },
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get courses error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch courses" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    const courseId = await createCourse(data);

    return NextResponse.json({
      success: true,
      data: { courseId },
      message: "Course created successfully",
    });
  } catch (error) {
    console.error("Create course error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create course" },
      { status: 500 }
    );
  }
}
