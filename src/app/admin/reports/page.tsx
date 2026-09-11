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
  UserCheck,
  Mail,
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
import { useAuth } from "@/hooks";
import { programService, reportService } from "@/services/training";
import type {
  Program,
  ProgramReportSummary,
  TeamReportSummary,
} from "@/types/training";

type TabKey = "team" | "program";

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
  const isManager = user?.role === "manager";
  const isHr = user?.role === "hr";
  const isManagerOrAdmin = isAdmin || isManager;

  const searchParams = useSearchParams();
  const presetProgramId = searchParams.get("programId");
  const presetTab = (searchParams.get("tab") as TabKey | null) ?? null;

  // Manager mặc định vào tab "team"; Admin mặc định vào "program"; HR mặc định "team"
  const [tab, setTab] = useState<TabKey>(
    presetTab ?? (isAdmin ? "program" : "team")
  );
  const [selectedProgramId, setSelectedProgramId] = useState<string>(
    presetProgramId ?? ""
  );

  /* ─── Team progress ───────────────────────────────────────── */
  const {
    data: teamSummary,
    error: teamError,
    isLoading: isLoadingTeam,
    isFetching: isFetchingTeam,
  } = useQuery<TeamReportSummary | null>({
    queryKey: ["report", "team"],
    enabled: isManagerOrAdmin || isHr,
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const res = await reportService.teamProgress();
      if (!res.success) throw new Error(res.error ?? "Lỗi tải báo cáo team");
      return res.data as TeamReportSummary;
    },
  });

  /* ─── Programs list (cho tab program, admin/manager) ─────── */
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

  /* ─── Program report ──────────────────────────────────────── */
  const effectiveProgramId =
    selectedProgramId || presetProgramId || (programs[0]?.id ?? "");

  const {
    data: programSummary,
    error: programError,
    isLoading: isLoadingProgram,
    isFetching: isFetchingProgram,
  } = useQuery<ProgramReportSummary | null>({
    queryKey: ["report", "program", effectiveProgramId],
    enabled: isAdmin && tab === "program" && Boolean(effectiveProgramId),
    placeholderData: (prev) => prev,
    staleTime: 30 * 1000,
    queryFn: async () => {
      if (!effectiveProgramId) return null;
      const res = await reportService.programProgress(effectiveProgramId);
      if (!res.success) throw new Error(res.error ?? "Lỗi tải báo cáo");
      return res.data as ProgramReportSummary;
    },
  });

  const showAccessDenied =
    !isAdmin && !isManager && !isHr;

  if (showAccessDenied) {
    return (
      <PageContainer title="Báo cáo">
        <Alert variant="destructive">
          <AlertDescription>
            Bạn không có quyền truy cập trang báo cáo.
          </AlertDescription>
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Báo cáo tiến độ"
      description={
        isAdmin
          ? "Tổng quan toàn hệ thống theo chương trình và nhân viên"
          : isManager
            ? "Theo dõi tiến độ học tập của nhân viên thuộc quyền"
            : "Theo dõi tiến độ học tập của nhân viên"
      }
      showBreadcrumb={false}
    >
      {/* Tab switcher */}
      <div className="mb-4 inline-flex rounded-md border bg-muted/40 p-1 text-sm">
        <button
          type="button"
          onClick={() => setTab("team")}
          className={
            "flex items-center gap-2 rounded px-3 py-1.5 transition-colors " +
            (tab === "team"
              ? "bg-background text-foreground shadow"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          <UserCheck className="h-4 w-4" />
          Nhân viên
        </button>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setTab("program")}
            className={
              "flex items-center gap-2 rounded px-3 py-1.5 transition-colors " +
              (tab === "program"
                ? "bg-background text-foreground shadow"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            <BarChart3 className="h-4 w-4" />
            Chương trình
          </button>
        )}
      </div>

      {tab === "team" ? (
        <TeamReportView
          summary={teamSummary}
          error={teamError}
          isLoading={isLoadingTeam}
          isFetching={isFetchingTeam}
          isManager={isManager}
          isAdmin={isAdmin}
        />
      ) : (
        <ProgramReportView
          programs={programs}
          selectedProgramId={selectedProgramId}
          onSelectProgram={setSelectedProgramId}
          summary={programSummary}
          error={programError}
          isLoading={isLoadingProgram}
          isFetching={isFetchingProgram}
        />
      )}
    </PageContainer>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/*  TEAM VIEW                                                     */
/* ─────────────────────────────────────────────────────────────── */

function TeamReportView({
  summary,
  error,
  isLoading,
  isFetching,
  isManager,
  isAdmin,
}: {
  summary: TeamReportSummary | null | undefined;
  error: unknown;
  isLoading: boolean;
  isFetching: boolean;
  isManager: boolean;
  isAdmin: boolean;
}) {
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          <code className="text-xs">{String((error as Error)?.message ?? error)}</code>
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading && !summary) {
    return (
      <div className="grid gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  if (!summary) {
    return (
      <Alert>
        <AlertDescription>Không có dữ liệu.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {isManager
            ? "Tiến độ nhân viên thuộc quyền"
            : isAdmin
              ? "Tổng quan nhân viên (toàn hệ thống)"
              : "Tổng quan nhân viên"}
        </h2>
        {isFetching && (
          <span className="text-xs text-muted-foreground">Đang cập nhật...</span>
        )}
      </div>

      {/* Top stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Số nhân viên"
          value={summary.totalEmployees}
          color="text-blue-600"
        />
        <StatCard
          icon={BarChart3}
          label="CT đã gán"
          value={summary.totalAssigned}
          color="text-indigo-600"
        />
        <StatCard
          icon={TrendingUp}
          label="Đang học"
          value={summary.inProgress}
          color="text-orange-600"
        />
        <StatCard
          icon={Award}
          label="Tỷ lệ hoàn thành"
          value={`${summary.completionRate}%`}
          color="text-green-600"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Phân bổ trạng thái học tập
          </CardTitle>
          <CardDescription>
            Tổng quan {summary.totalAssigned} chương trình đã gán cho {summary.totalEmployees} nhân viên
            {typeof summary.averageTestScore === "number" && summary.averageTestScore > 0 && (
              <> · Điểm test TB: <strong>{summary.averageTestScore}%</strong></>
            )}
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

      {summary.members.length === 0 ? (
        <Alert>
          <AlertDescription>
            {isManager
              ? "Bạn chưa có nhân viên nào thuộc quyền quản lý."
              : "Chưa có dữ liệu nhân viên."}
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Danh sách nhân viên</CardTitle>
            <CardDescription>
              Bấm vào từng nhân viên để xem chi tiết tiến độ từng chương trình
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.members.map((m) => {
                const needsAttention =
                  m.totalAssigned > 0 &&
                  m.overallPercent < 50 &&
                  m.completed < m.totalAssigned;
                return (
                  <Link
                    key={m.userId}
                    href={`/admin/reports/user/${m.userId}`}
                    className="flex items-center justify-between rounded-md border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                        {(m.displayName ?? m.email ?? "?").slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          <span className="truncate">
                            {m.displayName ?? m.email}
                          </span>
                          {needsAttention && (
                            <Badge variant="destructive" className="text-[10px]">
                              Cần nhắc nhở
                            </Badge>
                          )}
                          {m.totalAssigned === 0 && (
                            <Badge variant="outline" className="text-[10px]">
                              Chưa gán CT
                            </Badge>
                          )}
                          {m.completed === m.totalAssigned && m.totalAssigned > 0 && (
                            <Badge variant="success" className="text-[10px]">
                              Hoàn thành tất cả
                            </Badge>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {m.email}
                          </span>
                          {m.department && <span>· {m.department}</span>}
                          <span>· {m.totalAssigned} CT đã gán</span>
                          {m.lastActivityAt && (
                            <span>
                              · Hoạt động:{" "}
                              {new Date(m.lastActivityAt).toLocaleDateString("vi-VN")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 pl-2">
                      <div className="hidden sm:block w-40">
                        <Progress value={m.overallPercent} className="h-2" />
                        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                          <span>{m.completed}/{m.totalAssigned} HT</span>
                          <span>{m.overallPercent}%</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <Badge
                          variant={
                            m.completed === m.totalAssigned && m.totalAssigned > 0
                              ? "success"
                              : m.inProgress > 0
                                ? "warning"
                                : "secondary"
                          }
                        >
                          {m.completed === m.totalAssigned && m.totalAssigned > 0
                            ? "Hoàn thành"
                            : m.inProgress > 0
                              ? "Đang học"
                              : "Chưa bắt đầu"}
                        </Badge>
                        {m.averageTestScore > 0 && (
                          <span className="mt-1 text-xs text-muted-foreground">
                            Test: {m.averageTestScore}%
                          </span>
                        )}
                      </div>
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
  );
}

/* ─────────────────────────────────────────────────────────────── */
/*  PROGRAM VIEW (admin only)                                     */
/* ─────────────────────────────────────────────────────────────── */

function ProgramReportView({
  programs,
  selectedProgramId,
  onSelectProgram,
  summary,
  error,
  isLoading,
  isFetching,
}: {
  programs: Program[];
  selectedProgramId: string;
  onSelectProgram: (id: string) => void;
  summary: ProgramReportSummary | null | undefined;
  error: unknown;
  isLoading: boolean;
  isFetching: boolean;
}) {
  return (
    <>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            <code className="text-xs">{String((error as Error)?.message ?? error)}</code>
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="text-sm font-medium">Chương trình:</label>
        <select
          className="flex h-10 max-w-md flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={selectedProgramId}
          onChange={(e) => onSelectProgram(e.target.value)}
        >
          <option value="">-- chọn --</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        {isFetching && (
          <span className="text-xs text-muted-foreground">Đang cập nhật...</span>
        )}
      </div>

      {!selectedProgramId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BarChart3 className="mx-auto mb-2 h-8 w-8 opacity-50" />
            Chọn chương trình để xem báo cáo.
          </CardContent>
        </Card>
      ) : isLoading && !summary ? (
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
                <CardTitle className="text-base">
                  Cần nhắc nhở ({summary.atRiskUsers.length})
                </CardTitle>
                <CardDescription>
                  Nhân viên chưa hoàn thành và có % tiến độ dưới 50%
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {summary.atRiskUsers.map((u) => (
                    <Link
                      key={u.userId}
                      href={`/admin/reports/user/${u.userId}`}
                      className="flex items-center justify-between rounded-md border p-2 transition-colors hover:bg-muted/50"
                    >
                      <div>
                        <div className="text-sm font-medium">
                          {u.displayName ?? u.email}
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
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/*  Shared building blocks                                        */
/* ─────────────────────────────────────────────────────────────── */

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
