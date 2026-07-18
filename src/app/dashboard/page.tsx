"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Clock,
  TrendingUp,
  Play,
  ArrowRight,
  Star,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageContainer } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  limit,
} from "firebase/firestore";
import type { Course } from "@/types";

export default function DashboardPage() {
  const { user } = useAuth();
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [featuredCourses, setFeaturedCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setIsLoading(true);
      setError(null);
      try {
        const enrolledIds: string[] = user.enrolledCourses ?? [];
        const allCoursesSnap = await getDocs(
          query(
            collection(db, "courses"),
            where("status", "==", "published"),
            limit(20)
          )
        );
        const allCourses: Course[] = allCoursesSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Course, "id">),
          lessons: [],
        }));
        setFeaturedCourses(allCourses.slice(0, 4));
        setEnrolledCourses(
          allCourses.filter((c) => enrolledIds.includes(c.id))
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const stats = {
    enrolledCourses: enrolledCourses.length,
    inProgressCourses: enrolledCourses.length,
    totalLearningHours: Math.round(
      enrolledCourses.reduce((s, c) => s + (c.duration ?? 0), 0) / 3600
    ),
  };

  const statCards = [
    {
      title: "Khóa học đã ghi danh",
      value: stats.enrolledCourses,
      icon: BookOpen,
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/20",
    },
    {
      title: "Đang học",
      value: stats.inProgressCourses,
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-100 dark:bg-orange-900/20",
    },
    {
      title: "Tổng giờ học",
      value: `${stats.totalLearningHours}h`,
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-100 dark:bg-purple-900/20",
    },
  ];

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

  return (
    <PageContainer
      title={`Xin chào, ${user?.displayName || "User"}!`}
      description="Tiếp tục hành trình học tập của bạn"
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
      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
              <CardTitle>Tiếp tục học</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/courses">
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
              ) : enrolledCourses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <BookOpen className="h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 font-semibold">Chưa có khóa học nào</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Bắt đầu học ngay hôm nay!
                  </p>
                  <Button className="mt-4" asChild>
                    <Link href="/dashboard/courses">Khám phá khóa học</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {enrolledCourses.map((course) => (
                    <div
                      key={course.id}
                      className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row"
                    >
                      <div className="h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {course.thumbnail ? (
                          <img
                            src={course.thumbnail}
                            alt={course.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-primary/10">
                            <BookOpen className="h-8 w-8 text-primary" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{course.title}</h3>
                            <Badge variant={getLevelBadgeVariant(course.level)}>
                              {getLevelLabel(course.level)}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {course.description}
                          </p>
                        </div>
                        <div className="mt-2 flex items-center gap-4">
                          <Progress value={0} className="h-2 flex-1" />
                          <span className="text-sm font-medium">0%</span>
                          <Button size="sm" asChild>
                            <Link href={`/dashboard/courses/${course.id}`}>
                              <Play className="mr-1 h-4 w-4" />
                              Tiếp tục
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Featured Courses */}
        <div>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Khóa học nổi bật</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : featuredCourses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Chưa có khóa học nào.
                </p>
              ) : (
                <div className="space-y-4">
                  {featuredCourses.map((course) => (
                    <Link
                      key={course.id}
                      href={`/dashboard/courses/${course.id}`}
                      className="block rounded-lg border p-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium">{course.title}</h4>
                          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                            <Badge
                              variant="outline"
                              className="text-xs"
                            >
                              {getLevelLabel(course.level)}
                            </Badge>
                            <span>•</span>
                            <span>{course.enrolledCount ?? 0} học viên</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-yellow-500">
                          <Star className="h-4 w-4 fill-current" />
                          <span className="text-sm font-medium">
                            {(course.averageRating ?? 0).toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Thao tác nhanh</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/dashboard/courses">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Khám phá khóa học
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}