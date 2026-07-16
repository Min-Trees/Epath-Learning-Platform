"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  ShieldCheck,
  BookOpen,
  ChevronRight,
  Database,
  Loader2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/layout";
import { useAuth, useCollection, fqOrderBy } from "@/hooks";

interface CourseListItem {
  id: string;
  title: string;
  description?: string;
  status?: string;
  level?: string;
  tags?: string[];
}

export default function AdminCoursesPage() {
  const { user } = useAuth();

  // React Query: fetch + cache + dedupe tự động
  const {
    data: courses = [],
    isLoading,
    error,
    refetch,
    isFetching,
  } = useCollection<CourseListItem & { id: string }>(
    "courses",
    [fqOrderBy("title")],
    ["by-title"]
  );

  const isAdmin = user?.role === "admin";
  const showLoading = isLoading && courses.length === 0;

  return (
    <PageContainer
      title="Quản lý khóa học"
      description="Chọn khóa học để quản lý bài học, tài liệu, quiz"
      breadcrumbs={[{ label: "Quản trị", href: "/admin" }, { label: "Khóa học" }]}
    >
      <div className="mb-4 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Tải lại
        </Button>
        <Button asChild>
          <Link href="/admin/seed-youtube-demo">
            <Database className="mr-2 h-4 w-4" />
            Seed khóa học demo YouTube
          </Link>
        </Button>
      </div>

      {!user && (
        <Alert variant="destructive">
          <AlertDescription>Bạn cần đăng nhập.</AlertDescription>
        </Alert>
      )}

      {user && !isAdmin && (
        <Alert variant="destructive">
          <AlertDescription>
            Bạn đang đăng nhập với role <strong>{user.role}</strong>. Chỉ{" "}
            <strong>admin</strong> mới có quyền truy cập.
          </AlertDescription>
        </Alert>
      )}

      {user && isAdmin && (
        <Alert className="border-green-500/50 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100 mb-4">
          <ShieldCheck className="h-4 w-4" />
          <AlertDescription>
            Đã đăng nhập với quyền <strong>admin</strong>.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            Lỗi: <code className="text-xs">{error instanceof Error ? error.message : String(error)}</code>
          </AlertDescription>
        </Alert>
      )}

      {showLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Chưa có khóa học nào trong Firestore. Bấm{" "}
            <strong>Seed khóa học demo YouTube</strong> ở trên để tạo nhanh.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {courses.map((c) => (
            <Card
              key={c.id}
              className="hover:border-primary/50 transition-colors"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <BookOpen className="h-4 w-4 text-primary" />
                      <code className="text-xs text-muted-foreground">
                        {c.id}
                      </code>
                      {c.status && (
                        <Badge variant="outline" className="text-xs">
                          {c.status}
                        </Badge>
                      )}
                      {c.level && (
                        <Badge variant="secondary" className="text-xs">
                          {c.level}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-lg">{c.title}</CardTitle>
                    {c.description && (
                      <CardDescription className="line-clamp-2">
                        {c.description}
                      </CardDescription>
                    )}
                    {c.tags && c.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {c.tags.slice(0, 5).map((t) => (
                          <Badge key={t} variant="outline" className="text-xs">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button asChild>
                    <Link href={`/admin/courses/${c.id}/lessons`}>
                      Quản lý bài học
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}