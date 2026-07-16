"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  Loader2,
  BookOpen,
  ChevronRight,
  AlertCircle,
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
import { PageContainer } from "@/components/layout";
import { useAuth } from "@/hooks";
import { programService } from "@/services/training";
import type { Program } from "@/types/training";

export default function AdminProgramsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [filter, setFilter] = useState<"all" | "draft" | "published">("all");

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
    if (filter === "all") return programs;
    return programs.filter((p) => p.status === filter);
  }, [programs, filter]);

  const error = rqError ? (rqError instanceof Error ? rqError.message : String(rqError)) : null;

  return (
    <PageContainer
      title="Quản lý chương trình"
      description="Tạo, chỉnh sửa, publish chương trình training"
      breadcrumbs={[
        { label: "Quản trị", href: "/admin" },
        { label: "Chương trình" },
      ]}
      actions={
        isAdmin ? (
          <Button asChild>
            <Link href="/admin/programs/new">
              <Plus className="mr-2 h-4 w-4" />
              Tạo chương trình
            </Link>
          </Button>
        ) : null
      }
    >
      {user && !isAdmin && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            Bạn đang đăng nhập với role <strong>{user.role}</strong>. Chỉ{" "}
            <strong>admin</strong> mới có quyền truy cập.
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

      <div className="mb-4 flex gap-2">
        {(["all", "draft", "published"] as const).map((s) => (
          <Button
            key={s}
            variant={filter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(s)}
          >
            {s === "all" ? "Tất cả" : s === "draft" ? "Bản nháp" : "Đã publish"}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Chưa có chương trình nào.{" "}
            {isAdmin && (
              <Button asChild variant="link" className="px-1">
                <Link href="/admin/programs/new">Tạo chương trình đầu tiên</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((p) => (
            <Card
              key={p.id}
              className="hover:border-primary/50 transition-colors"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-primary" />
                      <code className="text-xs text-muted-foreground">
                        {p.id}
                      </code>
                      <Badge
                        variant={p.status === "published" ? "default" : "secondary"}
                      >
                        {p.status === "published" ? "Đã publish" : "Bản nháp"}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg">{p.title}</CardTitle>
                    {p.description && (
                      <CardDescription className="line-clamp-2">
                        {p.description}
                      </CardDescription>
                    )}
                  </div>
                  <Button asChild>
                    <Link href={`/admin/programs/${p.id}`}>
                      Mở
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
