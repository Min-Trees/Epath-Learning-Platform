"use client";

import { useState, useEffect, use, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Clock,
  CheckCircle,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Play,
  FileText,
  BookOpen,
  ExternalLink,
  AlertCircle,
  Loader2,
  Award as AwardIcon,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageContainer } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { VideoPlayer } from "@/components/video/video-player";
import type { VideoProtectMode } from "@/components/video/video-player";
import { useVideoProgress } from "@/hooks/use-video-progress";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import type { Question, QuizAttempt } from "@/types";

interface QuizWithQuestions {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
  timeLimit?: number;
  passingScore: number;
  maxAttempts?: number;
  showResults?: boolean;
  showCorrectAnswers?: boolean;
}

interface LessonDoc {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  type: "video" | "document" | "quiz" | "link";
  content?: {
    videoUrl?: string;
    videoDuration?: number;
    youtubeId?: string;
    documentUrl?: string;
    documentType?: string;
    quizId?: string;
    linkUrl?: string;
    linkLabel?: string;
    protectMode?: VideoProtectMode;
  };
  duration?: number;
  order?: number;
}

interface CourseDoc {
  id: string;
  requireFullWatch?: boolean;
  title?: string;
}

interface LessonSummary {
  id: string;
  title: string;
  order: number;
  type: "video" | "document" | "quiz" | "link";
}

