"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Clock,
  TrendingUp,
  Play,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageContainer } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { myProgramsService } from "@/services/training";

type ProgramItem = {
  assignmentId: string;
  userId: string;
  programId: string;
  status: string;
  program: {
    id: string;
    title: string;
    description: string;
    status: string;
    groupId?: string | null;
  } | null;
  progress?: { totalLessons: number; completedLessons: number; percent: number };
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [assignedPrograms, setAssignedPrograms] = useState<ProgramItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setIsLoading(true);
      setError(null);
      try {
        // Chỉ lấy các chương trình đã được admin gán cho user
        const res = await myProgramsService.list();
        if (res.success && res.data) {
          const items = ((res.data as { items: ProgramItem[] }).items ?? [])
            .filter((i) => i.program !== null);
          setAssignedPrograms(items);
        } else {
          setError((res as { error?: string }).error ?? "Lỗi tải chương trình");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setIsLoading(false);
      }
    };
    void fetchData();
  }, [user]);

  const inProgress = assignedPrograms.filter(
    (p) => p.status === "in_progress" || p.status === "not_started"
  );
  const completed = assignedPrograms.filter((p) => p.status === "completed");

  const stats = {
    assignedPrograms: assignedPrograms.length,
    inProgressPrograms: inProgress.length,
    completedPrograms: completed.length,
    averageProgress:
      assignedPrograms.length === 0
        ? 0
        : Math.round(
            assignedPrograms.reduce((s, p) => s + (p.progress?.percent ?? 0), 0) /
              assignedPrograms.length
          ),
  };

  const statCards = [
    {
      title: "Chương trình được gán",
      value: stats.assignedPrograms,
      icon: BookOpen,
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/20",
    },
    {
      title: "Đang học",
      value: stats.inProgressPrograms,
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-100 dark:bg-orange-900/20",
    },
    {
      title: "Hoàn thành",
      value: stats.completedPrograms,
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-900/20",
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="success">Hoàn thành</Badge>;
      case "in_progress":
        return <Badge variant="warning">Đang học</Badge>;
      default:
        return <Badge variant="secondary">Chưa bắt đầu</Badge>;
    }
  };

  return (
    <PageContainer
      title={`Xin chào, ${user?.displayName || "User"}!`}
      description="Các chương trình đã được admin gán cho bạn"
      showBreadcrumb={false}
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            <code className="text-xs">{error}</code>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Grid */}
      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className={`rounded-lg p-3 ${stat.bgColor}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-8 w-16" />
                ) : (
                  <p className="text-2xl font-bold">{stat.value}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Continue Learning */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Chương trình của tôi</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/programs">
                  Xem tất cả
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-20 w-32 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-2 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : assignedPrograms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <BookOpen className="h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 font-semibold">Chưa có chương trình nào</h3>
                  <p className="mt-2 text-sm text-muted-foreground max-w-md">
                    Bạn chưa được gán chương trình nào. Vui lòng liên hệ admin để được gán chương trình đào tạo.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {assignedPrograms.slice(0, 4).map((p) => {
                    if (!p.program) return null;
                    const percent = p.progress?.percent ?? 0;
                    const completed = p.progress?.completedLessons ?? 0;
                    const total = p.progress?.totalLessons ?? 0;
                    return (
                      <div
                        key={p.assignmentId}
                        className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row"
                      >
                        <div className="h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-muted">
                          <div className="flex h-full w-full items-center justify-center bg-primary/10">
                            <BookOpen className="h-8 w-8 text-primary" />
                          </div>
                        </div>
                        <div className="flex flex-1 flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold">{p.program.title}</h3>
                              {getStatusBadge(p.status)}
                            </div>
                            {p.program.description && (
                              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                                {p.program.description}
                              </p>
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-4">
                            <div className="flex-1">
                              <div className="mb-1 flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">
                                  {completed}/{total} bài học
                                </span>
                                <span className="font-medium">{percent}%</span>
                              </div>
                              <Progress value={percent} className="h-2" />
                            </div>
                            <Button size="sm" asChild>
                              <Link href={`/dashboard/programs/${p.program.id}`}>
                                <Play className="mr-1 h-4 w-4" />
                                {p.status === "not_started" ? "Bắt đầu" : "Tiếp tục"}
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tổng quan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Tiến độ trung bình</span>
                  <span className="font-medium">{stats.averageProgress}%</span>
                </div>
                <Progress value={stats.averageProgress} className="h-2" />
              </div>
              <div className="pt-2 border-t space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Đang học</span>
                  <span className="font-medium">{stats.inProgressPrograms}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Hoàn thành</span>
                  <span className="font-medium">{stats.completedPrograms}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Thao tác nhanh</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-between" asChild>
                <Link href="/dashboard/programs">
                  <span className="flex items-center">
                    <BookOpen className="mr-2 h-4 w-4" />
                    Tất cả chương trình
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-between" asChild>
                <Link href="/dashboard/profile">
                  <span className="flex items-center">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Tiến độ của tôi
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
