"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageContainer } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

type Category =
  | "it"
  | "soft-skills"
  | "leadership"
  | "compliance"
  | "safety"
  | "other";
type Level = "beginner" | "intermediate" | "advanced";
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
const ENROLLMENTS: Enrollment[] = ["open", "approval", "required"];

export default function NewCoursePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("it");
  const [level, setLevel] = useState<Level>("beginner");
  const [enrollmentType, setEnrollmentType] = useState<Enrollment>("open");
  const [passingScore, setPassingScore] = useState(70);
  const [duration, setDuration] = useState(0);
  const [tags, setTags] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.role !== "admin") {
      setError("Chỉ admin mới có quyền tạo khóa học.");
      return;
    }
    if (!title.trim()) {
      setError("Tiêu đề không được trống.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const tagList = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const newId = await addDoc(collection(db, "courses"), {
        title: title.trim(),
        description: description.trim(),
        thumbnail: thumbnail.trim(),
        category,
        level,
        tags: tagList,
        instructorId: user.id,
        status: "draft",
        enrolledCount: 0,
        completedCount: 0,
        averageRating: 0,
        totalRatings: 0,
        duration: Number(duration) || 0,
        passingScore: Number(passingScore) || 0,
        enrollmentType,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      router.push(`/admin/courses/${newId.id}/edit`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setIsSaving(false);
    }
  };

  return (
    <PageContainer
      title="Tạo khóa học mới"
      breadcrumbs={[
        { label: "Quản trị", href: "/admin" },
        { label: "Khóa học", href: "/admin/courses" },
        { label: "Mới" },
      ]}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              <code className="text-xs">{error}</code>
            </AlertDescription>
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
            <Link href="/admin/courses">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Hủy
            </Link>
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang tạo...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Tạo khóa học
              </>
            )}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}