export default function LessonPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const [lesson, setLesson] = useState<LessonDoc | null>(null);
  const [course, setCourse] = useState<CourseDoc | null>(null);
  const [nextLesson, setNextLesson] = useState<LessonSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requireFullWatch = course?.requireFullWatch ?? false;
  const isVideoLesson = lesson?.type === "video" || !lesson?.type;

  const progress = useVideoProgress({
    userId: user?.id,
    courseId,
    lessonId,
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Load course + lesson + all lessons song song để tránh waterfall
        const [courseSnap, lessonSnap, allLessonsSnap] = await Promise.all([
          getDoc(doc(db, "courses", courseId)),
          getDoc(doc(db, "courses", courseId, "lessons", lessonId)),
          getDocs(collection(db, "courses", courseId, "lessons")),
        ]);

        if (cancelled) return;

        if (!lessonSnap.exists()) {
          setError("Bài học không tồn tại.");
          setLesson(null);
          return;
        }

        const courseData = courseSnap.exists() ? courseSnap.data() : null;
        if (courseData) {
          setCourse({
            id: courseSnap.id,
            requireFullWatch: Boolean(
              (courseData as Record<string, unknown>).requireFullWatch
            ),
            title: (courseData as Record<string, unknown>).title as
              | string
              | undefined,
          });
        }

        const data = lessonSnap.data();
        setLesson({
          id: lessonSnap.id,
          courseId,
          title: (data.title as string) ?? "(không có tiêu đề)",
          description: data.description as string | undefined,
          type: (data.type as LessonDoc["type"]) ?? "video",
          content: data.content as LessonDoc["content"],
          duration: data.duration as number | undefined,
          order: data.order as number | undefined,
        });

        // Tìm bài tiếp theo từ kết quả đã load song song
        const sorted = allLessonsSnap.docs
          .map(
            (d) =>
              ({
                id: d.id,
                title: (d.data().title as string) ?? "",
                order: (d.data().order as number) ?? 0,
                type:
                  ((d.data().type as LessonDoc["type"]) ??
                    "video") as LessonSummary["type"],
              } as LessonSummary)
          )
          .sort((a, b) => a.order - b.order);

        const currentIdx = sorted.findIndex((l) => l.id === lessonId);
        const next = currentIdx >= 0 ? sorted[currentIdx + 1] : undefined;
        setNextLesson(next ?? null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [courseId, lessonId]);

  const goBack = useCallback(
    () => router.push(`/dashboard/courses/${courseId}`),
    [router, courseId]
  );
  const goNext = useCallback(() => {
    if (nextLesson) {
      router.push(`/dashboard/courses/${courseId}/lessons/${nextLesson.id}`);
    }
  }, [nextLesson, router, courseId]);

  const canGoNext = useMemo(
    () =>
      nextLesson &&
      (!requireFullWatch ||
        !isVideoLesson ||
        (progress.completed && progress.duration > 0)),
    [nextLesson, requireFullWatch, isVideoLesson, progress.completed, progress.duration]
  );

  if (isLoading) {
    return (
      <PageContainer
        breadcrumbs={[
          { label: "Khóa học", href: "/dashboard/courses" },
          { label: "..." },
        ]}
      >
        <div className="mx-auto max-w-5xl space-y-4">
          <Skeleton className="aspect-video w-full max-h-[60vh] rounded-lg" />
          <Skeleton className="h-24 w-full" />
        </div>
      </PageContainer>
    );
  }

  if (error || !lesson) {
    return (
      <PageContainer
        breadcrumbs={[
          { label: "Khóa học", href: "/dashboard/courses" },
          { label: "..." },
        ]}
      >
        <div className="mx-auto max-w-5xl">
          <Alert variant="destructive">
            <AlertDescription>
              {error || "Không tìm thấy bài học."}
            </AlertDescription>
          </Alert>
          <Button className="mt-4" asChild>
            <Link href={`/dashboard/courses/${courseId}`}>
              Quay lại khóa học
            </Link>
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      breadcrumbs={[
        { label: "Khóa học", href: "/dashboard/courses" },
        { label: "Bài học", href: `/dashboard/courses/${courseId}` },
        { label: lesson.title },
      ]}
    >
      <div className="mx-auto max-w-5xl space-y-4">
        {/* Mobile/tablet: dọc, Desktop xl: ngang (2 cột) */}
        <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
          <div className="space-y-4 min-w-0">
            {(lesson.type === "video" || !lesson.type) && (
              <>
                <div className="w-full max-h-[60vh] mx-auto">
                  <VideoPlayer
                    youtubeId={lesson.content?.youtubeId}
                    videoUrl={lesson.content?.videoUrl}
                    courseId={courseId}
                    lessonId={lessonId}
                    protectMode={lesson.content?.protectMode ?? "locked"}
                    title={lesson.title}
                    watermark={user?.displayName ?? user?.email}
                    userId={user?.id}
                    requireFullWatch={requireFullWatch}
                  />
                </div>

                {lesson.description && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Mô tả bài học</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {lesson.description}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {lesson.type === "document" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tài liệu</CardTitle>
                </CardHeader>
                <CardContent>
                  <DocumentLesson
                    url={lesson.content?.documentUrl}
                    type={lesson.content?.documentType}
                  />
                </CardContent>
              </Card>
            )}

            {lesson.type === "link" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Liên kết</CardTitle>
                </CardHeader>
                <CardContent>
                  <LinkLesson
                    url={lesson.content?.linkUrl}
                    label={lesson.content?.linkLabel}
                  />
                </CardContent>
              </Card>
            )}

            {lesson.type === "quiz" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Bài kiểm tra</CardTitle>
                </CardHeader>
                <CardContent>
                  <QuizLesson
                    courseId={courseId}
                    lessonId={lessonId}
                    quizId={lesson.content?.quizId}
                    userId={user?.id ?? ""}
                  />
                </CardContent>
              </Card>
            )}

            <div className="flex items-center justify-between gap-2 pt-2">
              <Button variant="outline" onClick={goBack}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Quay lại khóa học
              </Button>

              {nextLesson && (
                <div className="flex flex-col items-end gap-1">
                  <Button onClick={goNext} disabled={!canGoNext}>
                    Bài tiếp theo: {nextLesson.title}
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                  {!canGoNext && requireFullWatch && isVideoLesson && (
                    <span className="flex items-center gap-1 text-xs text-amber-600">
                      <Lock className="h-3 w-3" />
                      Xem hết video để mở khóa bài tiếp theo
                      {progress.duration > 0 && !progress.completed && (
                        <> ({Math.floor(progress.percentage)}%)</>
                      )}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{lesson.type}</Badge>
                </div>
                <CardTitle className="text-base leading-snug">
                  {lesson.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {lesson.duration && lesson.type === "video" && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Thời lượng: {Math.round(lesson.duration / 60)} phút</span>
                  </div>
                )}
                <details className="rounded-md bg-muted/50 p-2">
                  <summary className="cursor-pointer text-xs font-medium text-foreground select-none">
                    Debug info
                  </summary>
                  <div className="mt-2 space-y-1 font-mono text-[10px]">
                    <p className="break-all">
                      <span className="font-sans font-semibold">youtubeId</span>
                      : {lesson.content?.youtubeId ?? "—"}
                    </p>
                    <p className="break-all">
                      <span className="font-sans font-semibold">videoUrl</span>
                      : {lesson.content?.videoUrl ?? "—"}
                    </p>
                  </div>
                </details>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </PageContainer>
  );
}

function DocumentLesson({
  url,
  type,
}: {
  url?: string;
  type?: string;
}) {
  if (!url) {
    return (
      <Alert>
        <FileText className="h-4 w-4" />
        <AlertDescription>
          Tài liệu chưa được cập nhật.
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-4 border rounded-lg">
        <FileText className="h-8 w-8 text-primary" />
        <div className="flex-1">
          <p className="font-medium">Tài liệu {type?.toUpperCase() ?? ""}</p>
          <p className="text-sm text-muted-foreground break-all">{url}</p>
        </div>
        <Button asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Mở
          </a>
        </Button>
      </div>
    </div>
  );
}

function LinkLesson({ url, label }: { url?: string; label?: string }) {
  if (!url) {
    return (
      <Alert>
        <AlertDescription>Liên kết chưa được cập nhật.</AlertDescription>
      </Alert>
    );
  }
  return (
    <Button asChild size="lg" className="w-full">
      <a href={url} target="_blank" rel="noopener noreferrer">
        <ExternalLink className="mr-2 h-4 w-4" />
        {label || "Mở liên kết"}
      </a>
    </Button>
  );
}

function QuizLesson({
  courseId,
  lessonId,
  quizId,
  userId,
}: {
  courseId: string;
  lessonId: string;
  quizId?: string;
  userId: string;
}) {
  const [quiz, setQuiz] = useState<QuizWithQuestions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quizState, setQuizState] = useState<
    "start" | "in_progress" | "review" | "result"
  >("start");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!quizId) {
        setError("Bài học này chưa liên kết quiz.");
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        // Try 2 paths song song: top-level quiz hoặc course-scoped
        const [qSnap, subSnap] = await Promise.all([
          getDoc(doc(db, "quizzes", quizId)),
          getDoc(doc(db, "courses", courseId, "quizzes", quizId)),
        ]);
        if (cancelled) return;
        const snap = qSnap.exists() ? qSnap : subSnap;
        if (!snap.exists()) {
          setError("Không tìm thấy quiz.");
          return;
        }
        const data = snap.data();
        setQuiz({
          id: snap.id,
          title: (data.title as string) ?? "Quiz",
          description: data.description as string | undefined,
          questions: (data.questions as Question[]) ?? [],
          timeLimit: data.timeLimit as number | undefined,
          passingScore: (data.passingScore as number) ?? 70,
          maxAttempts: data.maxAttempts as number | undefined,
          showResults: (data.showResults as boolean) ?? true,
          showCorrectAnswers:
            (data.showCorrectAnswers as boolean) ?? true,
        });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [courseId, quizId]);

  useEffect(() => {
    if (quiz?.timeLimit) setTimeRemaining(quiz.timeLimit);
  }, [quiz]);

  const handleStart = useCallback(() => {
    setQuizState("in_progress");
    setAnswers({});
    setCurrentIndex(0);
  }, []);

  const handleSelectAnswer = useCallback(
    (qid: string, value: string) => {
      setAnswers((prev) => ({ ...prev, [qid]: value }));
    },
    []
  );

  const handlePrev = useCallback(
    () => setCurrentIndex((i) => Math.max(0, i - 1)),
    []
  );
  const handleNext = useCallback(
    () => setCurrentIndex((i) => i + 1),
    []
  );

  const calculateScore = useCallback(() => {
    if (!quiz) return { score: 0, total: 0, percentage: 0, passed: false };
    let score = 0;
    const total = quiz.questions.reduce((s, q) => s + (q.points ?? 0), 0);
    quiz.questions.forEach((q) => {
      const ans = answers[q.id];
      if (!ans) return;
      if (q.type === "fill_blank") {
        if (ans.toLowerCase().trim() === (q.correctAnswer ?? "").toLowerCase().trim())
          score += q.points ?? 0;
      } else if (q.type === "multiple_choice" || q.type === "true_false") {
        const opt = q.options?.find((o) => o.id === ans);
        if (opt?.isCorrect) score += q.points ?? 0;
      }
    });
    const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
    return {
      score,
      total,
      percentage,
      passed: percentage >= quiz.passingScore,
    };
  }, [quiz, answers]);

  const handleSubmit = useCallback(async () => {
    if (!quiz || submitting) return;
    setSubmitting(true);
    const result = calculateScore();
    const newAttempt: QuizAttempt = {
      id: `attempt-${Date.now()}`,
      quizId: quiz.id,
      userId,
      courseId,
      lessonId,
      answers: Object.entries(answers).map(([qid, val]) => ({
        questionId: qid,
        answer: val,
        isCorrect: false,
        points: 0,
      })),
      score: result.percentage,
      totalPoints: result.total,
      passed: result.passed,
      startedAt: new Date(),
      completedAt: new Date(),
      timeSpent: quiz.timeLimit ? quiz.timeLimit - timeRemaining : 0,
    };
    setAttempt(newAttempt);
    setQuizState("result");

    if (userId) {
      try {
        await addDoc(collection(db, "quizAttempts"), {
          ...newAttempt,
          startedAt: serverTimestamp(),
          completedAt: serverTimestamp(),
        });
      } catch {
        // ignore — firestore rules có thể chặn
      }
    }
    setSubmitting(false);
  }, [quiz, answers, calculateScore, courseId, lessonId, userId, timeRemaining, submitting]);

  // Timer: chỉ tick khi đang in_progress và có timeLimit
  useEffect(() => {
    if (quizState !== "in_progress" || !quiz?.timeLimit) return;
    const id = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [quizState, quiz?.timeLimit]);

  // Khi timer chạm 0 → auto submit
  useEffect(() => {
    if (
      quizState === "in_progress" &&
      quiz?.timeLimit &&
      timeRemaining === 0 &&
      quiz.questions.length > 0
    ) {
      void handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRemaining, quizState]);

  const handleRetry = useCallback(() => {
    setQuizState("start");
    setAnswers({});
    setCurrentIndex(0);
    setAttempt(null);
    if (quiz?.timeLimit) setTimeRemaining(quiz.timeLimit);
  }, [quiz?.timeLimit]);

  const formatTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, []);

  const currentQuestion = useMemo(
    () => (quiz ? quiz.questions[currentIndex] : null),
    [quiz, currentIndex]
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || !quiz) {
    return (
      <Alert>
        <AlertDescription>{error || "Không có quiz."}</AlertDescription>
      </Alert>
    );
  }
  if (quiz.questions.length === 0) {
    return (
      <Alert>
        <AlertDescription>Quiz chưa có câu hỏi nào.</AlertDescription>
      </Alert>
    );
  }

  if (quizState === "start") {
    return (
      <div className="text-center space-y-4">
        <AwardIcon className="h-12 w-12 text-primary mx-auto" />
        <h3 className="text-xl font-bold">{quiz.title}</h3>
        {quiz.description && (
          <p className="text-muted-foreground">{quiz.description}</p>
        )}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-2xl font-bold">{quiz.questions.length}</p>
            <p className="text-xs text-muted-foreground">Câu hỏi</p>
          </div>
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-2xl font-bold">{quiz.passingScore}%</p>
            <p className="text-xs text-muted-foreground">Điểm đạt</p>
          </div>
          {quiz.timeLimit && (
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-2xl font-bold">
                {formatTime(quiz.timeLimit)}
              </p>
              <p className="text-xs text-muted-foreground">Thời gian</p>
            </div>
          )}
        </div>
        <Button size="lg" onClick={handleStart}>
          <Play className="mr-2 h-4 w-4" />
          Bắt đầu làm bài
        </Button>
      </div>
    );
  }

  if (quizState === "in_progress" && currentQuestion) {
    const isLast = currentIndex === quiz.questions.length - 1;
    const progressPct = ((currentIndex + 1) / quiz.questions.length) * 100;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="outline">
            Câu {currentIndex + 1} / {quiz.questions.length}
          </Badge>
          {quiz.timeLimit && (
            <div
              className={`flex items-center gap-2 rounded-lg px-3 py-1 ${
                timeRemaining < 300
                  ? "bg-red-100 text-red-600"
                  : "bg-muted"
              }`}
            >
              <Clock className="h-4 w-4" />
              <span className="font-mono text-sm">
                {formatTime(timeRemaining)}
              </span>
            </div>
          )}
        </div>
        <Progress value={progressPct} />
        <h3 className="text-lg font-semibold">{currentQuestion.text}</h3>

        {(currentQuestion.type === "multiple_choice" ||
          currentQuestion.type === "true_false") && (
          <RadioGroup
            value={answers[currentQuestion.id] ?? ""}
            onValueChange={(v) => handleSelectAnswer(currentQuestion.id, v)}
          >
            <div className="space-y-2">
              {(currentQuestion.options ?? []).map((opt) => (
                <div
                  key={opt.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 ${
                    answers[currentQuestion.id] === opt.id
                      ? "border-primary bg-primary/5"
                      : ""
                  }`}
                >
                  <RadioGroupItem value={opt.id} id={opt.id} />
                  <label htmlFor={opt.id} className="flex-1 cursor-pointer">
                    {opt.text}
                  </label>
                </div>
              ))}
            </div>
          </RadioGroup>
        )}

        {currentQuestion.type === "fill_blank" && (
          <Input
            placeholder="Nhập câu trả lời..."
            value={answers[currentQuestion.id] ?? ""}
            onChange={(e) =>
              handleSelectAnswer(currentQuestion.id, e.target.value)
            }
          />
        )}

        <div className="flex justify-between pt-2">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Câu trước
          </Button>
          {isLast ? (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Nộp bài
            </Button>
          ) : (
            <Button onClick={handleNext}>
              Câu tiếp
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (quizState === "result" && attempt) {
    return (
      <div className="text-center space-y-4">
        <div
          className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${
            attempt.passed ? "bg-green-100" : "bg-red-100"
          }`}
        >
          {attempt.passed ? (
            <CheckCircle className="h-10 w-10 text-green-600" />
          ) : (
            <XCircle className="h-10 w-10 text-red-600" />
          )}
        </div>
        <h3 className="text-2xl font-bold">
          {attempt.passed ? "Chúc mừng!" : "Chưa đạt"}
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-2xl font-bold">{attempt.score}%</p>
            <p className="text-xs text-muted-foreground">Điểm</p>
          </div>
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-2xl font-bold">{quiz.passingScore}%</p>
            <p className="text-xs text-muted-foreground">Yêu cầu</p>
          </div>
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-2xl font-bold">
              {formatTime(attempt.timeSpent)}
            </p>
            <p className="text-xs text-muted-foreground">Thời gian</p>
          </div>
        </div>
        {!attempt.passed && (
          <Button onClick={handleRetry}>
            Làm lại
          </Button>
        )}
      </div>
    );
  }

  return null;
}
