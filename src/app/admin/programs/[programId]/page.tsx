"use client";

import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  Edit,
  Eye,
  Save,
  Trash2,
  Plus,
  Loader2,
  FileText,
  Video,
  FileType,
  CheckCircle2,
  Send,
  Award,
  ArrowUp,
  ArrowDown,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageContainer } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { programService, lessonService } from "@/services/training";
import type { Program, Lesson, LessonContentType } from "@/types/training";
import { formatDateTime } from "@/utils";

// Lazy load RichTextEditor (TinyMCE is heavy ~500KB)
const RichTextEditor = dynamic(
  () => import("@/components/rich-text-editor").then((m) => m.RichTextEditor),
  {
    loading: () => <div className="h-64 w-full animate-pulse rounded-md bg-muted" />,
    ssr: false,
  }
);

const TYPE_ICONS: Record<
  LessonContentType,
  React.ComponentType<{ className?: string }>
> = {
  text: FileText,
  video: Video,
  pdf: FileType,
};

const TYPE_LABELS: Record<LessonContentType, string> = {
  text: "Văn bản",
  video: "Video",
  pdf: "PDF",
};

interface LessonFormState {
  id?: string;
  title: string;
  order: number;
  contentType: LessonContentType;
  textContent: string;
  fileKey: string;
  fileMeta: {
    fileName: string;
    size: number;
    mimeType: string;
    duration?: number;
  } | null;
  selectedFile: File | null;
  isUploading: boolean;
  uploadProgress: number;
  uploadError: string | null;
}

const EMPTY_LESSON_FORM: LessonFormState = {
  title: "",
  order: 1,
  contentType: "text",
  textContent: "",
  fileKey: "",
  fileMeta: null,
  selectedFile: null,
  isUploading: false,
  uploadProgress: 0,
  uploadError: null,
};

