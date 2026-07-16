"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Circle,
  Loader2,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageContainer } from "@/components/layout";
import { reportService } from "@/services/training";
import type { UserReportSummary } from "@/types/training";

export default function AdminUserReportPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = use(params);
  const [summary, setSummary] = useState<UserReportSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await reportService.userProgress(userId);
        if (res.success) setSummary(res.data as UserReportSummary);
        else setError((res as { error?: string }).error ?? "Lỗi tải");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [userId]);

  return (
    <PageContainer
      title={summary?.displayName ?? "Báo cáo nhân viên"}
      description={summary?.email}
      breadcrumbs={[
        { label: "Quản trị", href: "/admin" },
        { label: "Báo cáo", href: "/admin/reports" },
        { label: summary?.displayName ?? "..." },
      ]}
      actions={
        <Button asChild variant="outline">
          <Link href="/admin/reports">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Quay lại
          </Link>
        </Button>
      }
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            <code className="text-xs">{error}</code>
          </AlertDescription>
        </Alert>
      )}
      {isLoading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : !summary ? (
        <Alert>
          <AlertDescription>Không có dữ liệu.</AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Đã gán" value={summary.totalAssigned} />
            <Stat label="Hoàn thành" value={summary.completed} color="text-green-600" />
            <Stat label="Đang học" value={summary.inProgress} color="text-orange-600" />
            <Stat label="Điểm TB test" value={`${summary.averageTestScore}%`} color="text-purple-600" />
          </div>

          {summary.programs.length === 0 ? (
            <Alert>
              <AlertDescription>Chưa được gán chương trình nào.</AlertDescription>
            </Alert>
          ) : (
            summary.programs.map((p) => (
              <Card key={p.programId}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle>{p.programTitle}</CardTitle>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>Trạng thái:</span>
                        <Badge
                          variant={
                            p.status === "completed"
                              ? "success"
                              : p.status === "in_progress"
                                ? "warning"
                                : "secondary"
                          }
                        >
                          {p.status === "completed"
                            ? "Hoàn thành"
                            : p.status === "in_progress"
                              ? "Đang học"
                              : "Chưa bắt đầu"}
                        </Badge>
                        <span>·</span>
                        <span>
                          Điểm TB:{" "}
                          <strong className="text-foreground">
                            {p.averageTestScore}%
                          </strong>
                        </span>
                      </div>
                    </div>
                    <span className="text-2xl font-bold shrink-0">{p.percent}%</span>
                  </div>
                  <Progress value={p.percent} className="mt-2 h-2" />
                </CardHeader>
                <CardContent>
                  {p.lessons.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Chưa có lesson nào.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {p.lessons.map((l) => (
                        <div
                          key={l.lessonId}
                          className="flex items-center justify-between rounded-md border p-2"
                        >
                          <div className="flex items-center gap-2">
                            {l.lessonStatus === "completed" ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : l.lessonStatus === "in_progress" ? (
                              <TrendingUp className="h-4 w-4 text-orange-600" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="text-sm">
                              #{l.order} · {l.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {typeof l.testScore === "number" ? (
                              <Badge
                                variant={l.testPassed ? "success" : "destructive"}
                              >
                                {l.testPassed ? (
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                ) : (
                                  <XCircle className="mr-1 h-3 w-3" />
                                )}
                                {l.testScore}% ({l.attemptCount} lần)
                              </Badge>
                            ) : (
                              <Badge variant="outline">Chưa làm test</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </PageContainer>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold ${color ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
