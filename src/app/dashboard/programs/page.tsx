"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Award,
  Play,
  ChevronRight,
  Clock,
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
import { myProgramsService } from "@/services/training";

type ProgramItem = {
  assignmentId: string;
  userId: string;
  programId: string;
  status: string;
  program: { id: string; title: string; description: string; status: string } | null;
  progress?: { totalLessons: number; completedLessons: number; percent: number };
};

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "warning" | "success" }> = {
  not_started: { label: "Chưa bắt đầu", variant: "secondary" },
  in_progress: { label: "Đang học", variant: "warning" },
  completed: { label: "Hoàn thành", variant: "success" },
};

export default function EmployeeProgramsPage() {
  const { user } = useAuth();

  // React Query: cache programs của user 30s
  const {
    data: items = [],
    isLoading,
    error: rqError,
  } = useQuery({
    queryKey: ["me", "programs"],
    enabled: Boolean(user?.id),
    staleTime: 30 * 1000,
    queryFn: async () => {
      const res = await myProgramsService.list();
      if (!res.success) {
        throw new Error((res as { error?: string }).error ?? "Lỗi tải");
      }
      return (res.data as { items: ProgramItem[] }).items;
    },
  });

  const error = rqError ? (rqError instanceof Error ? rqError.message : String(rqError)) : null;

  const { assigned, inProgress, completed } = useMemo(() => {
    const a = items.filter((i) => i.program !== null);
    return {
      assigned: a,
      inProgress: a.filter((i) => i.status === "in_progress" || i.status === "not_started"),
      completed: a.filter((i) => i.status === "completed"),
    };
  }, [items]);

  return (
    <PageContainer
      title="Chương trình của tôi"
      description={`Xin chào ${user?.displayName ?? "bạn"}!`}
      breadcrumbs={[{ label: "Chương trình của tôi" }]}
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            <code className="text-xs">{error}</code>
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : assigned.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpen className="mb-2 h-12 w-12 text-muted-foreground/50" />
            <h3 className="font-semibold">Chưa có chương trình nào</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Admin sẽ gán chương trình cho bạn sớm.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {inProgress.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold">Đang học ({inProgress.length})</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {inProgress.map((p) => (
                  <ProgramCard key={p.assignmentId} item={p} />
                ))}
              </div>
            </div>
          )}
          {completed.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold">Đã hoàn thành ({completed.length})</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {completed.map((p) => (
                  <ProgramCard key={p.assignmentId} item={p} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}

function ProgramCard({ item }: { item: ProgramItem }) {
  if (!item.program) return null;
  const st = STATUS_LABEL[item.status] ?? STATUS_LABEL.not_started;
  const percent = item.progress?.percent ?? 0;
  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <CardTitle className="line-clamp-1 text-base">
              {item.program.title}
            </CardTitle>
            <CardDescription className="mt-1 line-clamp-2">
              {item.program.description || "Không có mô tả"}
            </CardDescription>
          </div>
          <Badge variant={st.variant}>{st.label}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Tiến độ</span>
              <span className="font-medium">
                {item.progress?.completedLessons ?? 0}/
                {item.progress?.totalLessons ?? 0} ({percent}%)
              </span>
            </div>
            <Progress value={percent} className="h-2" />
          </div>
          <Button asChild className="w-full">
            <Link href={`/dashboard/programs/${item.program.id}`}>
              {item.status === "not_started" ? (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Bắt đầu học
                </>
              ) : (
                <>
                  Tiếp tục
                  <ChevronRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
