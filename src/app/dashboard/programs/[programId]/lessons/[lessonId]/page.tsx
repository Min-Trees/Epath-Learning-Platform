"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Award,
  Loader2,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  lessonService,
  progressService,
  testService,
} from "@/services/training";
import type {
  Lesson,
  PublicTest,
  TestSubmitResult,
} from "@/types/training";

// Lazy load heavy video/pdf components
const SecureVideoPlayer = dynamic(
  () => import("@/components/video/secure-video-player").then((m) => m.SecureVideoPlayer),
  {
    loading: () => <Skeleton className="aspect-video w-full" />,
    ssr: false,
  }
);

const SecurePdfViewer = dynamic(
  () => import("@/components/video/secure-pdf-viewer").then((m) => m.SecurePdfViewer),
  {
    loading: () => <Skeleton className="h-96 w-full" />,
    ssr: false,
  }
);

export default function EmployeeLessonPage({
  params,
}: {
  params: Promise<{ programId: string; lessonId: string }>;
}) {
  const { programId, lessonId } = use(params);

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Test
  const [test, setTest] = useState<PublicTest | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [submitResult, setSubmitResult] = useState<TestSubmitResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mark complete
  const [isMarkingComplete, setIsMarkingComplete] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Khi server trả 403 vì admin chưa gán chương trình, ta hiện banner
  // nhẹ + retry định kỳ (có thể admin vừa gán xong). Không spam toast.
  const [assignmentMissing, setAssignmentMissing] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await lessonService.get(programId, lessonId);
      if (!res.success) {
        setError((res as { error?: string }).error ?? "Lỗi tải lesson");
        return;
      }
      const l = res.data as Lesson;
      setLesson(l);
      if (l.hasTest) {
        const tRes = await testService.get(programId, lessonId);
        if (tRes.success && tRes.data) {
          const t = tRes.data as PublicTest;
          setTest(t);
          setAnswers(new Array(t.questions.length).fill(-1));
        }
      }
      // Check progress
      const pRes = await progressService.get(programId);
      if (pRes.success) {
        const lp = ((pRes.data as { lessons: { id: string; lessonStatus: string }[] })
          .lessons) ?? [];
        const cur = lp.find((x) => x.id === lessonId);
        if (cur?.lessonStatus === "completed") setIsCompleted(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }, [programId, lessonId]);

  useEffect(() => {
    load();
  }, [load]);

  // Đánh dấu in_progress khi mở lesson.
  // Nếu 403 (admin chưa gán chương trình), ta KHÔNG spam console mà bật
  // banner và retry sau 30s — tránh 6 lần 403 liên tiếp như trước.
  useEffect(() => {
    if (isCompleted) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tryMarkInProgress = async () => {
      const res = await progressService.update(programId, lessonId, "in_progress");
      if (cancelled) return;
      const code = (res as { success?: boolean; error?: string }).success;
      const errMsg = (res as { success?: boolean; error?: string }).error ?? "";
      if (code === false && /gán chương trình/i.test(errMsg)) {
        setAssignmentMissing(true);
      } else if (code === true) {
        setAssignmentMissing(false);
      }
    };

    void tryMarkInProgress();
    timer = setInterval(tryMarkInProgress, 30000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [programId, lessonId, isCompleted]);

  const handleMarkComplete = async () => {
    if (lesson?.hasTest && submitResult?.passed !== true) {
      setError("Cần hoàn thành bài test (đạt) trước khi đánh dấu hoàn thành.");
      return;
    }
    setIsMarkingComplete(true);
    setError(null);
    try {
      const res = await progressService.update(programId, lessonId, "completed");
      if (res.success) {
        setIsCompleted(true);
      } else {
        setError((res as { error?: string }).error ?? "Lỗi");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsMarkingComplete(false);
    }
  };

  const handleSubmitTest = async () => {
    if (!test) return;
    if (answers.some((a) => a < 0)) {
      setError("Vui lòng chọn đáp án cho tất cả các câu hỏi");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await testService.submit(programId, lessonId, answers);
      if (res.success) {
        setSubmitResult(res.data as TestSubmitResult);
        if ((res.data as TestSubmitResult).passed) {
          setIsCompleted(true);
        }
      } else {
        setError((res as { error?: string }).error ?? "Lỗi nộp bài");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetake = () => {
    setSubmitResult(null);
    setAnswers(new Array(test?.questions.length ?? 0).fill(-1));
  };

  if (isLoading) {
    return (
      <PageContainer title="...">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-64 w-full" />
      </PageContainer>
    );
  }

  if (!lesson) {
    return (
      <PageContainer title="Bài học">
        <Alert variant="destructive">
          <AlertDescription>
            {error ?? "Không tìm thấy bài học"}
          </AlertDescription>
        </Alert>
        <Button asChild className="mt-4">
          <Link href={`/dashboard/programs/${programId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Quay lại chương trình
          </Link>
        </Button>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={lesson.title}
      breadcrumbs={[
        { label: "Chương trình", href: "/dashboard/programs" },
        {
          label: "Chương trình",
          href: `/dashboard/programs/${programId}`,
        },
        { label: lesson.title },
      ]}
      actions={
        <div className="flex gap-2">
          {isCompleted && (
            <Badge variant="success" className="self-center">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Đã hoàn thành
            </Badge>
          )}
          <Button asChild variant="outline">
            <Link href={`/dashboard/programs/${programId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Quay lại
            </Link>
          </Button>
        </div>
      }
    >
      {assignmentMissing && (
        <Alert className="mb-4 border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertDescription className="text-sm">
            Bạn chưa được gán chương trình đào tạo này. Vui lòng liên hệ
            quản trị viên. Hệ thống sẽ tự kiểm tra lại sau mỗi 30 giây.
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            <code className="text-xs">{error}</code>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline">#{lesson.order}</Badge>
            <Badge variant="secondary">
              {lesson.contentType === "text"
                ? "Văn bản"
                : lesson.contentType === "video"
                  ? "Video"
                  : "PDF"}
            </Badge>
            {lesson.hasTest && <Badge>Có bài test</Badge>}
          </div>
        </CardHeader>
        <CardContent>
          {lesson.contentType === "text" ? (
            <div className="prose prose-sm max-w-none dark:prose-invert [&_h2]:text-xl [&_h2]:font-bold [&_h3]:text-lg [&_h3]:font-semibold [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_img]:max-w-full [&_a]:text-blue-600 [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: lesson.textContent || "" }}
            />
          ) : lesson.contentType === "video" ? (
            <SecureVideoPlayer
              programId={programId}
              lessonId={lessonId}
              title={lesson.title}
              userId={undefined}
              requireFullWatch={false}
            />
          ) : (
            <SecurePdfViewer
              programId={programId}
              lessonId={lessonId}
              title={lesson.title}
              fileName={lesson.fileMeta?.fileName}
            />
          )}
        </CardContent>
      </Card>

      {/* Mark complete - chỉ hiện khi không có test, hoặc khi đã pass test */}
      {(!lesson.hasTest || submitResult?.passed) && !isCompleted && (
        <div className="mt-4 flex justify-end">
          <Button
            onClick={handleMarkComplete}
            disabled={isMarkingComplete}
            size="lg"
          >
            {isMarkingComplete ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Đánh dấu hoàn thành
          </Button>
        </div>
      )}

      {isCompleted && !lesson.hasTest && (
        <Alert className="mt-4 border-green-500/50 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            Bạn đã hoàn thành bài học này.
          </AlertDescription>
        </Alert>
      )}

      {/* Test */}
      {lesson.hasTest && test && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              <CardTitle>Bài kiểm tra</CardTitle>
            </div>
            <CardDescription>
              Cần đạt {test.passScore}% để hoàn thành. Có thể làm lại nhiều lần.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitResult ? (
              <div className="space-y-4">
                <Alert
                  className={
                    submitResult.passed
                      ? "border-green-500/50 bg-green-50 dark:bg-green-950"
                      : "border-red-500/50 bg-red-50 dark:bg-red-950"
                  }
                >
                  <div className="flex items-center gap-2">
                    {submitResult.passed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <div>
                      <div className="font-semibold">
                        {submitResult.passed ? "Đạt" : "Chưa đạt"} · Điểm:{" "}
                        {submitResult.score}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Lần thử thứ {submitResult.attemptCount} · Điểm đạt:{" "}
                        {test.passScore}%
                      </div>
                    </div>
                  </div>
                </Alert>
                <div className="flex justify-end gap-2">
                  {!submitResult.passed && (
                    <Button onClick={handleRetake} variant="outline">
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Làm lại
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {test.questions.map((q, qIdx) => (
                  <div key={qIdx} className="space-y-2">
                    <div className="font-medium">
                      Câu {qIdx + 1}: {q.question}
                    </div>
                    <div className="space-y-1">
                      {q.options.map((opt, optIdx) => (
                        <label
                          key={optIdx}
                          className="flex cursor-pointer items-center gap-2 rounded-md border p-2 hover:bg-muted/50"
                        >
                          <input
                            type="radio"
                            name={`q-${qIdx}`}
                            checked={answers[qIdx] === optIdx}
                            onChange={() =>
                              setAnswers((a) => {
                                const na = [...a];
                                na[qIdx] = optIdx;
                                return na;
                              })
                            }
                          />
                          <span className="text-sm">
                            {String.fromCharCode(65 + optIdx)}. {opt}
                          </span>
                        </label>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Điểm: {q.point}
                    </div>
                  </div>
                ))}
                <div className="flex justify-end">
                  <Button onClick={handleSubmitTest} disabled={isSubmitting}>
                    {isSubmitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Award className="mr-2 h-4 w-4" />
                    )}
                    Nộp bài
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
