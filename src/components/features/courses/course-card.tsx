"use client";

import Link from "next/link";
import Image from "next/image";
import { memo } from "react";
import { BookOpen, Clock, Users, Star, Play } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { Course } from "@/types";

interface CourseCardProps {
  course: Course;
  progress?: number;
  showProgress?: boolean;
  isEnrolled?: boolean;
}

function CourseCardImpl({
  course,
  progress = 0,
  showProgress = false,
  isEnrolled = false,
}: CourseCardProps) {
  const getLevelBadgeVariant = (level: string) => {
    switch (level) {
      case "beginner":
        return "success";
      case "intermediate":
        return "warning";
      case "advanced":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getLevelLabel = (level: string) => {
    switch (level) {
      case "beginner":
        return "Cơ bản";
      case "intermediate":
        return "Trung bình";
      case "advanced":
        return "Nâng cao";
      default:
        return level;
    }
  };

  const getCategoryLabel = (category: string) => {
    const categories: Record<string, string> = {
      it: "Công nghệ",
      hr: "Nhân sự",
      sales: "Kinh doanh",
      marketing: "Marketing",
      management: "Quản lý",
      compliance: "Tuân thủ",
      safety: "An toàn",
      other: "Khác",
    };
    return categories[category] || category;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <Card className="group overflow-hidden transition-all hover:shadow-lg">
      {/* Thumbnail */}
      <Link href={`/dashboard/courses/${course.id}`}>
        <div className="relative aspect-video overflow-hidden bg-muted">
          {course.thumbnail ? (
            <img
              src={course.thumbnail}
              alt={course.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
              <BookOpen className="h-12 w-12 text-primary/50" />
            </div>
          )}

          {/* Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              <Play className="ml-1 h-5 w-5 text-primary" fill="currentColor" />
            </div>
          </div>

          {/* Badges */}
          <div className="absolute left-3 top-3 flex gap-2">
            <Badge variant={getLevelBadgeVariant(course.level)}>
              {getLevelLabel(course.level)}
            </Badge>
          </div>
        </div>
      </Link>

      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/dashboard/courses/${course.id}`} className="flex-1">
            <h3 className="font-semibold line-clamp-2 group-hover:text-primary">
              {course.title}
            </h3>
          </Link>
          {course.averageRating > 0 && (
            <div className="flex items-center gap-1 text-yellow-500">
              <Star className="h-4 w-4 fill-current" />
              <span className="text-sm font-medium">{course.averageRating}</span>
            </div>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-xs">
            {getCategoryLabel(course.category)}
          </Badge>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(course.duration)}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {course.enrolledCount}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0">
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {course.description}
        </p>

        {showProgress && isEnrolled && (
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tiến độ</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}
      </CardContent>

      <CardFooter className="gap-2 p-4 pt-0">
        <Button className="flex-1" size="sm" asChild>
          <Link href={`/dashboard/courses/${course.id}`}>
            {isEnrolled ? (
              <>
                <Play className="mr-1 h-4 w-4" />
                {progress > 0 ? "Tiếp tục" : "Bắt đầu"}
              </>
            ) : (
              "Xem chi tiết"
            )}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

/**
 * Memo: chỉ re-render khi props thực sự đổi.
 * Khi list course lớn, việc gõ search gây re-render toàn list — memo giúp mỗi card
 * chỉ re-render khi course của nó đổi.
 */
export const CourseCard = memo(CourseCardImpl);
