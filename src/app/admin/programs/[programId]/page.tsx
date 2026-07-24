"use client";

import { useEffect, useState, use, useCallback, useRef } from "react";
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
  Users,
  BarChart3,
  MoreHorizontal,
  BookOpen,
  Target,
  Clock,
  Calendar,
  GripVertical,
  X,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageContainer } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { programService, lessonService } from "@/services/training";
import type { Program, Lesson, LessonContentType } from "@/types/training";
import { formatDateTime } from "@/utils";
import { performUpload } from "@/lib/upload";

// Lazy load TiptapEditor
const TiptapEditor = dynamic(
  () => import("@/components/tiptap-editor").then((m) => m.TiptapEditor),
  {
    loading: () => <div className="h-64 w-full animate-pulse rounded-md bg-muted" />,
    ssr: false,
  }
);

const TYPE_ICONS: Record<LessonContentType, React.ComponentType<{ className?: string }>> = {
  text: FileText,
  video: Video,
  pdf: FileType,
};

const TYPE_LABELS: Record<LessonContentType, string> = {
  text: "Văn bản",
  video: "Video",
  pdf: "PDF",
};

const TYPE_COLORS: Record<LessonContentType, string> = {
  text: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  video: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  pdf: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
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
  const isAdmin = user?.role === "admin" || user?.role === "manager";

  const [program, setProgram] = useState<Program | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit program
  const [editingProgram, setEditingProgram] = useState(false);
  const [programForm, setProgramForm] = useState({ title: "", description: "" });
  const [isSavingProgram, setIsSavingProgram] = useState(false);

  // Lesson form
  const [lessonForm, setLessonForm] = useState<LessonFormState | null>(null);
  const [isSavingLesson, setIsSavingLesson] = useState(false);
  const [draggedLesson, setDraggedLesson] = useState<string | null>(null);

  // Test editor
  const [testEditorLesson, setTestEditorLesson] = useState<Lesson | null>(null);

  // Publish
  const [isPublishing, setIsPublishing] = useState(false);

  // Preview mode
  const [isPreviewMode, setIsPreviewMode] = useState(false);

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
          (data.lessons ?? []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
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

  // Program actions
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

  // Lesson actions
  const openCreateLesson = () => {
    const nextOrder = lessons.length === 0 ? 1 : Math.max(...lessons.map((l) => l.order ?? 0)) + 1;
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
        // Create lesson
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
        
        // Upload file if exists
        if (lessonForm.contentType !== "text" && lessonForm.selectedFile && lessonForm.fileMeta) {
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
            setError((presignRes as { error?: string }).error ?? "Không tạo được presigned URL");
            setIsSavingLesson(false);
            return;
          }
          
          const { uploadUrl, fileKey, proxyUrl } = presignRes.data as {
            uploadUrl: string;
            fileKey: string;
            proxyUrl?: string | null;
          };
          const localFallback = (presignRes.data as { localFallback?: boolean }).localFallback;

          // Lấy token cho proxy mode
          let authToken: string | undefined;
          if (localFallback || proxyUrl) {
            const { auth } = await import("@/lib/firebase");
            if (auth.currentUser) {
              authToken = await auth.currentUser.getIdToken();
            }
          }

          const uploadRes = await performUpload({
            target: {
              uploadUrl,
              fileKey,
              expiresIn: 2 * 60 * 60,
              localFallback: localFallback ?? false,
              proxyUrl: proxyUrl ?? null,
            },
            file: lessonForm.selectedFile,
            contentType: lessonForm.fileMeta!.mimeType,
            authToken,
            onProgress: (pct) => {
              setLessonForm((f) => (f ? { ...f, uploadProgress: pct } : f));
            },
          });
          if (!uploadRes.ok) {
            setError(`Upload thất bại (${uploadRes.status}, mode=${uploadRes.mode}): ${uploadRes.bodyText}`);
            setIsSavingLesson(false);
            return;
          }

          // Confirm upload
          const confirmRes = await lessonService.confirmUpload(programId, newId, {
            fileKey,
            fileMeta: lessonForm.fileMeta,
          });
          if (!confirmRes.success) {
            setError((confirmRes as { error?: string }).error ?? "Lỗi xác nhận upload");
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
    if (!window.confirm(`Xóa lesson "${l.title}"?`)) return;
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

  // File upload
  const handleFileSelect = async (file: File) => {
    if (!lessonForm) return;
    const matches =
      lessonForm.contentType === "video"
        ? file.type.startsWith("video/")
        : file.type === "application/pdf";
    if (!matches) {
      setError(`File phải là ${lessonForm.contentType === "video" ? "video" : "PDF"}`);
      return;
    }

    setLessonForm((f) =>
      f ? { ...f, isUploading: true, uploadProgress: 0, uploadError: null, selectedFile: file } : f
    );
    try {
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
        throw new Error((presignRes as { error?: string }).error ?? "Không tạo được presigned URL");
      }
      const { uploadUrl, fileKey, proxyUrl } = presignRes.data as {
        uploadUrl: string;
        fileKey: string;
        proxyUrl?: string | null;
      };
      const localFallback = (presignRes.data as { localFallback?: boolean }).localFallback;

      let authToken: string | undefined;
      if (localFallback || proxyUrl) {
        const { auth } = await import("@/lib/firebase");
        if (auth.currentUser) {
          authToken = await auth.currentUser.getIdToken();
        }
      }

      const uploadRes = await performUpload({
        target: {
          uploadUrl,
          fileKey,
          expiresIn: 2 * 60 * 60,
          localFallback: localFallback ?? false,
          proxyUrl: proxyUrl ?? null,
        },
        file,
        contentType: file.type,
        authToken,
        onProgress: (pct) => {
          setLessonForm((f) => (f ? { ...f, uploadProgress: pct } : f));
        },
      });
      if (!uploadRes.ok) {
        throw new Error(
          `Upload thất bại (${uploadRes.status}, mode=${uploadRes.mode}): ${uploadRes.bodyText.slice(0, 200)}`
        );
      }

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
        f ? { ...f, isUploading: false, uploadError: e instanceof Error ? e.message : String(e) } : f
      );
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (isLoading) {
    return (
      <PageContainer title="...">
        <Skeleton className="h-8 w-64 mb-4" />
        <div className="space-y-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
        </div>
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
            Quay lại danh sách
          </Link>
        </Button>
      </PageContainer>
    );
  }

  const isPublished = program.status === "published";

  return (
    <PageContainer
      title={editingProgram ? "Sửa chương trình" : program.title}
      breadcrumbs={[
        { label: "Quản trị", href: "/admin" },
        { label: "Chương trình", href: "/admin/programs" },
        { label: program.title },
      ]}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/programs">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Quay lại
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsPreviewMode(true)}
          >
            <Eye className="mr-2 h-4 w-4" />
            Xem trước
          </Button>
          {isAdmin && (
            <>
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
                {isPublished ? "Hủy publish" : "Publish"}
              </Button>
            </>
          )}
        </div>
      }
    >
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>
            <code className="text-xs">{error}</code>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6">
        {/* Program Header Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Badge variant={isPublished ? "success" : "secondary"}>
                    {isPublished ? "Đã publish" : "Bản nháp"}
                  </Badge>
                  {isPublished && program.publishedAt && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {formatDateTime(program.publishedAt)}
                    </span>
                  )}
                </div>
                {editingProgram ? (
                  <div className="space-y-4 max-w-2xl">
                    <div>
                      <Label htmlFor="edit-title">Tiêu đề</Label>
                      <Input
                        id="edit-title"
                        value={programForm.title}
                        onChange={(e) =>
                          setProgramForm((f) => ({ ...f, title: e.target.value }))
                        }
                        disabled={isPublished}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-desc">Mô tả</Label>
                      <Textarea
                        id="edit-desc"
                        value={programForm.description}
                        onChange={(e) =>
                          setProgramForm((f) => ({ ...f, description: e.target.value }))
                        }
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingProgram(false);
                          setProgramForm({ title: program.title, description: program.description ?? "" });
                        }}
                      >
                        Hủy
                      </Button>
                      <Button onClick={handleSaveProgram} disabled={isSavingProgram}>
                        {isSavingProgram && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Lưu
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className="text-2xl font-bold mb-2">{program.title}</h2>
                    {program.description && (
                      <p className="text-muted-foreground mb-4">{program.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Tạo: {formatDateTime(program.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-4 w-4" />
                        {lessons.length} bài học
                      </span>
                    </div>
                  </>
                )}
              </div>
              {isAdmin && !editingProgram && (
                <Button variant="outline" size="sm" onClick={() => setEditingProgram(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Sửa
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Gán chương trình
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Gán chương trình cho nhân viên để họ có thể tham gia học.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/admin/assignments?programId=${programId}`}>
                  <Users className="mr-2 h-4 w-4" />
                  Gán cho nhân viên
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Theo dõi tiến độ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Xem báo cáo chi tiết về tiến độ học tập của nhân viên.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/admin/reports?programId=${programId}`}>
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Xem báo cáo
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Lessons Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Bài học ({lessons.length})
                </CardTitle>
                <CardDescription>
                  Kéo thả để sắp xếp thứ tự. Mỗi bài có thể kèm bài kiểm tra.
                </CardDescription>
              </div>
              {isAdmin && (
                <Button onClick={openCreateLesson}>
                  <Plus className="mr-2 h-4 w-4" />
                  Thêm bài học
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {lessons.length === 0 ? (
              <div className="py-12 text-center">
                <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-medium mb-2">Chưa có bài học nào</h3>
                <p className="text-muted-foreground mb-6">
                  Thêm bài học đầu tiên để hoàn thiện chương trình đào tạo.
                </p>
                {isAdmin && (
                  <Button onClick={openCreateLesson}>
                    <Plus className="mr-2 h-4 w-4" />
                    Thêm bài học đầu tiên
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {lessons.map((l, idx) => {
                  const Icon = TYPE_ICONS[l.contentType];
                  const colorClass = TYPE_COLORS[l.contentType];
                  return (
                    <div
                      key={l.id}
                      className={`
                        flex items-center gap-3 rounded-lg border p-4 transition-all
                        hover:shadow-sm
                        ${draggedLesson === l.id ? "opacity-50 bg-muted" : ""}
                      `}
                    >
                      {/* Drag handle */}
                      {isAdmin && (
                        <div className="cursor-grab text-muted-foreground">
                          <GripVertical className="h-5 w-5" />
                        </div>
                      )}

                      {/* Order controls */}
                      {isAdmin && (
                        <div className="flex flex-col">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={idx === 0}
                            onClick={() => handleMoveLesson(l, -1)}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={idx === lessons.length - 1}
                            onClick={() => handleMoveLesson(l, 1)}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>
                      )}

                      {/* Order badge */}
                      <Badge variant="outline" className="shrink-0">
                        #{l.order}
                      </Badge>

                      {/* Type icon */}
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{l.title}</h4>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{TYPE_LABELS[l.contentType]}</span>
                          {l.fileMeta && (
                            <span>{(l.fileMeta.size / 1024 / 1024).toFixed(1)} MB</span>
                          )}
                          {l.hasTest && (
                            <Badge variant="secondary" className="text-xs">
                              <Award className="h-3 w-3 mr-1" />
                              Có test
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      {isAdmin && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant={l.hasTest ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => setTestEditorLesson(l)}
                          >
                            <Award className="mr-1 h-4 w-4" />
                            {l.hasTest ? "Sửa test" : "Thêm test"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditLesson(l)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteLesson(l)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
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
      </div>

      {/* Lesson Form Dialog */}
      <Dialog open={Boolean(lessonForm)} onOpenChange={(o) => !o && closeLessonForm()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {lessonForm?.id ? "Sửa bài học" : "Thêm bài học mới"}
            </DialogTitle>
            <DialogDescription>
              {lessonForm?.id
                ? `ID: ${lessonForm.id}`
                : `Thêm vào chương trình: ${program.title}`}
            </DialogDescription>
          </DialogHeader>
          {lessonForm && (
            <div className="space-y-6">
              {/* Title */}
              <div>
                <Label htmlFor="lesson-title">
                  Tiêu đề <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="lesson-title"
                  value={lessonForm.title}
                  onChange={(e) =>
                    setLessonForm((f) => f ? { ...f, title: e.target.value } : f)
                  }
                  placeholder="VD: Giới thiệu về an toàn lao động"
                />
              </div>

              {/* Content Type */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Loại nội dung</Label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {(["text", "video", "pdf"] as LessonContentType[]).map((type) => {
                      const Icon = TYPE_ICONS[type];
                      const colorClass = TYPE_COLORS[type];
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() =>
                            setLessonForm((f) =>
                              f
                                ? {
                                    ...f,
                                    contentType: type,
                                    fileKey: "",
                                    fileMeta: null,
                                    selectedFile: null,
                                  }
                                : f
                            )
                          }
                          className={`
                            flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all
                            ${lessonForm.contentType === type
                              ? `border-primary ${colorClass}`
                              : "border-border hover:border-primary/50"
                            }
                          `}
                        >
                          <Icon className="h-6 w-6" />
                          <span className="text-sm font-medium">{TYPE_LABELS[type]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <Label htmlFor="lesson-order">Thứ tự</Label>
                  <Input
                    id="lesson-order"
                    type="number"
                    min={1}
                    value={lessonForm.order}
                    onChange={(e) =>
                      setLessonForm((f) =>
                        f ? { ...f, order: parseInt(e.target.value || "1", 10) } : f
                      )
                    }
                  />
                </div>
              </div>

              {/* Content based on type */}
              {lessonForm.contentType === "text" ? (
                <div>
                  <Label>Nội dung</Label>
                  <div className="mt-2">
                    <TiptapEditor
                      value={lessonForm.textContent}
                      onChange={(value) =>
                        setLessonForm((f) => f ? { ...f, textContent: value } : f)
                      }
                      placeholder="Nhập nội dung bài học..."
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <Label>File {lessonForm.contentType === "video" ? "Video" : "PDF"}</Label>
                  <div className="mt-2 rounded-lg border-2 border-dashed p-6 text-center">
                    {lessonForm.fileMeta ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${TYPE_COLORS[lessonForm.contentType]}`}>
                            {lessonForm.contentType === "video" ? (
                              <Video className="h-6 w-6" />
                            ) : (
                              <FileType className="h-6 w-6" />
                            )}
                          </div>
                          <div className="text-left">
                            <p className="font-medium">{lessonForm.fileMeta.fileName}</p>
                            <p className="text-sm text-muted-foreground">
                              {(lessonForm.fileMeta.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setLessonForm((f) =>
                                f ? { ...f, fileKey: "", fileMeta: null, selectedFile: null } : f
                              )
                            }
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <input
                          type="file"
                          accept={lessonForm.contentType === "video" ? "video/*" : "application/pdf"}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleFileSelect(f);
                          }}
                          disabled={lessonForm.isUploading}
                          className="hidden"
                          id="file-upload"
                        />
                        <label htmlFor="file-upload" className="cursor-pointer">
                          <div className="flex flex-col items-center gap-2">
                            <div className={`h-12 w-12 rounded-full bg-muted flex items-center justify-center`}>
                              {lessonForm.contentType === "video" ? (
                                <Video className="h-6 w-6 text-muted-foreground" />
                              ) : (
                                <FileType className="h-6 w-6 text-muted-foreground" />
                              )}
                            </div>
                            <p className="text-sm font-medium">
                              {lessonForm.isUploading
                                ? "Đang upload..."
                                : "Click để chọn file"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {lessonForm.contentType === "video"
                                ? "Hỗ trợ: MP4, MOV, WebM..."
                                : "Hỗ trợ: PDF"}
                            </p>
                          </div>
                        </label>
                      </div>
                    )}
                    {lessonForm.uploadError && (
                      <p className="mt-2 text-sm text-destructive">{lessonForm.uploadError}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={closeLessonForm} disabled={isSavingLesson}>
                  Hủy
                </Button>
                <Button
                  onClick={handleSaveLesson}
                  disabled={isSavingLesson || lessonForm.isUploading}
                >
                  {isSavingLesson && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {lessonForm.id ? "Cập nhật" : "Tạo bài học"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Test Editor Dialog */}
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

      {/* Preview Dialog */}
      <Dialog open={isPreviewMode} onOpenChange={(o) => setIsPreviewMode(o)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Xem trước chương trình</DialogTitle>
            <DialogDescription>
              Chế độ xem trước như nhân viên sẽ thấy
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="text-center py-8">
              <h2 className="text-2xl font-bold mb-2">{program.title}</h2>
              {program.description && <p className="text-muted-foreground">{program.description}</p>}
              <Badge variant="success" className="mt-4">
                {lessons.length} bài học
              </Badge>
            </div>
            <div className="space-y-2">
              {lessons.map((l, idx) => {
                const LessonIcon = TYPE_ICONS[l.contentType];
                return (
                  <div key={l.id} className="flex items-center gap-3 p-4 rounded-lg border">
                    <Badge variant="outline">{idx + 1}</Badge>
                    <LessonIcon className="h-5 w-5 text-muted-foreground" />
                    <span className="flex-1">{l.title}</span>
                    {l.hasTest && <Badge>Có test</Badge>}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setIsPreviewMode(false)}>
                Đóng
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

// Test Editor Dialog
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
  const [questions, setQuestions] = useState([
    { question: "", options: ["", "", "", ""], correctIndex: 0, point: 10 },
  ]);
  const [passScore, setPassScore] = useState(70);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await import("@/services/training").then((m) =>
          m.testService.getAdmin(programId, lesson.id)
        );
        if (res.success && res.data) {
          const data = res.data as {
            questions: { question: string; options: string[]; correctIndex: number; point: number }[];
            passScore: number;
          };
          if (Array.isArray(data.questions) && data.questions.length > 0) {
            setQuestions(data.questions);
          }
          setPassScore(data.passScore ?? 70);
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [programId, lesson.id]);

  const updateQuestion = (idx: number, field: keyof typeof questions[number], value: string | number) => {
    setQuestions((qs) =>
      qs.map((q, i) => (i === idx ? { ...q, [field]: value } : q))
    );
  };

  const updateOption = (qIdx: number, optIdx: number, value: string) => {
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qIdx ? { ...q, options: q.options.map((o, j) => (j === optIdx ? value : o)) } : q
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
      if (q.options.some((o) => !o.trim())) {
        setError(`Câu hỏi #${i + 1}: đáp án không được trống`);
        return;
      }
    }
    setIsSaving(true);
    setError(null);
    try {
      const res = await import("@/services/training").then((m) =>
        m.testService.upsert(programId, lesson.id, { questions, passScore })
      );
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
          <DialogTitle>Bài kiểm tra: {lesson.title}</DialogTitle>
          <DialogDescription>
            Thiết lập câu hỏi và đáp án đúng. Nhân viên sẽ không thấy đáp án đúng.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="py-8 text-center">Đang tải...</div>
        ) : (
          <div className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {questions.map((q, qIdx) => (
              <div key={qIdx} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Câu hỏi #{qIdx + 1}</span>
                  {questions.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeQuestion(qIdx)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <Textarea
                  value={q.question}
                  onChange={(e) => updateQuestion(qIdx, "question", e.target.value)}
                  placeholder="Nhập nội dung câu hỏi..."
                  rows={2}
                />
                <div className="space-y-2">
                  {q.options.map((opt, optIdx) => (
                    <div key={optIdx} className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={q.correctIndex === optIdx}
                        onChange={() => updateQuestion(qIdx, "correctIndex", optIdx)}
                        className="shrink-0"
                      />
                      <Input
                        value={opt}
                        onChange={(e) => updateOption(qIdx, optIdx, e.target.value)}
                        placeholder={`Đáp án ${String.fromCharCode(65 + optIdx)}`}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Điểm:</Label>
                  <Input
                    type="number"
                    min={1}
                    value={q.point}
                    onChange={(e) => updateQuestion(qIdx, "point", parseInt(e.target.value || "1", 10))}
                    className="w-20"
                  />
                </div>
              </div>
            ))}

            <Button variant="outline" onClick={addQuestion}>
              <Plus className="mr-2 h-4 w-4" />
              Thêm câu hỏi
            </Button>

            <div className="flex items-center gap-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <Label>Điểm đạt (%):</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={passScore}
                  onChange={(e) => setPassScore(parseInt(e.target.value || "0", 10))}
                  className="w-20"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={onClose} disabled={isSaving}>
                Hủy
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Lưu bài test
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
