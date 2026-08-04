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
  Eye,
  Edit,
  CheckCircle2,
  XCircle,
  Award,
  BookOpen,
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
import { useAuth, useDebouncedValue } from "@/hooks";
import { apiGet, apiDelete } from "@/lib/api-client";

interface TestRow {
  id: string;
  testId: string;
  programId: string;
  programTitle: string;
  lessonId: string;
  lessonTitle: string;
  questionCount: number;
  passScore: number;
  createdAt: string;
  updatedAt?: string;
}

type ViewMode = "tests" | "results";

export default function AdminTestsPage() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("tests");

  // Test list state
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 250);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [allTests, setAllTests] = useState<TestRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const refetch = useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  // Fetch all tests from API
  useEffect(() => {
    let cancelled = false;
    const loadTests = async () => {
      if (allTests.length === 0) setIsLoading(true);
      setIsFetching(true);
      setError(null);
      try {
        const res = await apiGet<{ tests: TestRow[] }>("/api/admin/tests");
        if (cancelled) return;
        if (res.success && res.data) {
          setAllTests(res.data.tests || []);
        } else {
          setError((res as { error?: string }).error ?? "Lỗi tải danh sách test");
        }
      } catch (e) {
        if (!cancelled) {
          setError(`Không tải được danh sách test: ${e instanceof Error ? e.message : String(e)}`);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsFetching(false);
        }
      }
    };

    void loadTests();
    return () => { cancelled = true; };
  }, [refreshTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = useCallback(
    async (test: TestRow) => {
      if (!user || user.role !== "admin") {
        setError("Chỉ admin mới có quyền.");
        return;
      }
      const ok = window.confirm(
        `Xóa test "${test.lessonTitle}" trong chương trình "${test.programTitle}"?\nKhông thể khôi phục.`
      );
      if (!ok) return;
      setActionId(test.id);
      setError(null);
      try {
        // Delete test via API
        const res = await apiDelete(`/api/programs/${test.programId}/lessons/${test.lessonId}/test`);
        if (res.success) {
          setAllTests((prev) => prev.filter((t) => t.id !== test.id));
          setSuccess(`Đã xóa test "${test.lessonTitle}".`);
        } else {
          setError((res as { error?: string }).error ?? "Lỗi xóa test");
        }
      } catch (e) {
        setError(`Lỗi xóa: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setActionId(null);
      }
    },
    [user]
  );

  const filteredTests = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    if (q === "") return allTests;
    return allTests.filter(
      (t) =>
        t.lessonTitle.toLowerCase().includes(q) ||
        t.programTitle.toLowerCase().includes(q)
    );
  }, [allTests, debouncedSearch]);

  const testStats = useMemo(() => ({
    total: allTests.length,
    totalQuestions: allTests.reduce((sum, t) => sum + t.questionCount, 0),
  }), [allTests]);

  const showLoading = isLoading && allTests.length === 0;

  return (
    <PageContainer
      title="Quản lý Bài kiểm tra"
      description="Tổng hợp tất cả bài kiểm tra từ các chương trình đào tạo"
      breadcrumbs={[
        { label: "Quản trị", href: "/admin" },
        { label: "Bài kiểm tra" },
      ]}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={refetch} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Tải lại
          </Button>
          <Button asChild>
            <Link href="/admin/tests/results">
              <Award className="mr-2 h-4 w-4" />
              Xem kết quả
            </Link>
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

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tổng số test</p>
                <p className="text-3xl font-bold">{testStats.total}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <FileQuestion className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tổng câu hỏi</p>
                <p className="text-3xl font-bold">{testStats.totalQuestions}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Award className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Tìm kiếm test..."
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
      </div>

      {/* Tests Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bài kiểm tra</TableHead>
                <TableHead>Chương trình</TableHead>
                <TableHead>Số câu hỏi</TableHead>
                <TableHead>Điểm đạt</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {showLoading ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : filteredTests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    {allTests.length === 0
                      ? "Chưa có bài kiểm tra nào. Vào trang chương trình để thêm bài kiểm tra cho bài học."
                      : "Không tìm thấy bài kiểm tra phù hợp."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredTests.map((test) => {
                  const isActing = actionId === test.id;
                  return (
                    <TableRow key={test.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileQuestion className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{test.lessonTitle}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/programs/${test.programId}`}
                          className="hover:underline flex items-center gap-1"
                        >
                          <BookOpen className="h-3 w-3" />
                          {test.programTitle}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{test.questionCount}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{test.passScore}%</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {new Date(test.createdAt).toLocaleDateString("vi-VN")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                            title="Sửa test"
                          >
                            <Link href={`/admin/programs/${test.programId}`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
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
                              <DropdownMenuItem asChild>
                                <Link href={`/admin/programs/${test.programId}`}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  Xem chương trình
                                </Link>
                              </DropdownMenuItem>
                              {user?.role === "admin" && (
                                <DropdownMenuItem
                                  onClick={() => handleDelete(test)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Xóa
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
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
