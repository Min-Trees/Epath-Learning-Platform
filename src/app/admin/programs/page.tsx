"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Loader2,
  BookOpen,
  Users,
  CheckCircle2,
  AlertCircle,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Send,
  RotateCcw,
  Search,
  Filter,
  Calendar,
  BarChart3,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageContainer } from "@/components/layout";
import { useAuth } from "@/hooks";
import { programService } from "@/services/training";
import type { Program } from "@/types/training";
import { formatDateTime } from "@/utils";

export default function AdminProgramsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "manager";
  const canDelete = user?.role === "admin";
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "draft" | "published">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // React Query: cache programs 60s
  const {
    data: programs = [],
    isLoading,
    error: rqError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["programs", "list", "all"],
    enabled: isAdmin,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const res = await programService.list();
      if (!res.success || !res.data) {
        throw new Error((res as { error?: string }).error ?? "Lỗi tải chương trình");
      }
      const items = (res.data as { items: Program[] }).items ?? [];
      return items.map((p) => ({
        ...p,
        createdAt: new Date(
          (p as { createdAt?: { toDate?: () => Date } | Date })
            .createdAt instanceof Date
            ? ((p as { createdAt: Date }).createdAt as unknown as Date)
            : ((p as { createdAt?: { toDate?: () => Date } }).createdAt
                ?.toDate?.() ?? new Date())
        ),
      }));
    },
  });

  const filtered = useMemo(() => {
    let result = programs;
    
    // Filter by status
    if (filter !== "all") {
      result = result.filter((p) => p.status === filter);
    }
    
    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((p) => 
        p.title.toLowerCase().includes(query) ||
        (p.description ?? "").toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [programs, filter, searchQuery]);

  // Stats
  const stats = useMemo(() => ({
    total: programs.length,
    published: programs.filter((p) => p.status === "published").length,
    draft: programs.filter((p) => p.status === "draft").length,
  }), [programs]);

  const error = rqError ? (rqError instanceof Error ? rqError.message : String(rqError)) : null;

  const deleteProgram = useMutation({
    mutationFn: async (programId: string) => {
      const res = await programService.remove(programId);
      if (!res.success) {
        throw new Error((res as { error?: string }).error ?? "Xóa chương trình thất bại");
      }
      return programId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs", "list", "all"] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
    },
  });

  const handleDelete = (p: Program) => {
    if (!canDelete) return;
    const confirmed = window.confirm(
      `Xóa chương trình "${p.title}"?\n\nToàn bộ bài học, bài kiểm tra, lượt gán và tiến độ học viên sẽ bị xóa và không thể khôi phục.`
    );
    if (!confirmed) return;
    setDeletingId(p.id);
    deleteProgram.mutate(p.id, {
      onSettled: () => setDeletingId(null),
    });
  };

  return (
    <PageContainer
      title="Quản lý chương trình đào tạo"
      description="Tạo, chỉnh sửa và quản lý các chương trình đào tạo"
      showBreadcrumb={false}
      actions={
        isAdmin ? (
          <Button asChild>
            <Link href="/admin/programs/new">
              <Plus className="mr-2 h-4 w-4" />
              Tạo chương trình mới
            </Link>
          </Button>
        ) : null
      }
    >
      {user && !isAdmin && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            Bạn đang đăng nhập với role <strong>{user.role}</strong>. Chỉ{" "}
            <strong>admin</strong> hoặc <strong>manager</strong> mới có quyền truy cập.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <code className="text-xs">{error}</code>
          </AlertDescription>
        </Alert>
      )}

      {deleteProgram.isError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <code className="text-xs">
              {deleteProgram.error instanceof Error
                ? deleteProgram.error.message
                : String(deleteProgram.error)}
            </code>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Tổng số chương trình
                </p>
                <p className="text-3xl font-bold">{stats.total}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Đã publish
                </p>
                <p className="text-3xl font-bold text-green-600">{stats.published}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Bản nháp
                </p>
                <p className="text-3xl font-bold text-amber-600">{stats.draft}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Edit className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Tìm kiếm chương trình..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2">
          {(["all", "draft", "published"] as const).map((s) => (
            <Button
              key={s}
              variant={filter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(s)}
            >
              {s === "all" ? "Tất cả" : s === "draft" ? "Bản nháp" : "Đã publish"}
              {s !== "all" && (
                <Badge variant="secondary" className="ml-2">
                  {s === "draft" ? stats.draft : stats.published}
                </Badge>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Program List */}
      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">
              {searchQuery ? "Không tìm thấy chương trình" : "Chưa có chương trình nào"}
            </h3>
            <p className="text-muted-foreground mb-6">
              {searchQuery 
                ? `Không có kết quả cho "${searchQuery}"`
                : "Tạo chương trình đào tạo đầu tiên của bạn"}
            </p>
            {isAdmin && !searchQuery && (
              <Button asChild>
                <Link href="/admin/programs/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Tạo chương trình mới
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((p) => (
            <Card
              key={p.id}
              className="hover:border-primary/50 transition-all group"
            >
              <CardContent className="p-0">
                <div className="flex items-stretch">
                  {/* Left color bar */}
                  <div className={`
                    w-2 rounded-l-lg
                    ${p.status === "published" ? "bg-green-500" : "bg-amber-500"}
                  `} />
                  
                  {/* Content */}
                  <div className="flex-1 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge
                            variant={p.status === "published" ? "success" : "secondary"}
                            className="shrink-0"
                          >
                            {p.status === "published" ? "Đã publish" : "Bản nháp"}
                          </Badge>
                          <span className="text-xs text-muted-foreground truncate">
                            ID: {p.id.slice(0, 8)}...
                          </span>
                        </div>
                        <h3 className="text-xl font-semibold mb-1 group-hover:text-primary transition-colors">
                          {p.title}
                        </h3>
                        {p.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                            {p.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Tạo: {formatDateTime(p.createdAt)}
                          </span>
                          {p.publishedAt && (
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                              Publish: {formatDateTime(p.publishedAt)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/programs/${p.id}`}>
                            <Eye className="mr-1 h-4 w-4" />
                            Mở
                          </Link>
                        </Button>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/programs/${p.id}`}>
                                <Edit className="mr-2 h-4 w-4" />
                                Chỉnh sửa
                              </Link>
                            </DropdownMenuItem>
                            {isAdmin && (
                              <>
                                <DropdownMenuItem asChild>
                                  <Link href={`/admin/assignments?programId=${p.id}`}>
                                    <Users className="mr-2 h-4 w-4" />
                                    Gán cho nhân viên
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={`/admin/reports?programId=${p.id}`}>
                                    <BarChart3 className="mr-2 h-4 w-4" />
                                    Xem báo cáo
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={`/dashboard/programs/${p.id}`}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Xem như nhân viên
                                  </Link>
                                </DropdownMenuItem>
                              </>
                            )}
                            {canDelete && (
                              <>
                                <div className="my-1 h-px bg-border" />
                                <DropdownMenuItem
                                  onSelect={(e) => {
                                    e.preventDefault();
                                    handleDelete(p);
                                  }}
                                  disabled={deletingId === p.id}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  {deletingId === p.id ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="mr-2 h-4 w-4" />
                                  )}
                                  Xóa chương trình
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Quick Actions for empty state */}
      {!isLoading && programs.length > 0 && (
        <div className="mt-8 p-6 rounded-lg border bg-muted/30 text-center">
          <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">Cần hỗ trợ?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Xem hướng dẫn sử dụng hoặc liên hệ quản trị viên
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" asChild>
              <Link href="/admin/reports">
                <BarChart3 className="mr-2 h-4 w-4" />
                Xem báo cáo
              </Link>
            </Button>
            {isAdmin && (
              <Button asChild>
                <Link href="/admin/users">
                  <Users className="mr-2 h-4 w-4" />
                  Quản lý người dùng
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
