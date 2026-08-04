"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Award,
  BarChart3,
  Calendar,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageContainer } from "@/components/layout";
import { useAuth, useDebouncedValue } from "@/hooks";
import { apiGet } from "@/lib/api-client";

interface TestResult {
  id: string;
  progressId: string;
  userId: string;
  displayName?: string;
  email: string;
  programId: string;
  programTitle: string;
  lessonId: string;
  lessonTitle: string;
  score: number;
  passed: boolean;
  attemptCount: number;
  completedAt: string;
}

const ITEMS_PER_PAGE = 20;

export default function TestResultsPage() {
  const { user } = useAuth();

  // Filter states
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [selectedProgram, setSelectedProgram] = useState<string>("all");
  const [selectedLesson, setSelectedLesson] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  // Data states
  const [allResults, setAllResults] = useState<TestResult[]>([]);
  const [programs, setPrograms] = useState<{ id: string; title: string }[]>([]);
  const [lessons, setLessons] = useState<{ id: string; title: string; programId: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  const refetch = () => {
    setRefreshTick((t) => t + 1);
  };

  // Load all test results from API
  useEffect(() => {
    let cancelled = false;
    const loadResults = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await apiGet<{ results: TestResult[] }>("/api/admin/tests/results");
        if (cancelled) return;
        if (res.success && res.data) {
          const results = res.data.results || [];
          setAllResults(results);

          // Extract unique programs and lessons
          const programsMap = new Map<string, string>();
          const lessonsList: { id: string; title: string; programId: string }[] = [];
          const lessonsMap = new Set<string>();

          results.forEach((r) => {
            if (!programsMap.has(r.programId)) {
              programsMap.set(r.programId, r.programTitle);
            }
            const lessonKey = `${r.programId}_${r.lessonId}`;
            if (!lessonsMap.has(lessonKey)) {
              lessonsMap.add(lessonKey);
              lessonsList.push({
                id: r.lessonId,
                title: r.lessonTitle,
                programId: r.programId,
              });
            }
          });

          setPrograms(Array.from(programsMap.entries()).map(([id, title]) => ({ id, title })));
          setLessons(lessonsList);
        } else {
          setError((res as { error?: string }).error ?? "Lỗi tải kết quả");
        }
      } catch (e) {
        if (!cancelled) {
          setError(`Không tải được kết quả: ${e instanceof Error ? e.message : String(e)}`);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadResults();
    return () => { cancelled = true; };
  }, [refreshTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter results based on search and filters
  const filteredResults = useMemo(() => {
    let results = allResults;

    // Search filter
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      results = results.filter(
        (r) =>
          r.displayName?.toLowerCase().includes(searchLower) ||
          r.email.toLowerCase().includes(searchLower) ||
          r.programTitle.toLowerCase().includes(searchLower) ||
          r.lessonTitle.toLowerCase().includes(searchLower)
      );
    }

    // Program filter
    if (selectedProgram !== "all") {
      results = results.filter((r) => r.programId === selectedProgram);
    }

    // Lesson filter
    if (selectedLesson !== "all") {
      results = results.filter((r) => r.lessonId === selectedLesson);
    }

    // Status filter
    if (selectedStatus === "passed") {
      results = results.filter((r) => r.passed);
    } else if (selectedStatus === "failed") {
      results = results.filter((r) => !r.passed);
    }

    return results;
  }, [allResults, debouncedSearch, selectedProgram, selectedLesson, selectedStatus]);

  // Pagination
  const totalPages = Math.ceil(filteredResults.length / ITEMS_PER_PAGE);
  const paginatedResults = filteredResults.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedProgram, selectedLesson, selectedStatus]);

  // Stats
  const stats = useMemo(() => {
    const passed = filteredResults.filter((r) => r.passed).length;
    const failed = filteredResults.filter((r) => !r.passed).length;
    const total = filteredResults.length;
    const averageScore = total > 0
      ? Math.round(filteredResults.reduce((sum, r) => sum + r.score, 0) / total)
      : 0;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

    return { passed, failed, total, averageScore, passRate };
  }, [filteredResults]);

  // Available lessons based on selected program
  const availableLessons = useMemo(() => {
    if (selectedProgram === "all") return lessons;
    return lessons.filter((l) => l.programId === selectedProgram);
  }, [lessons, selectedProgram]);

  if (isLoading && allResults.length === 0) {
    return (
      <PageContainer title="Kết quả bài kiểm tra" description="Xem chi tiết kết quả làm bài của nhân viên">
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Kết quả bài kiểm tra"
      description="Xem chi tiết kết quả làm bài kiểm tra của nhân viên"
      breadcrumbs={[
        { label: "Quản trị", href: "/admin" },
        { label: "Bài kiểm tra", href: "/admin/tests" },
        { label: "Kết quả" },
      ]}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={refetch}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Tải lại
          </Button>
        </div>
      }
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tổng lượt thi</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Đạt</p>
                <p className="text-2xl font-bold text-green-600">{stats.passed}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Chưa đạt</p>
                <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Điểm TB</p>
                <p className="text-2xl font-bold">{stats.averageScore}%</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tỷ lệ đạt</p>
                <p className="text-2xl font-bold">{stats.passRate}%</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Award className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-5">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Tìm theo tên, email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedProgram} onValueChange={(v) => { setSelectedProgram(v); setSelectedLesson("all"); }}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn chương trình" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả chương trình</SelectItem>
                {programs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedLesson} onValueChange={setSelectedLesson}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn bài học" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả bài học</SelectItem>
                {availableLessons.map((l) => (
                  <SelectItem key={`${l.programId}_${l.id}`} value={l.id}>{l.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="passed">Đạt</SelectItem>
                <SelectItem value="failed">Chưa đạt</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Danh sách kết quả
              </CardTitle>
              <CardDescription>
                Hiển thị {paginatedResults.length} / {filteredResults.length} kết quả
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {paginatedResults.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {allResults.length === 0
                ? "Chưa có kết quả làm bài nào."
                : "Không tìm thấy kết quả phù hợp."}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">Người dùng</th>
                      <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">Chương trình</th>
                      <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">Bài học</th>
                      <th className="text-center py-3 px-4 font-medium text-sm text-muted-foreground">Điểm</th>
                      <th className="text-center py-3 px-4 font-medium text-sm text-muted-foreground">Kết quả</th>
                      <th className="text-center py-3 px-4 font-medium text-sm text-muted-foreground">Số lần</th>
                      <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">Ngày nộp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedResults.map((result) => (
                      <tr key={result.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                              {(result.displayName || result.email).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                {result.displayName || "Người dùng"}
                              </p>
                              <p className="text-xs text-muted-foreground">{result.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm">{result.programTitle}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm">{result.lessonTitle}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant={result.score >= 70 ? "default" : "secondary"} className="font-mono">
                            {result.score}%
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {result.passed ? (
                            <Badge variant="success" className="flex items-center gap-1 w-fit mx-auto">
                              <CheckCircle2 className="h-3 w-3" />
                              Đạt
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="flex items-center gap-1 w-fit mx-auto">
                              <XCircle className="h-3 w-3" />
                              Chưa
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-sm text-muted-foreground">
                            #{result.attemptCount}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(result.completedAt).toLocaleDateString("vi-VN")}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Trang {currentPage} / {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Trước
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className="w-8 h-8 p-0"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Sau
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
