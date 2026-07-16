"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageContainer } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";

interface PageProps {
  params: Promise<{ courseId: string }>;
}

type Category =
  | "it"
  | "soft-skills"
  | "leadership"
  | "compliance"
  | "safety"
  | "other";
type Level = "beginner" | "intermediate" | "advanced";
type Status = "draft" | "published" | "archived";
type Enrollment = "open" | "approval" | "required";

const CATEGORIES: Category[] = [
  "it",
  "soft-skills",
  "leadership",
  "compliance",
  "safety",
  "other",
];
const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];
const STATUSES: Status[] = ["draft", "published", "archived"];
const ENROLLMENTS: Enrollment[] = ["open", "approval", "required"];

export default function AdminEditCoursePage({ params }: PageProps) {
  const { courseId } = use(params);
  const { user } = useAuth();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("it");
  const [level, setLevel] = useState<Level>("beginner");
  const [status, setStatus] = useState<Status>("draft");
  const [enrollmentType, setEnrollmentType] = useState<Enrollment>("open");
  const [passingScore, setPassingScore] = useState(70);
  const [duration, setDuration] = useState(0);
  const [tags, setTags] = useState("");
  const [thumbnail, setThumbnail] = useState("");

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const snap = await getDoc(doc(db, "courses", courseId));
        if (!snap.exists()) {
          setNotFound(true);
          return;
        }
        const data = snap.data();
        setTitle((data.title as string) ?? "");
        setDescription((data.description as string) ?? "");
        setCategory(((data.category as Category) ?? "it") as Category);
        setLevel(((data.level as Level) ?? "beginner") as Level);
        setStatus(((data.status as Status) ?? "draft") as Status);
        setEnrollmentType(
          ((data.enrollmentType as Enrollment) ?? "open") as Enrollment
        );
        setPassingScore((data.passingScore as number) ?? 70);
        setDuration((data.duration as number) ?? 0);
        setTags(Array.isArray(data.tags) ? (data.tags as string[]).join(", ") : "");
        setThumbnail((data.thumbnail as string) ?? "");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [courseId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.role !== "admin") {
      setError("Chỉ admin mới có quyền chỉnh sửa.");
      return;
    }
    if (!title.trim()) {
      setError("Tiêu đề không được trống.");
      return;
    }
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await updateDoc(doc(db, "courses", courseId), {
        title: title.trim(),
        description: description.trim(),
        category,
        level,
        status,
        enrollmentType,
        passingScore: Number(passingScore) || 0,
        duration: Number(duration) || 0,
        tags: tagList,
        thumbnail: thumbnail.trim(),
        updatedAt: serverTimestamp(),
      });
      setSuccess("Đã lưu thay đổi.");
      setTimeout(() => router.push(`/admin/courses/${courseId}`), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <PageContainer title="Chỉnh sửa khóa học">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-96 w-full" />
      </PageContainer>
    );
  }

  if (notFound) {
    return (
      <PageContainer
        title="Chỉnh sửa khóa học"
        breadcrumbs={[
          { label: "Quản trị", href: "/admin" },
          { label: "Khóa học", href: "/admin/courses" },
          { label: "..." },
        ]}
      >
        <Alert variant="destructive">
          <AlertDescription>Không tìm thấy khóa học.</AlertDescription>
        </Alert>
        <Button asChild className="mt-4">
          <Link href="/admin/courses">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Quay lại
          </Link>
        </Button>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Chỉnh sửa khóa học"
      breadcrumbs={[
        { label: "Quản trị", href: "/admin" },
        { label: "Khóa học", href: "/admin/courses" },
        { label: title || "..." },
      ]}
    >
      <form onSubmit={handleSave} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              <code className="text-xs">{error}</code>
            </AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="border-green-500/50 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Thông tin cơ bản</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Tiêu đề *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: React Fundamentals"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Mô tả</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả ngắn về khóa học"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Thumbnail URL</label>
              <Input
                value={thumbnail}
                onChange={(e) => setThumbnail(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                Tags (phân cách bằng dấu phẩy)
              </label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="React, JavaScript, Frontend"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Phân loại</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Danh mục</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Trình độ</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={level}
                onChange={(e) => setLevel(e.target.value as Level)}
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Trạng thái</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Kiểu ghi danh</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={enrollmentType}
                onChange={(e) => setEnrollmentType(e.target.value as Enrollment)}
              >
                {ENROLLMENTS.map((en) => (
                  <option key={en} value={en}>
                    {en}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Điểm đạt (%)</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={passingScore}
                onChange={(e) => setPassingScore(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Thời lượng (giây)</label>
              <Input
                type="number"
                min={0}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href={`/admin/courses/${courseId}`}>Hủy</Link>
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang lưu...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Lưu thay đổi
              </>
            )}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}