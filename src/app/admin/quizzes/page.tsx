"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  MoreHorizontal,
  Trash2,
  FileQuestion,
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
import {
  useAuth,
  useCollection,
  useDebouncedValue,
} from "@/hooks";
import { doc, writeBatch, getDocs, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface QuizRow {
  id: string;
  courseId: string;
  courseTitle: string;
  title?: string;
  questionCount?: number;
  passingScore?: number;
  [k: string]: unknown;
}

export default function AdminQuizzesPage() {
  const { user } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 250);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Cache courses (dùng chung với page khác)
  const { data: courses = [] } = useCollection<{ id: string; title?: string }>(
    "courses"
  );

  // Fetch tất cả quizzes (subcollection của courses)
  const [allQuizzes, setAllQuizzes] = useState<QuizRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const refetch = useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      // Lần đầu: hiển thị loading. Các lần sau: fetch ngầm (không flash).
      if (allQuizzes.length === 0) setIsLoading(true);
      setIsFetching(true);
      try {
        const coursesSnap = await getDocs(collection(db, "courses"));
        if (cancelled) return;
        const rows: QuizRow[] = [];
        for (const courseDoc of coursesSnap.docs) {
          const quizzesSnap = await getDocs(
            collection(db, "courses", courseDoc.id, "quizzes")
          );
          if (cancelled) return;
          const courseData = courseDoc.data();
          const courseTitle =
            (courseData.title as string) || "(không có tiêu đề)";
          quizzesSnap.docs.forEach((d) => {
            const data = d.data() as Record<string, unknown>;
            const questions = Array.isArray(data.questions)
              ? (data.questions as unknown[]).length
              : (data.questionCount as number) ?? 0;
            rows.push({
              id: d.id,
              courseId: courseDoc.id,
              courseTitle,
              questionCount: questions,
              passingScore: data.passingScore as number | undefined,
              ...data,
            });
          });
        }
        if (!cancelled) {
          setAllQuizzes(rows);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            `Không tải được danh sách quiz: ${
              e instanceof Error ? e.message : String(e)
            }`
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsFetching(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [refreshTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return allQuizzes.filter(
      (qz) =>
        q === "" ||
        (qz.title ?? "").toLowerCase().includes(q) ||
        qz.courseTitle.toLowerCase().includes(q)
    );
  }, [allQuizzes, debouncedSearch]);

  const handleDelete = useCallback(
    async (quiz: QuizRow) => {
      if (!user || user.role !== "admin") {
        setError("Chỉ admin mới có quyền.");
        return;
      }
      const ok = window.confirm(
        `Xóa quiz "${(quiz.title as string) || quiz.id}"?\nKhông thể khôi phục.`
      );
      if (!ok) return;
      setActionId(`${quiz.courseId}/${quiz.id}`);
      setError(null);
      try {
        const { deleteDoc } = await import("firebase/firestore");
        await deleteDoc(
          doc(db, "courses", quiz.courseId, "quizzes", quiz.id)
        );
        // Optimistic remove
        setAllQuizzes((prev) =>
          prev.filter(
            (q) => !(q.courseId === quiz.courseId && q.id === quiz.id)
          )
        );
        setSuccess(`Đã xóa quiz "${(quiz.title as string) || quiz.id}".`);
      } catch (e) {
        setError(`Lỗi xóa: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setActionId(null);
      }
    },
    [user]
  );

  const handleDeleteAll = useCallback(async () => {
    if (!user || user.role !== "admin") {
      setError("Chỉ admin mới có quyền.");
      return;
    }
    const ok = window.confirm(
      `Xóa TẤT CẢ ${allQuizzes.length} quiz (trong mọi khóa học)?\nKhông thể khôi phục.`
    );
    if (!ok) return;
    setIsLoading(true);
    setError(null);
    try {
      const coursesSnap = await getDocs(collection(db, "courses"));
      for (const courseDoc of coursesSnap.docs) {
        const quizzesSnap = await getDocs(
          collection(db, "courses", courseDoc.id, "quizzes")
        );
        if (!quizzesSnap.empty) {
          const batch = writeBatch(db);
          quizzesSnap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      }
      setAllQuizzes([]);
      setSuccess("Đã xóa tất cả quiz.");
    } catch (e) {
      setError(`Lỗi xóa: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsLoading(false);
    }
  }, [user, allQuizzes.length]);

  const showLoading = isLoading && allQuizzes.length === 0;

  return (
    <PageContainer
      title="Quản lý Quiz"
      description="Tổng hợp tất cả quiz từ các khóa học"
      breadcrumbs={[
        { label: "Quản trị", href: "/admin" },
        { label: "Quizzes" },
      ]}
      actions={
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={refetch}
            disabled={isFetching}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
            Tải lại
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteAll}
            disabled={isLoading || allQuizzes.length === 0}
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
            placeholder="Tìm quiz..."
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quiz</TableHead>
                <TableHead>Thuộc khóa học</TableHead>
                <TableHead>Số câu hỏi</TableHead>
                <TableHead>Điểm đạt</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {showLoading ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-48" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-12" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-12" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-8 w-8" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    {allQuizzes.length === 0
                      ? "Chưa có quiz nào."
                      : "Không tìm thấy quiz phù hợp."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((quiz) => {
                  const key = `${quiz.courseId}/${quiz.id}`;
                  const isActing = actionId === key;
                  return (
                    <TableRow key={key}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileQuestion className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {(quiz.title as string) || `(id: ${quiz.id})`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/courses/${quiz.courseId}`}
                          className="hover:underline"
                        >
                          {quiz.courseTitle}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {quiz.questionCount ?? 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {quiz.passingScore ?? "—"}%
                      </TableCell>
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
                              onClick={() => handleDelete(quiz)}
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