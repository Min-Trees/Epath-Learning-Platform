"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageContainer } from "@/components/layout";
import { programService } from "@/services/training";

export default function NewProgramPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Tiêu đề không được trống");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const res = await programService.create({
        title: title.trim(),
        description: description.trim(),
      });
      if (res.success && res.data) {
        const programId = (res.data as { programId: string }).programId;
        router.push(`/admin/programs/${programId}`);
      } else {
        setError((res as { error?: string }).error ?? "Lỗi tạo chương trình");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageContainer
      title="Tạo chương trình mới"
      breadcrumbs={[
        { label: "Quản trị", href: "/admin" },
        { label: "Chương trình", href: "/admin/programs" },
        { label: "Mới" },
      ]}
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
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
              <label className="mb-1 block text-sm font-medium">
                Tiêu đề <span className="text-destructive">*</span>
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: An toàn lao động cho nhân viên mới"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Mô tả</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả ngắn về chương trình"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        <Alert>
          <AlertDescription>
            Chương trình mới tạo sẽ ở trạng thái <strong>Bản nháp</strong>. Sau
            khi thêm lesson + test, bấm <strong>Publish</strong> để nhân viên có
            thể được gán.
          </AlertDescription>
        </Alert>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/programs">
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
                Tạo chương trình
              </>
            )}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
