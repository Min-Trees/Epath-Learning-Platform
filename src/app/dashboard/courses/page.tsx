"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { Search, Filter, Grid, List, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageContainer } from "@/components/layout";
import { CourseCard } from "@/components/features/courses/course-card";
import { useCollection, useDebouncedValue, fqWhere } from "@/hooks";
import type { Course, CourseLevel, CourseCategory } from "@/types";

const LEVELS: { value: CourseLevel | "all"; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "beginner", label: "Cơ bản" },
  { value: "intermediate", label: "Trung bình" },
  { value: "advanced", label: "Nâng cao" },
];

const CATEGORIES: { value: CourseCategory | "all"; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "it", label: "Công nghệ" },
  { value: "hr", label: "Nhân sự" },
  { value: "sales", label: "Kinh doanh" },
  { value: "marketing", label: "Marketing" },
  { value: "management", label: "Quản lý" },
  { value: "compliance", label: "Tuân thủ" },
  { value: "safety", label: "An toàn" },
  { value: "other", label: "Khác" },
];

export default function CoursesPage() {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 250);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedLevel, setSelectedLevel] = useState<CourseLevel | "all">("all");
  const [selectedCategory, setSelectedCategory] = useState<CourseCategory | "all">("all");
  const [activeTab, setActiveTab] = useState("all");
  const [, startTransition] = useTransition();

  const {
    data: courses = [],
    isLoading,
    error: rqError,
  } = useCollection<Course & { id: string }>(
    "courses",
    [fqWhere("status", "==", "published")],
    ["published"]
  );

  const error = rqError
    ? `Không tải được khóa học: ${rqError instanceof Error ? rqError.message : String(rqError)}`
    : null;

  const filteredCourses = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return courses.filter((course) => {
      const matchesSearch =
        q === "" ||
        course.title?.toLowerCase().includes(q) ||
        course.description?.toLowerCase().includes(q);
      const matchesLevel = selectedLevel === "all" || course.level === selectedLevel;
      const matchesCategory = selectedCategory === "all" || course.category === selectedCategory;
      let matchesTab = true;
      if (activeTab === "popular") {
        matchesTab = (course.enrolledCount ?? 0) > 150;
      } else if (activeTab === "rated") {
        matchesTab = (course.averageRating ?? 0) >= 4.7;
      }
      return matchesSearch && matchesLevel && matchesCategory && matchesTab;
    });
  }, [courses, debouncedSearch, selectedLevel, selectedCategory, activeTab]);

  return (
    <PageContainer
      title="Khóa học"
      description="Khám phá và đăng ký các khóa học"
      breadcrumbs={[{ label: "Khóa học" }]}
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            <code className="text-xs">{error}</code>
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Search */}
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Tìm kiếm khóa học..."
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={activeTab} onValueChange={(v) => startTransition(() => setActiveTab(v))}>
            <TabsList>
              <TabsTrigger value="all">Tất cả</TabsTrigger>
              <TabsTrigger value="popular">Phổ biến</TabsTrigger>
              <TabsTrigger value="new">Mới nhất</TabsTrigger>
              <TabsTrigger value="rated">Đánh giá cao</TabsTrigger>
            </TabsList>
          </Tabs>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Lọc
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Trình độ</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {LEVELS.map((level) => (
                <DropdownMenuCheckboxItem
                  key={level.value}
                  checked={selectedLevel === level.value}
                  onCheckedChange={() => setSelectedLevel(level.value)}
                >
                  {level.label}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Danh mục</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {CATEGORIES.map((category) => (
                <DropdownMenuCheckboxItem
                  key={category.value}
                  checked={selectedCategory === category.value}
                  onCheckedChange={() => setSelectedCategory(category.value)}
                >
                  {category.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex rounded-md border">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="rounded-r-none"
              onClick={() => setViewMode("grid")}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="rounded-l-none"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div
          className={
            viewMode === "grid"
              ? "grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              : "space-y-4"
          }
        >
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <Skeleton className="h-40 w-full rounded-none" />
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          {courses.length === 0 ? (
            <>
              <Loader2 className="h-12 w-12 text-muted-foreground/30" />
              <h3 className="mt-4 text-lg font-semibold">
                Chưa có khóa học nào được xuất bản
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Vào trang{" "}
                <Link href="/admin/courses" className="underline">
                  Quản lý khóa học
                </Link>{" "}
                để tạo và xuất bản khóa học.
              </p>
            </>
          ) : (
            <>
              <Search className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">Không tìm thấy khóa học</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm
              </p>
            </>
          )}
        </div>
      ) : (
        <div
          className={
            viewMode === "grid"
              ? "grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              : "space-y-4"
          }
        >
          {filteredCourses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}