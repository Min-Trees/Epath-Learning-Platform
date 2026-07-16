"use client";

import { useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  TrendingUp,
  Award,
  Users,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageContainer } from "@/components/layout";
import { useAuth, useCollection } from "@/hooks";
import { programService, reportService } from "@/services/training";
import type { Program, ProgramReportSummary } from "@/types/training";
import type { User } from "@/types";

export default function AdminReportsPage() {
  return (
    <Suspense fallback={<div className="p-6">Đang tải...</div>}>
      <AdminReportsPageInner />
    </Suspense>
  );
}

function AdminReportsPageInner() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const searchParams = useSearchParams();
  const presetProgramId = searchParams.get("programId");

  const [selectedProgramId, setSelectedProgramId] = useState<string>(
    presetProgramId ?? ""
  );

  // React Query: programs (cache 30s, dedupe)
  const { data: programsData } = useQuery({
    queryKey: ["programs", "list", "published"],
    enabled: isAdmin,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const res = await programService.list();
      if (!res.success) throw new Error(res.error ?? "Lỗi tải programs");
      const items = ((res.data as { items: Program[] }).items ?? []).filter(
        (p) => p.status === "published"
      );
      return items;
    },
  });
  const programs = programsData ?? [];

  // Auto-select first program nếu chưa có
  const effectiveProgramId =
    selectedProgramId || presetProgramId || (programs[0]?.id ?? "");

  // React Query: report cho program đang chọn (cache theo id)
  const {
    data: summary,
    error: reportError,
    isLoading: isLoadingReport,
    isFetching: isFetchingReport,
  } = useQuery<ProgramReportSummary | null>({
    queryKey: ["report", "program", effectiveProgramId],
    enabled: isAdmin && Boolean(effectiveProgramId),
    placeholderData: (prev) => prev, // cache hit khi đổi program
    staleTime: 30 * 1000,
    queryFn: async () => {
      if (!effectiveProgramId) return null;
      const res = await reportService.programProgress(effectiveProgramId);
      if (!res.success) throw new Error(res.error ?? "Lỗi tải báo cáo");
      return res.data as ProgramReportSummary;
    },
  });

  // React Query: users (cache chung với admin/users)
  const { data: users = [] } = useCollection<User & { id: string }>("users", [], [
    "all-for-report",
  ]);
  const userMap = useMemo(() => {
    const m: Record<string, User> = {};
    for (const u of users) m[u.id] = u;
    return m;
  }, [users]);

  if (!isAdmin) {
    return (
      <PageContainer title="Báo cáo">
        <Alert variant="destructive">
          <AlertDescription>Chỉ admin mới có quyền truy cập.</AlertDescription>
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Báo cáo tiến độ"
      description="Tổng quan theo chương trình và nhân viên"
      breadcrumbs={[
        { label: "Quản trị", href: "/admin" },
        { label: "Báo cáo" },
      ]}
    >
      {reportError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            <code className="text-xs">{String(reportError.message ?? reportError)}</code>
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="text-sm font-medium">Chương trình:</label>
        <select
          className="flex h-10 max-w-md flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={selectedProgramId}
          onChange={(e) => setSelectedProgramId(e.target.value)}
        >
          <option value="">-- chọn --</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </div>

      {!selectedProgramId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BarChart3 className="mx-auto mb-2 h-8 w-8 opacity-50" />
            Chọn chương trình để xem báo cáo.
          </CardContent>
        </Card>
      ) : isLoadingReport && !summary ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : !summary ? (
        <Alert>
          <AlertDescription>Không có dữ liệu báo cáo.</AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-6">
          {/* Top stats */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Users}
              label="Đã gán"
              value={summary.totalAssigned}
              color="text-blue-600"
            />
            <StatCard
              icon={TrendingUp}
              label="Đang học"
              value={summary.inProgress}
              color="text-orange-600"
            />
            <StatCard
              icon={Award}
              label="Hoàn thành"
              value={summary.completed}
              color="text-green-600"
            />
            <StatCard
              icon={BarChart3}
              label="Tỷ lệ hoàn thành"
              value={`${summary.completionRate}%`}
              color="text-purple-600"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{summary.programTitle}</CardTitle>
              <CardDescription>
                Tổng quan tiến độ - điểm test trung bình:{" "}
                <strong>{summary.averageTestScore}%</strong>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-3">
                <Phase label="Chưa bắt đầu" value={summary.notStarted} total={summary.totalAssigned} variant="secondary" />
                <Phase label="Đang học" value={summary.inProgress} total={summary.totalAssigned} variant="warning" />
                <Phase label="Hoàn thành" value={summary.completed} total={summary.totalAssigned} variant="success" />
              </div>
            </CardContent>
          </Card>

          {summary.atRiskUsers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cần nhắc nhở ({summary.atRiskUsers.length})</CardTitle>
                <CardDescription>
                  Nhân viên chưa hoàn thành và có % tiến độ dưới 50%
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {summary.atRiskUsers.map((u) => {
                    const fullUser = userMap[u.userId];
                    return (
                      <Link
                        key={u.userId}
                        href={`/admin/reports/user/${u.userId}`}
                        className="flex items-center justify-between rounded-md border p-2 transition-colors hover:bg-muted/50"
                      >
                        <div>
                          <div className="text-sm font-medium">
                            {u.displayName ?? fullUser?.displayName ?? u.email}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {u.email}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              u.status === "in_progress" ? "warning" : "secondary"
                            }
                          >
                            {u.status === "in_progress" ? "Đang học" : "Chưa bắt đầu"}
                          </Badge>
                          <span className="w-12 text-right text-sm">{u.percent}%</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </PageContainer>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Icon className={`h-6 w-6 ${color}`} />
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Phase({
  label,
  value,
  total,
  variant,
}: {
  label: string;
  value: number;
  total: number;
  variant: "secondary" | "warning" | "success";
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="font-semibold">
          {value} ({percent}%)
        </span>
      </div>
      <Progress value={percent} className="h-2" />
    </div>
  );
}
