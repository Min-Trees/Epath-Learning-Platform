"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Play,
  Clock,
  Users,
  Star,
  Award,
  BookOpen,
  Lock,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageContainer } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";
import type { Course, Lesson } from "@/types";

interface LessonProgressMap {
  [lessonId: string]: { completed: boolean; watchedSeconds: number };
}

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progressMap, setProgressMap] = useState<LessonProgressMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const courseId = params.courseId as string;
  const requireFullWatch = Boolean(course?.requireFullWatch);

  useEffect(() => {
    const fetchCourse = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const courseSnap = await getDoc(doc(db, "courses", courseId));
        if (!courseSnap.exists()) {
          setError("Khóa học không tồn tại hoặc đã bị xóa.");
          setCourse(null);
          return;
        }
        const data = courseSnap.data() as Omit<Course, "id">;
        setCourse({ id: courseSnap.id, ...data });

        const lessonsSnap = await getDocs(
          collection(db, "courses", courseId, "lessons")
        );
        const lessonItems: Lesson[] = lessonsSnap.docs.map((d) => {
          const lData = d.data();
          return {
            id: d.id,
            courseId,
            ...(lData as Omit<Lesson, "id" | "courseId">),
            createdAt:
              (lData.createdAt as { toDate?: () => Date } | undefined)?.toDate?.() ??
              new Date(),
            updatedAt:
              (lData.updatedAt as { toDate?: () => Date } | undefined)?.toDate?.() ??
              new Date(),
          } as Lesson;
        });
        lessonItems.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setLessons(lessonItems);

        if (user) {
          setIsEnrolled((user.enrolledCourses ?? []).includes(courseId));

          // Load progress của user cho từng lesson
          if (data.requireFullWatch) {
            const progressSnap = await getDocs(
              collection(db, "users", user.id, "lessonProgress")
            );
            const map: LessonProgressMap = {};
            progressSnap.forEach((d) => {
              const p = d.data();
              map[d.id] = {
                completed: Boolean(p.completed),
                watchedSeconds: (p.watchedSeconds as number) ?? 0,
              };
            });
            setProgressMap(map);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setIsLoading(false);
      }
    };
    fetchCourse();
  }, [courseId, user]);

  const getLevelBadgeVariant = (level?: string) => {
    switch (level) {
      case "beginner":
        return "success" as const;
      case "intermediate":
        return "warning" as const;
      case "advanced":
        return "destructive" as const;
      default:
        return "secondary" as const;
    }
  };

  const getLevelLabel = (level?: string) => {
    switch (level) {
      case "beginner":
        return "Cơ bản";
      case "intermediate":
        return "Trung bình";
      case "advanced":
        return "Nâng cao";
      default:
        return level ?? "";
    }
  };

  const getLessonTypeIcon = (type: string) => {
    switch (type) {
      case "video":
        return Play;
      case "document":
        return BookOpen;
      case "quiz":
        return Award;
      case "link":
        return BookOpen;
      default:
        return Play;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "Tài liệu";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes} phút`;
  };

  const handleEnroll = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    setEnrolling(true);
    try {
      await updateDoc(doc(db, "users", user.id), {
        enrolledCourses: arrayUnion(courseId),
        updatedAt: serverTimestamp(),
      });
      setIsEnrolled(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEnrolling(false);
    }
  };

  const handleStartLesson = (lesson: Lesson) => {
    router.push(`/dashboard/courses/${courseId}/lessons/${lesson.id}`);
  };

  if (isLoading) {
    return (
      <PageContainer breadcrumbs={[{ label: "Khóa học" }, { label: "Chi tiết" }]}>
        <div className="space-y-6">
          <Skeleton className="h-64 w-full rounded-xl" />
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <Skeleton className="h-64" />
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!course) {
    return (
      <PageContainer breadcrumbs={[{ label: "Khóa học" }, { label: "Chi tiết" }]}>
        <Alert variant="destructive">
          <AlertDescription>
            {error || "Không tìm thấy khóa học."}
          </AlertDescription>
        </Alert>
        <Button className="mt-4" asChild>
          <Link href="/dashboard/courses">Quay lại danh sách</Link>
        </Button>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      breadcrumbs={[
        { label: "Khóa học", href: "/dashboard/courses" },
        { label: course.title },
      ]}
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            <code className="text-xs">{error}</code>
          </AlertDescription>
        </Alert>
      )}

      {/* Banner */}
      <div className="mb-8 overflow-hidden rounded-xl bg-gradient-to-r from-primary/20 to-primary/5">
        <div className="relative h-48 p-8 md:h-64 md:p-12">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-transparent" />
          <div className="relative z-10 max-w-2xl">
            <div className="mb-4 flex flex-wrap gap-2">
              <Badge variant={getLevelBadgeVariant(course.level)}>
                {getLevelLabel(course.level)}
              </Badge>
              {(course.tags ?? []).slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
            <h1 className="mb-4 text-3xl font-bold md:text-4xl">{course.title}</h1>
            <p className="text-muted-foreground">{course.description}</p>

            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                <span className="font-medium">
                  {(course.averageRating ?? 0).toFixed(1)}
                </span>
                <span className="text-muted-foreground">
                  ({course.totalRatings ?? 0} đánh giá)
                </span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{course.enrolledCount ?? 0} học viên</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{formatDuration(course.duration)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Giới thiệu khóa học</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{course.description}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Nội dung khóa học ({lessons.length} bài học)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lessons.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Khóa học này chưa có bài học nào.
                </p>
              ) : (
              <div className="space-y-2">
                {lessons.map((lesson, index) => {
                  const Icon = getLessonTypeIcon(lesson.type);
                  const allowPreview = lesson.isPreview ?? index === 0;

                  // Logic chặn:
                  // 1. Chưa enrolled và không phải preview → khóa
                  // 2. Nếu requireFullWatch + lesson là video + bài TRƯỚC chưa hoàn thành → khóa
                  const lockedByEnrollment = !isEnrolled && !allowPreview;
                  const prevLesson = index > 0 ? lessons[index - 1] : null;
                  const prevProgress = prevLesson
                    ? progressMap[prevLesson.id]
                    : null;
                  const isPrevVideoLesson =
                    prevLesson?.type === "video" || !prevLesson?.type;
                  const lockedByPrev =
                    requireFullWatch &&
                    isPrevVideoLesson &&
                    prevLesson &&
                    !(prevProgress?.completed ?? false);

                  const isLocked = lockedByEnrollment || lockedByPrev;
                  const isCompleted = progressMap[lesson.id]?.completed ?? false;

                  return (
                    <div
                      key={lesson.id}
                      className={`flex items-center gap-4 rounded-lg border p-4 transition-colors ${
                        isLocked
                          ? "bg-muted/50 opacity-60"
                          : "hover:bg-muted/50 cursor-pointer"
                      }`}
                      onClick={() =>
                        !isLocked && handleStartLesson(lesson)
                      }
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                          isLocked
                            ? "bg-muted text-muted-foreground"
                            : isCompleted
                              ? "bg-emerald-100 text-emerald-600"
                              : "bg-primary/10 text-primary"
                        }`}
                      >
                        {isLocked ? (
                          <Lock className="h-5 w-5" />
                        ) : isCompleted ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <Icon className="h-5 w-5" />
                        )}
                      </div>

                      <div className="flex-1">
                        <h4 className="font-medium">
                          {index + 1}. {lesson.title}
                        </h4>
                        {lesson.description && (
                          <p className="text-sm text-muted-foreground">
                            {lesson.description}
                          </p>
                        )}
                        {lockedByPrev && prevLesson && (
                          <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                            <Lock className="h-3 w-3" />
                            Hoàn thành &ldquo;{prevLesson.title}&rdquo; để mở khóa
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {lesson.type === "video" && lesson.duration && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {formatDuration(lesson.duration)}
                          </span>
                        )}
                        {lesson.type === "quiz" && (
                          <Badge variant="outline">Quiz</Badge>
                        )}
                        {lesson.type === "document" && (
                          <Badge variant="outline">Tài liệu</Badge>
                        )}
                        {isCompleted && (
                          <Badge variant="default" className="bg-emerald-600">
                            Đã xem
                          </Badge>
                        )}
                        {!isEnrolled && allowPreview && (
                          <Badge variant="secondary">Xem trước</Badge>
                        )}
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
          <Card className="sticky top-24">
            <CardContent className="p-6">
              {isEnrolled ? (
                <>
                  <div className="mb-4">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Tiến độ của bạn</span>
                      <span className="font-medium">0%</span>
                    </div>
                    <Progress value={0} className="h-2" />
                  </div>

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => {
                      const first = lessons[0];
                      if (first) handleStartLesson(first);
                    }}
                    disabled={lessons.length === 0}
                  >
                    <Play className="mr-2 h-5 w-5" />
                    {lessons.length === 0 ? "Chưa có bài học" : "Bắt đầu học"}
                  </Button>

                  {course.passingScore !== undefined && (
                    <div className="mt-4 rounded-lg bg-muted p-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Award className="h-4 w-4 text-primary" />
                        <span>Điểm đạt yêu cầu: {course.passingScore}%</span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleEnroll}
                    disabled={enrolling}
                  >
                    {enrolling ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Đang xử lý...
                      </>
                    ) : course.enrollmentType === "required" ? (
                      "Bắt đầu học"
                    ) : (
                      "Đăng ký học ngay"
                    )}
                  </Button>

                  <p className="mt-4 text-center text-sm text-muted-foreground">
                    Miễn phí cho nhân viên
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}