"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  MoreHorizontal,
  Trash2,
  FileText,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageContainer } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  writeBatch,
} from "firebase/firestore";

interface LessonRow {
  id: string;
  courseId: string;
  courseTitle: string;
  title?: string;
  type?: string;
  order?: number;
  duration?: number;
  [k: string]: unknown;
}

export default function AdminLessonsPage() {
  const { user } = useAuth();
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchLessons = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const coursesSnap = await getDocs(collection(db, "courses"));
      const rows: LessonRow[] = [];
      for (const courseDoc of coursesSnap.docs) {
        const lessonsSnap = await getDocs(
          collection(db, "courses", courseDoc.id, "lessons")
        );
        const courseData = courseDoc.data();
        const courseTitle =
          (courseData.title as string) || "(không có tiêu đề)";
        lessonsSnap.docs.forEach((d) => {
          rows.push({
            id: d.id,
            courseId: courseDoc.id,
            courseTitle,
            ...(d.data() as Record<string, unknown>),
          });
        });
      }
      setLessons(rows);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Không tải được danh sách bài học: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  const filtered = lessons.filter((l) => {
    const q = searchQuery.toLowerCase();
    return (
      (l.title as string)?.toLowerCase().includes(q) ||
      l.courseTitle.toLowerCase().includes(q) ||
      (l.type as string)?.toLowerCase().includes(q)
    );
  });

  const handleDelete = async (lesson: LessonRow) => {
    if (!user || user.role !== "admin") {
      setError("Chỉ admin mới có quyền.");
      return;
    }
    const ok = window.confirm(
      `Xóa bài học "${(lesson.title as string) || lesson.id}"?\nKhông thể khôi phục.`
    );
    if (!ok) return;
    setActionId(`${lesson.courseId}/${lesson.id}`);
    setError(null);
    try {
      await deleteDoc(
        doc(db, "courses", lesson.courseId, "lessons", lesson.id)
      );
      setLessons((prev) =>
        prev.filter((l) => !(l.courseId === lesson.courseId && l.id === lesson.id))
      );
      setSuccess(`Đã xóa bài học "${(lesson.title as string) || lesson.id}".`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Lỗi xóa: ${msg}`);
    } finally {
      setActionId(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!user || user.role !== "admin") {
      setError("Chỉ admin mới có quyền.");
      return;
    }
    const ok = window.confirm(
      `Xóa TẤT CẢ ${lessons.length} bài học (trong mọi khóa học)?\nKhông thể khôi phục.`
    );
    if (!ok) return;
    setIsLoading(true);
    setError(null);
    try {
      const coursesSnap = await getDocs(collection(db, "courses"));
      for (const courseDoc of coursesSnap.docs) {
        const lessonsSnap = await getDocs(
          collection(db, "courses", courseDoc.id, "lessons")
        );
        if (!lessonsSnap.empty) {
          const batch = writeBatch(db);
          lessonsSnap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      }
      setLessons([]);
      setSuccess("Đã xóa tất cả bài học.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Lỗi xóa: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageContainer
      title="Quản lý bài học"
      description="Tổng hợp tất cả bài học từ các khóa học. Để tạo/sửa, mở khóa học tương ứng."
      breadcrumbs={[
        { label: "Quản trị", href: "/admin" },
        { label: "Bài học" },
      ]}
      actions={
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/courses">
              <FileText className="mr-2 h-4 w-4" />
              Mở theo khóa học
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={fetchLessons}
            disabled={isLoading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Tải lại
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteAll}
            disabled={isLoading || lessons.length === 0}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Xóa tất cả
          </Button>
        </div>
      }
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            <code className="text-xs">{error}</code>
          </AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="mb-4 border-green-500/50 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Tìm bài học..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bài học</TableHead>
                <TableHead>Thuộc khóa học</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Thứ tự</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-48" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-8" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-8 w-8" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    {lessons.length === 0
                      ? "Chưa có bài học nào."
                      : "Không tìm thấy bài học phù hợp."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((lesson) => {
                  const key = `${lesson.courseId}/${lesson.id}`;
                  const isActing = actionId === key;
                  return (
                    <TableRow key={key}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {(lesson.title as string) ||
                              `(id: ${lesson.id})`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/courses/${lesson.courseId}`}
                          className="hover:underline"
                        >
                          {lesson.courseTitle}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {(lesson.type as string) || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>{(lesson.order as number) ?? "—"}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={isActing}
                            >
                              {isActing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleDelete(lesson)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Xóa
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageContainer>
  );
}