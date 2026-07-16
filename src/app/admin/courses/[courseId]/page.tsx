"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Edit,
  Eye,
  FileText,
  BookOpen,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageContainer } from "@/components/layout";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";

interface PageProps {
  params: Promise<{ courseId: string }>;
}

export default function AdminCourseDetailPage({ params }: PageProps) {
  const { courseId } = use(params);
  const [course, setCourse] = useState<Record<string, unknown> | null>(null);
  const [lessons, setLessons] = useState<Array<Record<string, unknown>>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const snap = await getDoc(doc(db, "courses", courseId));
        if (!snap.exists()) {
          setError("Không tìm thấy khóa học.");
          setCourse(null);
          return;
        }
        setCourse({ id: snap.id, ...(snap.data() as Record<string, unknown>) });
        const lessonsSnap = await getDocs(
          collection(db, "courses", courseId, "lessons")
        );
        setLessons(
          lessonsSnap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Record<string, unknown>),
          }))
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [courseId]);

  if (isLoading) {
    return (
      <PageContainer
        title="Chi tiết khóa học"
        breadcrumbs={[
          { label: "Quản trị", href: "/admin" },
          { label: "Khóa học", href: "/admin/courses" },
          { label: "..." },
        ]}
      >
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-64 w-full" />
      </PageContainer>
    );
  }

  if (error || !course) {
    return (
      <PageContainer
        title="Chi tiết khóa học"
        breadcrumbs={[
          { label: "Quản trị", href: "/admin" },
          { label: "Khóa học", href: "/admin/courses" },
          { label: "..." },
        ]}
      >
        <Alert variant="destructive">
          <AlertDescription>{error || "Không tìm thấy khóa học."}</AlertDescription>
        </Alert>
        <Button asChild className="mt-4">
          <Link href="/admin/courses">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Quay lại
          </Link>
        </Button>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={(course.title as string) || "(không có tiêu đề)"}
      breadcrumbs={[
        { label: "Quản trị", href: "/admin" },
        { label: "Khóa học", href: "/admin/courses" },
        { label: (course.title as string) || "..." },
      ]}
      actions={
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/admin/courses/${courseId}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Chỉnh sửa
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/dashboard/courses/${courseId}`}>
              <Eye className="mr-2 h-4 w-4" />
              Xem như học viên
            </Link>
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Thông tin chung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <span className="font-medium">Mô tả:</span>{" "}
              <span className="text-muted-foreground">
                {(course.description as string) || "—"}
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              <Badge variant="secondary">
                Danh mục: {(course.category as string) || "—"}
              </Badge>
              <Badge variant="secondary">
                Trình độ: {(course.level as string) || "—"}
              </Badge>
              <Badge variant="outline">
                Trạng thái: {(course.status as string) || "—"}
              </Badge>
              <Badge variant="outline">
                Enrollment: {(course.enrollmentType as string) || "—"}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div>
                <span className="font-medium">Học viên:</span>{" "}
                {(course.enrolledCount as number) ?? 0}
              </div>
              <div>
                <span className="font-medium">Hoàn thành:</span>{" "}
                {(course.completedCount as number) ?? 0}
              </div>
              <div>
                <span className="font-medium">Điểm đạt:</span>{" "}
                {(course.passingScore as number) ?? "—"}%
              </div>
              <div>
                <span className="font-medium">Thời lượng:</span>{" "}
                {Math.round(((course.duration as number) ?? 0) / 60)} phút
              </div>
            </div>
            {Array.isArray(course.tags) && course.tags.length > 0 && (
              <div className="pt-2">
                <span className="font-medium">Tags:</span>{" "}
                <span className="text-muted-foreground">
                  {(course.tags as string[]).join(", ")}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Bài học ({lessons.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lessons.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Chưa có bài học nào.
              </p>
            ) : (
              <ul className="space-y-2">
                {lessons
                  .sort((a, b) => ((a.order as number) ?? 0) - ((b.order as number) ?? 0))
                  .map((l) => (
                    <li
                      key={l.id as string}
                      className="flex items-center gap-2 text-sm"
                    >
                      <FileText className="h-3 w-3 text-muted-foreground" />
                      <span className="flex-1">
                        {(l.title as string) || `(id: ${l.id})`}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {l.type as string}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}