"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Loader2,
  Award,
  FileText,
  Video,
  FileType,
  Play,
  Lock,
  Presentation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageContainer } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import {
  programService,
  progressService,
} from "@/services/training";
import type { Program, Lesson, LessonContentType, LessonProgress } from "@/types/training";

const TYPE_ICONS: Record<
  LessonContentType,
  React.ComponentType<{ className?: string }>
> = {
  text: FileText,
  video: Video,
  pdf: FileType,
  ppt: Presentation,
};

const TYPE_LABELS: Record<LessonContentType, string> = {
  text: "Văn bản",
  video: "Video",
  pdf: "PDF",
  ppt: "PPT (Slide)",
};

export default function EmployeeProgramDetailPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  const { user } = useAuth();

  const [program, setProgram] = useState<Program | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonProgress, setLessonProgress] = useState<LessonProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [progRes, progressRes] = await Promise.all([
        programService.get(programId),
        progressService.get(programId),
      ]);
      if (!progRes.success) {
        setError((progRes as { error?: string }).error ?? "Lỗi tải");
        return;
      }
      const data = progRes.data as { program: Program; lessons: Lesson[] };
      if (!data.program) {
        setError("Chương trình không tồn tại hoặc chưa được publish");
        return;
      }
      setProgram(data.program);
      const sortedLessons = ([...(data.lessons ?? [])] as Lesson[])
        .map((l) => ({
          ...l,
          createdAt: new Date(
            (l as { createdAt?: { toDate?: () => Date } | Date })
              .createdAt instanceof Date
              ? ((l as { createdAt: Date }).createdAt as unknown as Date)
              : ((l as { createdAt?: { toDate?: () => Date } }).createdAt
                  ?.toDate?.() ?? new Date())
          ),
        }))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setLessons(sortedLessons);
      if (progressRes.success) {
        setLessonProgress(
          ((progressRes.data as { lessons: LessonProgress[] }).lessons) ?? []
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    load();
  }, [load]);

  const progressMap = new Map(lessonProgress.map((lp) => [lp.id, lp]));
  const completed = lessons.filter(
    (l) => progressMap.get(l.id)?.lessonStatus === "completed"
  ).length;
  const percent = lessons.length > 0 ? Math.round((completed / lessons.length) * 100) : 0;

  if (isLoading) {
    return (
      <PageContainer title="...">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-32 w-full" />
      </PageContainer>
    );
  }

  if (!program) {
    return (
      <PageContainer title="Chương trình">
        <Alert variant="destructive">
          <AlertDescription>
            {error ?? "Chương trình không tồn tại hoặc chưa được gán."}
          </AlertDescription>
        </Alert>
        <Button asChild className="mt-4">
          <Link href="/dashboard/programs">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Quay lại
          </Link>
        </Button>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={program.title}
      description={program.description}
      breadcrumbs={[
        { label: "Chương trình của tôi", href: "/dashboard/programs" },
        { label: program.title },
      ]}
      actions={
        <Button asChild variant="outline">
          <Link href="/dashboard/programs">
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

      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tiến độ</CardTitle>
              <CardDescription>
                {completed}/{lessons.length} bài học đã hoàn thành
              </CardDescription>
            </div>
            <span className="text-2xl font-bold">{percent}%</span>
          </div>
          <Progress value={percent} className="mt-2 h-2" />
        </CardHeader>
      </Card>

      <div className="grid gap-2">
        {(() => {
          let previousCompleted = true;
          return lessons.map((l, idx) => {
            const Icon = TYPE_ICONS[l.contentType];
            const lp = progressMap.get(l.id);
            const isDone = lp?.lessonStatus === "completed";
            const isInProgress = lp?.lessonStatus === "in_progress";
            const locked = !previousCompleted;
            previousCompleted = isDone;
            const content = (
              <div
                className={`flex items-center gap-3 rounded-md border p-3 transition-colors ${
                  locked
                    ? "cursor-not-allowed border-dashed bg-muted/30 opacity-60"
                    : isDone
                      ? "border-green-500/30 hover:bg-muted/50"
                      : "hover:bg-muted/50"
                }`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                  {locked ? (
                    <Lock className="h-5 w-5 text-muted-foreground" />
                  ) : isDone ? (
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  ) : isInProgress ? (
                    <Circle className="h-6 w-6 text-orange-500" />
                  ) : (
                    <Circle className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <Badge variant="outline">#{l.order}</Badge>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">{l.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {locked
                      ? "Hoàn thành bài trước để mở khóa"
                      : `${TYPE_LABELS[l.contentType]}${
                          l.hasTest ? " · có bài test" : ""
                        }`}
                  </div>
                </div>
                {l.hasTest && !locked && (
                  <Award className="h-4 w-4 text-muted-foreground" />
                )}
                {lp?.testResult && !locked && (
                  <Badge
                    variant={lp.testResult.passed ? "success" : "destructive"}
                  >
                    {lp.testResult.score}%
                  </Badge>
                )}
              </div>
            );
            if (locked) {
              return (
                <div key={l.id} aria-disabled>
                  {content}
                </div>
              );
            }
            return (
              <Link
                key={l.id}
                href={`/dashboard/programs/${programId}/lessons/${l.id}`}
                prefetch={false}
              >
                {content}
              </Link>
            );
          });
        })()}
        {lessons.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Chương trình này chưa có bài học nào.
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