export default function AdminProgramDetailPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [program, setProgram] = useState<Program | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sửa program
  const [editingProgram, setEditingProgram] = useState(false);
  const [programForm, setProgramForm] = useState({ title: "", description: "" });
  const [isSavingProgram, setIsSavingProgram] = useState(false);

  // Tạo / sửa lesson
  const [lessonForm, setLessonForm] = useState<LessonFormState | null>(null);
  const [isSavingLesson, setIsSavingLesson] = useState(false);

  // Test editor
  const [testEditorLesson, setTestEditorLesson] = useState<Lesson | null>(null);

  // Publish
  const [isPublishing, setIsPublishing] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await programService.get(programId);
      if (res.success && res.data) {
        const data = res.data as { program: Program; lessons: Lesson[] };
        if (!data.program) {
          setError("Chương trình không tồn tại");
          setProgram(null);
          setLessons([]);
          return;
        }
        setProgram(data.program);
        setLessons(
          (data.lessons ?? []).map((l) => ({
            ...l,
            createdAt: new Date(
              (l as { createdAt?: { toDate?: () => Date } | Date })
                .createdAt instanceof Date
                ? ((l as { createdAt: Date }).createdAt as unknown as Date)
                : ((l as { createdAt?: { toDate?: () => Date } }).createdAt
                    ?.toDate?.() ?? new Date())
            ),
          }))
        );
        setProgramForm({
          title: data.program.title,
          description: data.program.description ?? "",
        });
      } else {
        setError((res as { error?: string }).error ?? "Lỗi tải chương trình");
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

  // ─── Program actions ─────────────────────────────────────
  const handleSaveProgram = async () => {
    if (!programForm.title.trim()) {
      setError("Tiêu đề không được trống");
      return;
    }
    setIsSavingProgram(true);
    setError(null);
    try {
      const res = await programService.update(programId, {
        title: programForm.title.trim(),
        description: programForm.description,
      });
      if (res.success) {
        setEditingProgram(false);
        await load();
      } else {
        setError((res as { error?: string }).error ?? "Lỗi cập nhật");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSavingProgram(false);
    }
  };

  const handlePublish = async () => {
    if (lessons.length === 0) {
      setError("Cần ít nhất 1 lesson trước khi publish");
      return;
    }
    setIsPublishing(true);
    setError(null);
    try {
      const res =
        program?.status === "published"
          ? await programService.unpublish(programId)
          : await programService.publish(programId);
      if (res.success) {
        await load();
      } else {
        setError((res as { error?: string }).error ?? "Lỗi publish");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDeleteProgram = async () => {
    if (!window.confirm(`Xóa chương trình "${program?.title}"?\nKhông thể khôi phục.`))
      return;
    try {
      const res = await programService.remove(programId);
      if (res.success) {
        window.location.href = "/admin/programs";
      } else {
        setError((res as { error?: string }).error ?? "Lỗi xóa");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // ─── Lesson actions ──────────────────────────────────────
  const openCreateLesson = () => {
    const nextOrder =
      lessons.length === 0
        ? 1
        : Math.max(...lessons.map((l) => l.order ?? 0)) + 1;
    setLessonForm({ ...EMPTY_LESSON_FORM, order: nextOrder });
  };

  const openEditLesson = (l: Lesson) => {
    setLessonForm({
      id: l.id,
      title: l.title,
      order: l.order,
      contentType: l.contentType,
      textContent: l.textContent ?? "",
      fileKey: l.fileKey ?? "",
      fileMeta: l.fileMeta
        ? {
            fileName: l.fileMeta.fileName,
            size: l.fileMeta.size,
            mimeType: l.fileMeta.mimeType,
            duration: l.fileMeta.duration,
          }
        : null,
      selectedFile: null,
      isUploading: false,
      uploadProgress: 0,
      uploadError: null,
    });
  };

  const closeLessonForm = () => {
    setLessonForm(null);
  };

  const handleSaveLesson = async () => {
    if (!lessonForm) return;
    if (!lessonForm.title.trim()) {
      setError("Tiêu đề lesson không được trống");
      return;
    }
    if (lessonForm.contentType === "text" && !lessonForm.textContent.trim()) {
      setError("Nội dung text không được trống");
      return;
    }
    if (lessonForm.contentType !== "text" && !lessonForm.fileKey) {
      setError("Cần upload file cho lesson video/PDF");
      return;
    }
    setIsSavingLesson(true);
    setError(null);
    try {
      if (lessonForm.id) {
        // Update
        const res = await lessonService.update(programId, lessonForm.id, {
          title: lessonForm.title.trim(),
          order: lessonForm.order,
          contentType: lessonForm.contentType,
          textContent: lessonForm.contentType === "text" ? lessonForm.textContent : null,
          fileKey: lessonForm.contentType !== "text" ? lessonForm.fileKey : null,
          fileMeta: lessonForm.contentType !== "text" ? lessonForm.fileMeta : null,
        });
        if (!res.success) {
          setError((res as { error?: string }).error ?? "Lỗi cập nhật lesson");
          setIsSavingLesson(false);
          return;
        }
      } else {
        // Create lesson trước (chưa có file) để lấy lessonId thật
        const res = await lessonService.create(programId, {
          title: lessonForm.title.trim(),
          order: lessonForm.order,
          contentType: lessonForm.contentType,
          textContent: lessonForm.contentType === "text" ? lessonForm.textContent : undefined,
        });
        if (!res.success || !res.data) {
          setError((res as { error?: string }).error ?? "Lỗi tạo lesson");
          setIsSavingLesson(false);
          return;
        }
        const newId = (res.data as { lessonId: string }).lessonId;
        if (lessonForm.contentType !== "text" && lessonForm.selectedFile && lessonForm.fileMeta) {
          // File đang ở key pending (presign trước khi có lessonId).
          // Re-presign với lessonId thật rồi re-upload.
          setLessonForm((f) => (f ? { ...f, isUploading: true, uploadProgress: 0, uploadError: null } : f));
          const presignRes = await import("@/services/training").then((m) =>
            m.uploadService.presign({
              fileName: lessonForm.fileMeta!.fileName,
              mimeType: lessonForm.fileMeta!.mimeType,
              programId,
              lessonId: newId,
              size: lessonForm.fileMeta!.size,
            })
          );
          if (!presignRes.success || !presignRes.data) {
            setError(
              (presignRes as { error?: string }).error ??
                "Không tạo được presigned URL mới"
            );
            setIsSavingLesson(false);
            return;
          }
          const newUploadUrl = (presignRes.data as { uploadUrl: string }).uploadUrl;
          const newFileKey = (presignRes.data as { fileKey: string }).fileKey;
          const localFallback = (presignRes.data as { localFallback?: boolean })
            .localFallback;

          const headers: Record<string, string> = {
            "Content-Type": lessonForm.fileMeta!.mimeType,
          };
          if (localFallback) {
            const { auth } = await import("@/lib/firebase");
            if (auth.currentUser) {
              const token = await auth.currentUser.getIdToken();
              headers["Authorization"] = `Bearer ${token}`;
            }
          }

          const uploadRes = await fetch(newUploadUrl, {
            method: "PUT",
            body: lessonForm.selectedFile,
            headers,
          });
          if (!uploadRes.ok) {
            const errText = await uploadRes.text();
            setError(`Upload thất bại (${uploadRes.status}): ${errText}`);
            setIsSavingLesson(false);
            return;
          }

          // Confirm với fileKey thật
          const confirmRes = await lessonService.confirmUpload(programId, newId, {
            fileKey: newFileKey,
            fileMeta: lessonForm.fileMeta,
          });
          if (!confirmRes.success) {
            setError(
              (confirmRes as { error?: string }).error ?? "Lỗi xác nhận upload"
            );
            setIsSavingLesson(false);
            return;
          }
        }
      }
      closeLessonForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSavingLesson(false);
    }
  };

  const handleDeleteLesson = async (l: Lesson) => {
    if (!window.confirm(`Xóa lesson "${l.title}"?\nKhông thể khôi phục.`))
      return;
    try {
      const res = await lessonService.remove(programId, l.id);
      if (res.success) {
        await load();
      } else {
        setError((res as { error?: string }).error ?? "Lỗi xóa lesson");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleMoveLesson = async (l: Lesson, dir: -1 | 1) => {
    const idx = lessons.findIndex((x) => x.id === l.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= lessons.length) return;
    const swapWith = lessons[swapIdx];
    try {
      await Promise.all([
        lessonService.update(programId, l.id, { order: swapWith.order }),
        lessonService.update(programId, swapWith.id, { order: l.order }),
      ]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // ─── File upload ──────────────────────────────────────────
  const handleFileSelect = async (file: File) => {
    if (!lessonForm) return;
    const expectedPrefix =
      lessonForm.contentType === "video" ? "video/" : "application/pdf";
    if (
      lessonForm.contentType === "video"
        ? !file.type.startsWith("video/")
        : file.type !== "application/pdf"
    ) {
      setError(`File phải có MIME type ${expectedPrefix}*`);
      return;
    }
    // Không giới hạn kích thước file.

    setLessonForm((f) =>
      f ? { ...f, isUploading: true, uploadProgress: 0, uploadError: null, selectedFile: file } : f
    );
    try {
      // Lấy presigned URL. Với lesson mới (chưa có id), tạm thời dùng "new" làm
      // lessonId để backend có thể validate sau.
      const lessonIdForKey = lessonForm.id ?? "new";
      const presignRes = await import("@/services/training").then((m) =>
        m.uploadService.presign({
          fileName: file.name,
          mimeType: file.type,
          programId,
          lessonId: lessonIdForKey,
          size: file.size,
        })
      );
      if (!presignRes.success || !presignRes.data) {
        throw new Error(
          (presignRes as { error?: string }).error ?? "Không tạo được presigned URL"
        );
      }
      const { uploadUrl, fileKey } = presignRes.data as {
        uploadUrl: string;
        fileKey: string;
      };

      // Upload file trực tiếp. Nếu là local fallback, cần gửi kèm Bearer token.
      const headers: Record<string, string> = {
        "Content-Type": file.type,
      };
      const localFallback = (presignRes.data as { localFallback?: boolean })
        .localFallback;
      if (localFallback) {
        const { auth } = await import("@/lib/firebase");
        if (auth.currentUser) {
          const token = await auth.currentUser.getIdToken();
          headers["Authorization"] = `Bearer ${token}`;
        }
      }

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers,
      });
      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`Upload thất bại (${uploadRes.status}): ${errText}`);
      }

      // Lưu metadata vào form (chưa lưu Firestore - chờ user bấm Lưu lesson)
      setLessonForm((f) =>
        f
          ? {
              ...f,
              fileKey,
              fileMeta: {
                fileName: file.name,
                size: file.size,
                mimeType: file.type,
              },
              isUploading: false,
              uploadProgress: 100,
            }
          : f
      );
    } catch (e) {
      setLessonForm((f) =>
        f
          ? { ...f, isUploading: false, uploadError: e instanceof Error ? e.message : String(e) }
          : f
      );
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (isLoading) {
    return (
      <PageContainer title="...">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-64 w-full" />
      </PageContainer>
    );
  }

  if (!program) {
    return (
      <PageContainer title="Không tìm thấy chương trình">
        <Alert variant="destructive">
          <AlertDescription>{error ?? "Program không tồn tại"}</AlertDescription>
        </Alert>
        <Button asChild className="mt-4">
          <Link href="/admin/programs">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Quay lại
          </Link>
        </Button>
      </PageContainer>
    );
  }

  const isPublished = program.status === "published";

  return (
    <PageContainer
      title={editingProgram ? "Sửa chương trình" : program.title}
      description={
        isPublished
          ? `Đã publish${program.publishedAt ? ` lúc ${formatDateTime(program.publishedAt)}` : ""}`
          : "Bản nháp"
      }
      breadcrumbs={[
        { label: "Quản trị", href: "/admin" },
        { label: "Chương trình", href: "/admin/programs" },
        { label: program.title },
      ]}
      actions={
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/programs">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Quay lại
            </Link>
          </Button>
          {isAdmin && !editingProgram && (
            <>
              <Button asChild variant="outline">
                <Link href={`/dashboard/programs/${programId}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  Xem
                </Link>
              </Button>
              <Button
                variant={isPublished ? "outline" : "default"}
                onClick={handlePublish}
                disabled={isPublishing}
              >
                {isPublishing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : isPublished ? (
                  <RotateCcw className="mr-2 h-4 w-4" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {isPublished ? "Chuyển về nháp" : "Publish"}
              </Button>
              <Button
                variant="destructive"
                size="icon"
                onClick={handleDeleteProgram}
                title="Xóa chương trình"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      }
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            <code className="text-xs">{error}</code>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Thông tin chương trình</CardTitle>
              {isAdmin && !editingProgram && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingProgram(true)}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Sửa
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editingProgram ? (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Tiêu đề
                  </label>
                  <Input
                    value={programForm.title}
                    onChange={(e) =>
                      setProgramForm((f) => ({ ...f, title: e.target.value }))
                    }
                    disabled={isPublished}
                  />
                  {isPublished && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Chương trình đã publish - không thể đổi tiêu đề
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Mô tả</label>
                  <Textarea
                    value={programForm.description}
                    onChange={(e) =>
                      setProgramForm((f) => ({
                        ...f,
                        description: e.target.value,
                      }))
                    }
                    rows={4}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingProgram(false);
                      setProgramForm({
                        title: program.title,
                        description: program.description ?? "",
                      });
                    }}
                  >
                    Hủy
                  </Button>
                  <Button onClick={handleSaveProgram} disabled={isSavingProgram}>
                    {isSavingProgram ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Lưu
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-medium">Trạng thái: </span>
                  <Badge
                    variant={isPublished ? "default" : "secondary"}
                    className="ml-1"
                  >
                    {isPublished ? "Đã publish" : "Bản nháp"}
                  </Badge>
                </div>
                <div>
                  <span className="font-medium">Mô tả: </span>
                  <span className="text-muted-foreground">
                    {program.description || "—"}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Ngày tạo: </span>
                  <span className="text-muted-foreground">
                    {formatDateTime(program.createdAt)}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Số lesson: </span>
                  <span className="text-muted-foreground">{lessons.length}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hành động nhanh</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href={`/admin/assignments?programId=${programId}`}>
                <Plus className="mr-2 h-4 w-4" />
                Gán cho nhân viên
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href={`/admin/reports?programId=${programId}`}>
                <Award className="mr-2 h-4 w-4" />
                Xem báo cáo
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Bài học ({lessons.length})</CardTitle>
              <CardDescription>
                Sắp xếp thứ tự bằng nút ↑ ↓. Mỗi lesson có thể kèm bài test.
              </CardDescription>
            </div>
            {isAdmin && (
              <Button onClick={openCreateLesson}>
                <Plus className="mr-2 h-4 w-4" />
                Thêm lesson
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {lessons.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Chưa có lesson. Bấm &ldquo;Thêm lesson&rdquo; để bắt đầu.
            </div>
          ) : (
            <div className="grid gap-2">
              {lessons.map((l, idx) => {
                const Icon = TYPE_ICONS[l.contentType];
                return (
                  <div
                    key={l.id}
                    className="flex items-center gap-3 rounded-md border p-3"
                  >
                    {isAdmin && (
                      <div className="flex flex-col gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={idx === 0}
                          onClick={() => handleMoveLesson(l, -1)}
                          title="Lên"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={idx === lessons.length - 1}
                          onClick={() => handleMoveLesson(l, 1)}
                          title="Xuống"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <Badge variant="outline">#{l.order}</Badge>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{l.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {TYPE_LABELS[l.contentType]}
                        {l.fileMeta &&
                          ` · ${(l.fileMeta.size / 1024 / 1024).toFixed(1)} MB`}
                        {l.hasTest && " · có bài test"}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <Button
                          variant={l.hasTest ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => setTestEditorLesson(l)}
                        >
                          <Award className="mr-1 h-3 w-3" />
                          {l.hasTest ? "Sửa test" : "Thêm test"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditLesson(l)}
                          title="Sửa lesson"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteLesson(l)}
                          title="Xóa"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lesson form dialog */}
      <Dialog
        open={Boolean(lessonForm)}
        onOpenChange={(o) => !o && closeLessonForm()}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {lessonForm?.id ? "Sửa lesson" : "Thêm lesson"}
            </DialogTitle>
            <DialogDescription>
              {lessonForm?.id
                ? `ID: ${lessonForm.id}`
                : `Lưu trong programs/${programId}/lessons/`}
            </DialogDescription>
          </DialogHeader>
          {lessonForm && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Tiêu đề <span className="text-destructive">*</span>
                </label>
                <Input
                  value={lessonForm.title}
                  onChange={(e) =>
                    setLessonForm((f) =>
                      f ? { ...f, title: e.target.value } : f
                    )
                  }
                  placeholder="VD: Giới thiệu về an toàn lao động"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Loại</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={lessonForm.contentType}
                    onChange={(e) =>
                      setLessonForm((f) =>
                        f
                          ? {
                              ...f,
                              contentType: e.target.value as LessonContentType,
                              fileKey: "",
                              fileMeta: null,
                            }
                          : f
                      )
                    }
                  >
                    <option value="text">Văn bản (rich text)</option>
                    <option value="video">Video</option>
                    <option value="pdf">PDF</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Thứ tự
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={lessonForm.order}
                    onChange={(e) =>
                      setLessonForm((f) =>
                        f
                          ? { ...f, order: parseInt(e.target.value || "1", 10) }
                          : f
                      )
                    }
                  />
                </div>
              </div>

              {lessonForm.contentType === "text" ? (
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Nội dung
                  </label>
                  <RichTextEditor
                    value={lessonForm.textContent}
                    onChange={(value) =>
                      setLessonForm((f) =>
                        f ? { ...f, textContent: value } : f
                      )
                    }
                    placeholder="Nhập nội dung bài học... (Copy nội dung từ file PDF và paste vào đây)"
                  />
                </div>
              ) : lessonForm.contentType === "pdf" ? (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      File PDF
                    </label>
                    <div className="rounded-md border border-dashed p-4">
                      {lessonForm.fileMeta ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="text-sm">
                              <div className="font-medium">
                                {lessonForm.fileMeta.fileName}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {(lessonForm.fileMeta.size / 1024 / 1024).toFixed(2)}{" "}
                                MB · {lessonForm.fileMeta.mimeType}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-green-600">
                              <CheckCircle2 className="h-4 w-4" />
                              <span className="text-xs">Đã upload</span>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setLessonForm((f) =>
                                f
                                  ? {
                                      ...f,
                                      fileKey: "",
                                      fileMeta: null,
                                    }
                                  : f
                              )
                            }
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Xóa file
                          </Button>
                        </div>
                      ) : (
                        <div>
                          <input
                            type="file"
                            accept="application/pdf"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleFileSelect(f);
                            }}
                            disabled={lessonForm.isUploading}
                            className="text-sm"
                          />
                          {lessonForm.isUploading && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Đang upload...
                            </p>
                          )}
                          {lessonForm.uploadError && (
                            <p className="mt-2 text-xs text-destructive">
                              {lessonForm.uploadError}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                    <p className="font-medium">Hướng dẫn:</p>
                    <p className="mt-1 text-xs">
                      Copy nội dung từ file PDF (Ctrl+A, Ctrl+C), sau đó tạo lesson
                      loại <strong>Văn bản</strong> và paste vào ô nội dung.
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    File video
                  </label>
                  <div className="rounded-md border border-dashed p-4">
                    {lessonForm.fileMeta ? (
                      <div className="flex items-center justify-between">
                        <div className="text-sm">
                          <div className="font-medium">
                            {lessonForm.fileMeta.fileName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {(lessonForm.fileMeta.size / 1024 / 1024).toFixed(2)}{" "}
                            MB · {lessonForm.fileMeta.mimeType}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-xs">Đã upload</span>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <input
                          type="file"
                          accept="video/*"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleFileSelect(f);
                          }}
                          disabled={lessonForm.isUploading}
                          className="text-sm"
                        />
                        {lessonForm.isUploading && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Đang upload...
                          </p>
                        )}
                        {lessonForm.uploadError && (
                          <p className="mt-2 text-xs text-destructive">
                            {lessonForm.uploadError}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-muted-foreground">
                          File sẽ được upload trực tiếp tới R2 (hoặc local
                          fallback khi dev). URL tạm thời sẽ được sinh tự động
                          khi nhân viên xem.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={closeLessonForm}
                  disabled={isSavingLesson}
                >
                  Hủy
                </Button>
                <Button
                  onClick={handleSaveLesson}
                  disabled={isSavingLesson || lessonForm.isUploading}
                >
                  {isSavingLesson ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {lessonForm.id ? "Cập nhật" : "Tạo"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {testEditorLesson && (
        <TestEditorDialog
          programId={programId}
          lesson={testEditorLesson}
          onClose={() => setTestEditorLesson(null)}
          onSaved={async () => {
            setTestEditorLesson(null);
            await load();
          }}
        />
      )}
    </PageContainer>
  );
}

// ─── Test Editor Dialog ──────────────────────────────────────
function TestEditorDialog({
  programId,
  lesson,
  onClose,
  onSaved,
}: {
  programId: string;
  lesson: Lesson;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [questions, setQuestions] = useState<
    {
      question: string;
      options: string[];
      correctIndex: number;
      point: number;
    }[]
  >([
    { question: "", options: ["", "", "", ""], correctIndex: 0, point: 10 },
  ]);
  const [passScore, setPassScore] = useState(70);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await testServiceGet(programId, lesson.id);
        if (res.success && res.data) {
          const data = res.data as {
            questions: {
              question: string;
              options: string[];
              correctIndex: number;
              point: number;
            }[];
            passScore: number;
          };
          if (Array.isArray(data.questions) && data.questions.length > 0) {
            setQuestions(data.questions);
          }
          setPassScore(data.passScore ?? 70);
        }
      } catch (e) {
        // ignore - có thể chưa có test
      } finally {
        setIsLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId, lesson.id]);

  const updateQuestion = (
    idx: number,
    field: keyof (typeof questions)[number],
    value: string | number
  ) => {
    setQuestions((qs) =>
      qs.map((q, i) => (i === idx ? { ...q, [field]: value } : q))
    );
  };
  const updateOption = (qIdx: number, optIdx: number, value: string) => {
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qIdx
          ? { ...q, options: q.options.map((o, j) => (j === optIdx ? value : o)) }
          : q
      )
    );
  };
  const addQuestion = () => {
    setQuestions((qs) => [
      ...qs,
      { question: "", options: ["", "", "", ""], correctIndex: 0, point: 10 },
    ]);
  };
  const removeQuestion = (idx: number) => {
    setQuestions((qs) => qs.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (questions.length === 0) {
      setError("Cần ít nhất 1 câu hỏi");
      return;
    }
    for (const [i, q] of questions.entries()) {
      if (!q.question.trim()) {
        setError(`Câu hỏi #${i + 1}: thiếu nội dung`);
        return;
      }
      if (q.options.length < 2) {
        setError(`Câu hỏi #${i + 1}: cần ≥ 2 đáp án`);
        return;
      }
      if (q.options.some((o) => !o.trim())) {
        setError(`Câu hỏi #${i + 1}: đáp án không được trống`);
        return;
      }
    }
    setIsSaving(true);
    setError(null);
    try {
      const res = await testServiceUpsert(programId, lesson.id, {
        questions,
        passScore,
      });
      if (res.success) {
        await onSaved();
      } else {
        setError((res as { error?: string }).error ?? "Lỗi lưu test");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bài test: {lesson.title}</DialogTitle>
          <DialogDescription>
            Câu hỏi được lưu trong subcollection{" "}
            <code>programs/{programId}/lessons/{lesson.id}/test</code>. Đáp án
            đúng không hiển thị cho nhân viên.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            Đang tải...
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>
                  <code className="text-xs">{error}</code>
                </AlertDescription>
              </Alert>
            )}

            {questions.map((q, qIdx) => (
              <div key={qIdx} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">
                    Câu hỏi #{qIdx + 1}
                  </span>
                  {questions.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeQuestion(qIdx)}
                      title="Xóa câu hỏi"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <Textarea
                  value={q.question}
                  onChange={(e) =>
                    updateQuestion(qIdx, "question", e.target.value)
                  }
                  placeholder="Nội dung câu hỏi..."
                  rows={2}
                />
                <div className="grid gap-2">
                  {q.options.map((opt, optIdx) => (
                    <div key={optIdx} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${qIdx}`}
                        checked={q.correctIndex === optIdx}
                        onChange={() =>
                          updateQuestion(qIdx, "correctIndex", optIdx)
                        }
                        className="mt-0.5"
                      />
                      <Input
                        value={opt}
                        onChange={(e) =>
                          updateOption(qIdx, optIdx, e.target.value)
                        }
                        placeholder={`Đáp án ${String.fromCharCode(65 + optIdx)}`}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs">Điểm:</label>
                  <Input
                    type="number"
                    min={1}
                    value={q.point}
                    onChange={(e) =>
                      updateQuestion(
                        qIdx,
                        "point",
                        parseInt(e.target.value || "1", 10)
                      )
                    }
                    className="w-20"
                  />
                </div>
              </div>
            ))}

            <Button variant="outline" onClick={addQuestion}>
              <Plus className="mr-2 h-4 w-4" />
              Thêm câu hỏi
            </Button>

            <div className="flex items-center gap-2">
              <label className="text-sm">Điểm đạt (%):</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={passScore}
                onChange={(e) =>
                  setPassScore(parseInt(e.target.value || "0", 10))
                }
                className="w-24"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose} disabled={isSaving}>
                Hủy
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Lưu bài test
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Local helpers để tránh vòng import
import { testService as _testService } from "@/services/training";
async function testServiceGet(programId: string, lessonId: string) {
  return _testService.getAdmin(programId, lessonId);
}
async function testServiceUpsert(
  programId: string,
  lessonId: string,
  body: { questions: { question: string; options: string[]; correctIndex: number; point: number }[]; passScore: number }
) {
  return _testService.upsert(programId, lessonId, body);
}
