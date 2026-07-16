"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Loader2,
  ShieldCheck,
  Trash2,
  Save,
  Edit,
  ChevronLeft,
  GripVertical,
  PlayCircle,
  FileText,
  Link2,
  Award,
  Eye,
  Youtube,
  ExternalLink,
  CheckCircle2,
  Circle,
  X,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageContainer } from "@/components/layout";
import {
  useAuth,
  useDoc,
  useSubcollection,
  fqOrderBy,
} from "@/hooks";
import {
  extractYouTubeId,
  buildYouTubeEmbedUrl,
  buildYouTubeWatchUrl,
} from "@/lib/youtube";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

type LessonType = "video" | "document" | "quiz" | "link";

export type ProtectMode = "standard" | "locked" | "proxy";

interface LessonDoc {
  id: string;
  title: string;
  description?: string;
  order: number;
  type: LessonType;
  duration?: number;
  isPreview?: boolean;
  content: {
    youtubeId?: string;
    videoUrl?: string;
    documentUrl?: string;
    documentType?: string;
    quizId?: string;
    linkUrl?: string;
    linkLabel?: string;
    protectMode?: "standard" | "locked" | "proxy";
  };
}

type QuestionType = "multiple_choice" | "true_false" | "fill_blank";

interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface QuestionDraft {
  id: string;
  type: QuestionType;
  text: string;
  points: number;
  options: QuestionOption[];
  correctAnswer: string;
}

interface QuizDraft {
  quizId: string;
  title: string;
  description: string;
  timeLimit: number;
  passingScore: number;
  questions: QuestionDraft[];
}

interface LessonFormState {
  title: string;
  description: string;
  type: LessonType;
  order: number;
  duration: number;
  isPreview: boolean;
  youtubeUrl: string;
  youtubeId: string;
  videoUrl: string;
  documentUrl: string;
  documentType: string;
  quizId: string;
  linkUrl: string;
  linkLabel: string;
  protectMode: ProtectMode;
  quiz: QuizDraft;
}

const EMPTY_QUESTION = (): QuestionDraft => ({
  id: `q-${Math.random().toString(36).slice(2, 9)}`,
  type: "multiple_choice",
  text: "",
  points: 1,
  options: [
    { id: `o-${Math.random().toString(36).slice(2, 6)}`, text: "", isCorrect: true },
    { id: `o-${Math.random().toString(36).slice(2, 6)}`, text: "", isCorrect: false },
  ],
  correctAnswer: "",
});

const EMPTY_QUIZ: QuizDraft = {
  quizId: "",
  title: "",
  description: "",
  timeLimit: 0,
  passingScore: 70,
  questions: [EMPTY_QUESTION()],
};

const EMPTY_FORM: LessonFormState = {
  title: "",
  description: "",
  type: "video",
  order: 1,
  duration: 600,
  isPreview: false,
  youtubeUrl: "",
  youtubeId: "",
  videoUrl: "",
  documentUrl: "",
  documentType: "pdf",
  quizId: "",
  linkUrl: "",
  linkLabel: "",
  protectMode: "locked",
  quiz: { ...EMPTY_QUIZ, questions: [EMPTY_QUESTION()] },
};

const TYPE_ICONS: Record<LessonType, React.ComponentType<{ className?: string }>> = {
  video: PlayCircle,
  document: FileText,
  quiz: Award,
  link: Link2,
};

function lessonToForm(l: LessonDoc): LessonFormState {
  const ytId = l.content.youtubeId ?? "";
  return {
    title: l.title,
    description: l.description ?? "",
    type: l.type,
    order: l.order ?? 1,
    duration: l.duration ?? 0,
    isPreview: l.isPreview ?? false,
    youtubeUrl: ytId ? buildYouTubeWatchUrl(ytId) : "",
    youtubeId: ytId,
    videoUrl: l.content.videoUrl ?? "",
    documentUrl: l.content.documentUrl ?? "",
    documentType: l.content.documentType ?? "pdf",
    quizId: l.content.quizId ?? "",
    linkUrl: l.content.linkUrl ?? "",
    linkLabel: l.content.linkLabel ?? "",
    protectMode: l.content.protectMode ?? "locked",
    quiz: { ...EMPTY_QUIZ, questions: [EMPTY_QUESTION()] },
  };
}

function formToContent(f: LessonFormState) {
  const content: LessonDoc["content"] = {};
  if (f.type === "video") {
    if (f.youtubeId.trim()) content.youtubeId = f.youtubeId.trim();
    if (f.videoUrl.trim()) content.videoUrl = f.videoUrl.trim();
    content.protectMode = f.protectMode;
  } else if (f.type === "document") {
    if (f.documentUrl.trim()) content.documentUrl = f.documentUrl.trim();
    if (f.documentType) content.documentType = f.documentType;
  } else if (f.type === "link") {
    if (f.linkUrl.trim()) content.linkUrl = f.linkUrl.trim();
    if (f.linkLabel.trim()) content.linkLabel = f.linkLabel.trim();
  } else if (f.type === "quiz") {
    if (f.quiz.quizId.trim()) content.quizId = f.quiz.quizId.trim();
  }
  return content;
}

/** Convert QuestionDraft sang Question shape lưu trong Firestore. */
function questionDraftToFirestore(q: QuestionDraft) {
  if (q.type === "fill_blank") {
    return {
      id: q.id,
      type: q.type,
      text: q.text,
      points: q.points,
      correctAnswer: q.correctAnswer,
    };
  }
  return {
    id: q.id,
    type: q.type,
    text: q.text,
    points: q.points,
    options: q.options,
  };
}

export default function AdminCourseLessonsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);
  const { user } = useAuth();

  const [lessons, setLessons] = useState<LessonDoc[]>([]);

  const [editing, setEditing] = useState<LessonDoc | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<LessonFormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [previewing, setPreviewing] = useState<LessonDoc | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";

  // React Query: cache course + lessons tự động, dedupe, không flash khi quay lại tab
  const { data: courseSnap } = useDoc<{ title?: string }>(`courses/${courseId}`);
  const courseTitle = useMemo(
    () => courseSnap?.title || courseId,
    [courseSnap, courseId]
  );

  const {
    data: rqLessons = [],
    isLoading,
    error: rqError,
    refetch,
  } = useSubcollection<LessonDoc & { id: string }>(
    `courses/${courseId}`,
    "lessons",
    [fqOrderBy("order")],
    ["by-order"]
  );

  // Sync về local state để optimistic update cho delete/move
  useEffect(() => {
    setLessons(rqLessons);
  }, [rqLessons]);

  const [error, setError] = useState<string | null>(
    rqError ? String(rqError) : null
  );

  /** Mở form tạo + load quiz nếu đã có quizId (khi edit lesson có quiz link sẵn). */
  const loadQuizForEdit = useCallback(
    async (quizId: string): Promise<QuizDraft | null> => {
      if (!quizId) return null;
      try {
        const [qSnap, subSnap] = await Promise.all([
          getDoc(doc(db, "quizzes", quizId)),
          getDoc(doc(db, "courses", courseId, "quizzes", quizId)),
        ]);
        const snap = qSnap.exists() ? qSnap : subSnap;
        if (!snap.exists()) return null;
        const data = snap.data();
        const rawQuestions = (data.questions as Array<Record<string, unknown>>) ?? [];
        const questions: QuestionDraft[] = rawQuestions.map((q) => ({
          id: (q.id as string) ?? `q-${Math.random().toString(36).slice(2, 9)}`,
          type: (q.type as QuestionType) ?? "multiple_choice",
          text: (q.text as string) ?? "",
          points: (q.points as number) ?? 1,
          options:
            (q.options as QuestionOption[]) ?? [
              { id: `o-${Math.random().toString(36).slice(2, 6)}`, text: "", isCorrect: true },
              { id: `o-${Math.random().toString(36).slice(2, 6)}`, text: "", isCorrect: false },
            ],
          correctAnswer: (q.correctAnswer as string) ?? "",
        }));
        return {
          quizId: snap.id,
          title: (data.title as string) ?? "",
          description: (data.description as string) ?? "",
          timeLimit: (data.timeLimit as number) ?? 0,
          passingScore: (data.passingScore as number) ?? 70,
          questions: questions.length > 0 ? questions : [EMPTY_QUESTION()],
        };
      } catch {
        return null;
      }
    },
    [courseId]
  );

  const openCreate = useCallback(() => {
    const nextOrder =
      lessons.length === 0
        ? 1
        : Math.max(...lessons.map((l) => l.order ?? 0)) + 1;
    setForm({ ...EMPTY_FORM, order: nextOrder });
    setEditing(null);
    setCreating(true);
  }, [lessons]);

  const openEdit = useCallback(
    async (l: LessonDoc) => {
      setForm(lessonToForm(l));
      setEditing(l);
      setCreating(true);
      if (l.type === "quiz" && l.content.quizId) {
        const quiz = await loadQuizForEdit(l.content.quizId);
        if (quiz) {
          setForm((f) => ({ ...f, quiz }));
        }
      }
    },
    [loadQuizForEdit]
  );

  const closeForm = useCallback(() => {
    setCreating(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.title.trim()) {
      setError("Tiêu đề không được để trống.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const lessonPayload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        type: form.type,
        order: form.order,
        duration: form.duration,
        isPreview: form.isPreview,
        content: formToContent(form),
        updatedAt: serverTimestamp(),
      };

      let lessonId = editing?.id;

      if (editing) {
        await updateDoc(
          doc(db, "courses", courseId, "lessons", editing.id),
          lessonPayload
        );
      } else {
        const ref = await addDoc(collection(db, "courses", courseId, "lessons"), {
          ...lessonPayload,
          createdAt: serverTimestamp(),
        });
        lessonId = ref.id;
      }

      // Nếu lesson là quiz: tạo/cập nhật quiz doc trong subcollection
      if (form.type === "quiz" && lessonId) {
        const validQuestions = form.quiz.questions.filter(
          (q) => q.text.trim().length > 0
        );
        if (validQuestions.length > 0) {
          const quizPayload = {
            title: form.quiz.title.trim() || form.title.trim(),
            description: form.quiz.description.trim() || undefined,
            timeLimit: form.quiz.timeLimit > 0 ? form.quiz.timeLimit : undefined,
            passingScore: form.quiz.passingScore,
            questions: validQuestions.map(questionDraftToFirestore),
            updatedAt: serverTimestamp(),
          };
          if (form.quiz.quizId) {
            // Cập nhật quiz hiện có
            const qRef = doc(
              db,
              "courses",
              courseId,
              "quizzes",
              form.quiz.quizId
            );
            await updateDoc(qRef, quizPayload);
          } else {
            // Tạo quiz mới + update lesson.content.quizId
            const newQuizRef = await addDoc(
              collection(db, "courses", courseId, "quizzes"),
              {
                ...quizPayload,
                createdAt: serverTimestamp(),
              }
            );
            await updateDoc(
              doc(db, "courses", courseId, "lessons", lessonId),
              { "content.quizId": newQuizRef.id, updatedAt: serverTimestamp() }
            );
          }
        }
      }

      closeForm();
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSaving(false);
    }
  }, [form, editing, courseId, refetch, closeForm]);

  const handleDelete = useCallback(
    async (l: LessonDoc) => {
      if (!window.confirm(`Xóa bài học "${l.title}"? Không thể hoàn tác.`)) return;
      setActionBusy(l.id);
      try {
        // Xóa lesson + quiz liên kết (nếu có) cùng lúc
        const batch = writeBatch(db);
        batch.delete(doc(db, "courses", courseId, "lessons", l.id));
        if (l.type === "quiz" && l.content.quizId) {
          batch.delete(
            doc(db, "courses", courseId, "quizzes", l.content.quizId)
          );
        }
        await batch.commit();
        // Optimistic update
        setLessons((prev) => prev.filter((x) => x.id !== l.id));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setActionBusy(null);
      }
    },
    [courseId]
  );

  const handleMove = useCallback(
    async (l: LessonDoc, dir: -1 | 1) => {
      const idx = lessons.findIndex((x) => x.id === l.id);
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= lessons.length) return;
      const swapWith = lessons[swapIdx];
      // Optimistic update trước khi gọi DB
      const newList = [...lessons];
      newList[idx] = swapWith;
      newList[swapIdx] = l;
      newList.sort((a, b) => a.order - b.order);
      setLessons(newList);

      try {
        await Promise.all([
          updateDoc(doc(db, "courses", courseId, "lessons", l.id), {
            order: swapWith.order,
            updatedAt: serverTimestamp(),
          }),
          updateDoc(doc(db, "courses", courseId, "lessons", swapWith.id), {
            order: l.order,
            updatedAt: serverTimestamp(),
          }),
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        // Revert nếu lỗi
        await refetch();
      }
    },
    [lessons, courseId, refetch]
  );

  const ytPreviewSrc = useMemo(() => {
    const id = extractYouTubeId(form.youtubeId) ?? extractYouTubeId(form.youtubeUrl);
    if (!id) return null;
    return buildYouTubeEmbedUrl(id);
  }, [form.youtubeId, form.youtubeUrl]);

  // Quiz CRUD handlers
  const updateQuiz = useCallback(
    (patch: Partial<QuizDraft>) => {
      setForm((f) => ({ ...f, quiz: { ...f.quiz, ...patch } }));
    },
    []
  );

  const addQuestion = useCallback(() => {
    setForm((f) => ({
      ...f,
      quiz: { ...f.quiz, questions: [...f.quiz.questions, EMPTY_QUESTION()] },
    }));
  }, []);

  const updateQuestion = useCallback(
    (qid: string, patch: Partial<QuestionDraft>) => {
      setForm((f) => ({
        ...f,
        quiz: {
          ...f.quiz,
          questions: f.quiz.questions.map((q) =>
            q.id === qid ? { ...q, ...patch } : q
          ),
        },
      }));
    },
    []
  );

  const removeQuestion = useCallback((qid: string) => {
    setForm((f) => ({
      ...f,
      quiz: {
        ...f.quiz,
        questions: f.quiz.questions.filter((q) => q.id !== qid),
      },
    }));
  }, []);

  const moveQuestion = useCallback((qid: string, dir: -1 | 1) => {
    setForm((f) => {
      const idx = f.quiz.questions.findIndex((q) => q.id === qid);
      if (idx < 0) return f;
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= f.quiz.questions.length) return f;
      const list = [...f.quiz.questions];
      [list[idx], list[swapIdx]] = [list[swapIdx], list[idx]];
      return { ...f, quiz: { ...f.quiz, questions: list } };
    });
  }, []);

  return (
    <PageContainer
      title="Quản lý bài học"
      description={courseTitle}
      breadcrumbs={[
        { label: "Quản trị", href: "/admin" },
        { label: "Khóa học", href: "/admin/courses" },
        { label: courseTitle || "..." },
      ]}
      actions={
        isAdmin ? (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Tạo bài học mới
          </Button>
        ) : undefined
      }
    >
      <div className="mb-4">
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/courses">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Quay lại
          </Link>
        </Button>
      </div>

      {!user && (
        <Alert variant="destructive">
          <AlertDescription>Bạn cần đăng nhập.</AlertDescription>
        </Alert>
      )}

      {user && !isAdmin && (
        <Alert variant="destructive">
          <AlertDescription>
            Bạn đang đăng nhập với role <strong>{user.role}</strong>. Chỉ{" "}
            <strong>admin</strong> mới có quyền tạo/sửa/xóa bài học.
          </AlertDescription>
        </Alert>
      )}

      {user && isAdmin && (
        <Alert className="border-green-500/50 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100 mb-4">
          <ShieldCheck className="h-4 w-4" />
          <AlertDescription>
            Đã đăng nhập với quyền <strong>admin</strong>.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            Lỗi: <code className="text-xs">{error}</code>
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : lessons.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Khóa học này chưa có bài học nào.{" "}
            {isAdmin && (
              <Button variant="link" onClick={openCreate} className="px-1">
                Tạo bài học đầu tiên
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {lessons.map((l, idx) => {
            const Icon = TYPE_ICONS[l.type];
            const hasYt = Boolean(l.content.youtubeId);
            const hasExternal = Boolean(l.content.videoUrl);
            const busy = actionBusy === l.id;
            return (
              <Card key={l.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={idx === 0 || !isAdmin || busy}
                        onClick={() => handleMove(l, -1)}
                        title="Lên"
                      >
                        ▲
                      </Button>
                      <GripVertical className="h-4 w-4 text-muted-foreground mx-auto" />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={idx === lessons.length - 1 || !isAdmin || busy}
                        onClick={() => handleMove(l, 1)}
                        title="Xuống"
                      >
                        ▼
                      </Button>
                    </div>

                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge variant="outline">#{l.order}</Badge>
                        <Badge variant="secondary">{l.type}</Badge>
                        {l.isPreview && <Badge>Xem trước</Badge>}
                        {l.type === "video" && hasYt && (
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                            <Youtube className="h-3 w-3 mr-1" />
                            YouTube
                          </Badge>
                        )}
                        {l.type === "video" && hasExternal && (
                          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            URL ngoài
                          </Badge>
                        )}
                        {l.duration && l.duration > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {Math.round(l.duration / 60)} phút
                          </span>
                        )}
                      </div>
                      <CardTitle className="text-base">{l.title}</CardTitle>
                      {l.description && (
                        <CardDescription className="line-clamp-2">
                          {l.description}
                        </CardDescription>
                      )}
                      <code className="text-xs text-muted-foreground break-all block">
                        {l.type === "video" &&
                          (l.content.youtubeId
                            ? `youtubeId: ${l.content.youtubeId}`
                            : l.content.videoUrl
                            ? `videoUrl: ${l.content.videoUrl}`
                            : "❌ chưa có youtubeId/videoUrl")}
                        {l.type === "document" &&
                          (l.content.documentUrl ?? "❌ chưa có documentUrl")}
                        {l.type === "quiz" &&
                          (l.content.quizId ?? "❌ chưa có quizId")}
                        {l.type === "link" &&
                          (l.content.linkUrl ?? "❌ chưa có linkUrl")}
                      </code>
                    </div>

                    {isAdmin && (
                      <div className="flex gap-1 shrink-0">
                        {(l.type === "video" || l.type === "link") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setPreviewing(l)}
                            title="Xem trước"
                            disabled={busy}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(l)}
                          title="Sửa"
                          disabled={busy}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(l)}
                          title="Xóa"
                          disabled={busy}
                        >
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={creating} onOpenChange={(o) => !o && closeForm()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Sửa bài học" : "Tạo bài học mới"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? `ID: ${editing.id}`
                : `Sẽ lưu trong courses/${courseId}/lessons/`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="lesson-title">Tiêu đề *</Label>
              <Input
                id="lesson-title"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="Giới thiệu về React"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="lesson-desc">Mô tả</Label>
              <Textarea
                id="lesson-desc"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Tóm tắt nội dung bài học..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="lesson-type">Loại</Label>
                <select
                  id="lesson-type"
                  value={form.type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      type: e.target.value as LessonType,
                    }))
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="video">Video</option>
                  <option value="document">Tài liệu</option>
                  <option value="quiz">Quiz</option>
                  <option value="link">Liên kết</option>
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="lesson-order">Thứ tự</Label>
                <Input
                  id="lesson-order"
                  type="number"
                  min={1}
                  value={form.order}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      order: parseInt(e.target.value || "1", 10),
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="lesson-duration">Thời lượng (giây)</Label>
                <Input
                  id="lesson-duration"
                  type="number"
                  min={0}
                  value={form.duration}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      duration: parseInt(e.target.value || "0", 10),
                    }))
                  }
                />
              </div>

              <div className="flex items-end gap-2 pb-2">
                <Checkbox
                  id="isPreview"
                  checked={form.isPreview}
                  onCheckedChange={(v) =>
                    setForm((f) => ({ ...f, isPreview: Boolean(v) }))
                  }
                />
                <Label htmlFor="isPreview" className="text-sm cursor-pointer">
                  Cho phép xem trước (không cần đăng ký)
                </Label>
              </div>
            </div>

            {form.type === "video" && (
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Youtube className="h-4 w-4 text-red-600" />
                  Video (YouTube hoặc URL trực tiếp)
                </p>

                <div className="grid gap-2">
                  <Label htmlFor="yt-url" className="text-xs">
                    Dán link chia sẻ YouTube
                  </Label>
                  <Input
                    id="yt-url"
                    value={form.youtubeUrl}
                    onChange={(e) => {
                      const url = e.target.value;
                      const id = extractYouTubeId(url);
                      setForm((f) => ({
                        ...f,
                        youtubeUrl: url,
                        youtubeId: id ?? f.youtubeId,
                      }));
                    }}
                    placeholder="https://www.youtube.com/watch?v=gokUZVjCzow  hoặc  https://youtu.be/gokUZVjCzow"
                  />
                  <p className="text-xs text-muted-foreground">
                    Hỗ trợ: <code>youtube.com/watch?v=...</code>,{" "}
                    <code>youtu.be/...</code>, <code>youtube.com/shorts/...</code>,{" "}
                    <code>youtube.com/embed/...</code>
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="yt-id" className="text-xs">
                    Hoặc nhập YouTube ID thủ công (tùy chọn)
                  </Label>
                  <Input
                    id="yt-id"
                    value={form.youtubeId}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const id = extractYouTubeId(raw);
                      setForm((f) => ({
                        ...f,
                        youtubeId: id ?? raw,
                        youtubeUrl: id ? buildYouTubeWatchUrl(id) : f.youtubeUrl,
                      }));
                    }}
                    placeholder="vd: gokUZVjCzow"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="video-url" className="text-xs">
                    Hoặc URL video trực tiếp (.mp4 / .webm)
                  </Label>
                  <Input
                    id="video-url"
                    value={form.videoUrl}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, videoUrl: e.target.value }))
                    }
                    placeholder="https://example.com/video.mp4"
                  />
                  <p className="text-xs text-muted-foreground">
                    Video sẽ stream qua proxy <code>/api/video/...</code>. URL gốc
                    không bao giờ lộ ra client. Domain phải thuộc allowlist.
                  </p>
                </div>

                <div className="rounded-md bg-muted/50 p-3 space-y-2">
                  <p className="text-xs font-semibold flex items-center gap-2">
                    <ShieldCheck className="h-3 w-3" />
                    Chế độ bảo vệ video
                  </p>
                  <RadioGroup
                    value={form.protectMode}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, protectMode: v as ProtectMode }))
                    }
                  >
                    <div className="flex items-start gap-2 p-1.5 rounded hover:bg-background/50">
                      <RadioGroupItem value="standard" id="pm-standard" className="mt-0.5" />
                      <Label htmlFor="pm-standard" className="cursor-pointer flex-1">
                        <div className="text-xs font-medium">Standard (embed thường)</div>
                        <div className="text-xs text-muted-foreground">
                          Hiển thị iframe YouTube. URL gốc đã được ẩn (nocookie),
                          nhưng user có thể click ra YouTube.
                        </div>
                      </Label>
                    </div>
                    <div className="flex items-start gap-2 p-1.5 rounded hover:bg-background/50">
                      <RadioGroupItem value="locked" id="pm-locked" className="mt-0.5" />
                      <Label htmlFor="pm-locked" className="cursor-pointer flex-1">
                        <div className="text-xs font-medium">Locked · Khuyến nghị</div>
                        <div className="text-xs text-muted-foreground">
                          Chặn URL gốc, chặn context menu, không click ra ngoài.
                          Vẫn dùng YouTube nhưng không lộ URL.
                        </div>
                      </Label>
                    </div>
                    <div className="flex items-start gap-2 p-1.5 rounded hover:bg-background/50">
                      <RadioGroupItem value="proxy" id="pm-proxy" className="mt-0.5" />
                      <Label htmlFor="pm-proxy" className="cursor-pointer flex-1">
                        <div className="text-xs font-medium">Proxy · Bảo vệ cao nhất</div>
                        <div className="text-xs text-muted-foreground">
                          Yêu cầu <code>videoUrl</code> (file .mp4). Server tải về
                          rồi stream lại. URL thật không bao giờ tới client.
                          Có thể chèn watermark.
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
                  {form.protectMode === "proxy" && !form.videoUrl.trim() && (
                    <p className="text-xs text-amber-600">
                      ⚠ Chế độ Proxy cần <code>videoUrl</code> trực tiếp (.mp4).
                      Chỉ dùng được khi có file trên CDN của bạn hoặc domain
                      trong allowlist.
                    </p>
                  )}
                </div>

                {ytPreviewSrc && (
                  <div className="space-y-2">
                    <p className="text-xs text-green-600">
                      ✓ Đã nhận diện video:{" "}
                      <a
                        href={buildYouTubeWatchUrl(form.youtubeId.trim())}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        xem trên YouTube
                      </a>
                    </p>
                    <div className="aspect-video rounded-md overflow-hidden bg-black">
                      <iframe
                        src={ytPreviewSrc}
                        title="Preview"
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {form.type === "document" && (
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Tài liệu
                </p>
                <div className="grid gap-2">
                  <Label htmlFor="doc-url" className="text-xs">URL tài liệu</Label>
                  <Input
                    id="doc-url"
                    value={form.documentUrl}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        documentUrl: e.target.value,
                      }))
                    }
                    placeholder="https://..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="doc-type" className="text-xs">Loại file</Label>
                  <select
                    id="doc-type"
                    value={form.documentType}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, documentType: e.target.value }))
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="pdf">PDF</option>
                    <option value="docx">DOCX</option>
                    <option value="pptx">PPTX</option>
                    <option value="txt">TXT</option>
                    <option value="md">Markdown</option>
                  </select>
                </div>
              </div>
            )}

            {form.type === "quiz" && (
              <QuizFormEditor
                quiz={form.quiz}
                onUpdate={updateQuiz}
                onAddQuestion={addQuestion}
                onUpdateQuestion={updateQuestion}
                onRemoveQuestion={removeQuestion}
                onMoveQuestion={moveQuestion}
              />
            )}

            {form.type === "link" && (
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  Liên kết ngoài
                </p>
                <div className="grid gap-2">
                  <Label htmlFor="link-url" className="text-xs">URL</Label>
                  <Input
                    id="link-url"
                    value={form.linkUrl}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, linkUrl: e.target.value }))
                    }
                    placeholder="https://..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="link-label" className="text-xs">Nhãn hiển thị</Label>
                  <Input
                    id="link-label"
                    value={form.linkLabel}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, linkLabel: e.target.value }))
                    }
                    placeholder="Tài liệu tham khảo"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeForm} disabled={isSaving}>
                Hủy
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {editing ? "Cập nhật" : "Tạo"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(previewing)}
        onOpenChange={(o) => !o && setPreviewing(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewing?.title}</DialogTitle>
          </DialogHeader>
          {previewing?.type === "video" && previewing.content.youtubeId && (
            <div className="aspect-video rounded-md overflow-hidden bg-black">
              <iframe
                src={buildYouTubeEmbedUrl(previewing.content.youtubeId)}
                title={previewing.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
          {previewing?.type === "video" && previewing.content.videoUrl && (
            <video
              src={previewing.content.videoUrl}
              controls
              className="w-full rounded-md"
            />
          )}
          {previewing?.type === "link" && (
            <a
              href={previewing.content.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline break-all"
            >
              {previewing.content.linkUrl}
            </a>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

/**
 * QuizFormEditor - Form nhập nhiều câu hỏi inline trong lesson form.
 * Hỗ trợ 3 loại câu hỏi: multiple_choice, true_false, fill_blank.
 */
function QuizFormEditor({
  quiz,
  onUpdate,
  onAddQuestion,
  onUpdateQuestion,
  onRemoveQuestion,
  onMoveQuestion,
}: {
  quiz: QuizDraft;
  onUpdate: (patch: Partial<QuizDraft>) => void;
  onAddQuestion: () => void;
  onUpdateQuestion: (qid: string, patch: Partial<QuestionDraft>) => void;
  onRemoveQuestion: (qid: string) => void;
  onMoveQuestion: (qid: string, dir: -1 | 1) => void;
}) {
  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="text-sm font-medium flex items-center gap-2">
        <Award className="h-4 w-4" />
        Quiz
        <Badge variant="secondary" className="ml-1">
          {quiz.questions.length} câu
        </Badge>
      </p>

      <div className="grid gap-3">
        <div className="grid gap-2">
          <Label htmlFor="quiz-title" className="text-xs">Tiêu đề quiz</Label>
          <Input
            id="quiz-title"
            value={quiz.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Mặc định lấy từ tiêu đề bài học"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="quiz-desc" className="text-xs">Mô tả</Label>
          <Textarea
            id="quiz-desc"
            value={quiz.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="Mô tả ngắn về quiz"
            rows={2}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="quiz-time" className="text-xs">Thời gian (giây, 0 = không giới hạn)</Label>
            <Input
              id="quiz-time"
              type="number"
              min={0}
              value={quiz.timeLimit}
              onChange={(e) =>
                onUpdate({ timeLimit: parseInt(e.target.value || "0", 10) })
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quiz-pass" className="text-xs">Điểm đạt (%)</Label>
            <Input
              id="quiz-pass"
              type="number"
              min={0}
              max={100}
              value={quiz.passingScore}
              onChange={(e) =>
                onUpdate({
                  passingScore: parseInt(e.target.value || "70", 10),
                })
              }
            />
          </div>
        </div>
        {quiz.quizId && (
          <p className="text-xs text-muted-foreground">
            Đang sửa quiz ID: <code>{quiz.quizId}</code>
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold">Danh sách câu hỏi</p>
          <Button size="sm" variant="outline" onClick={onAddQuestion}>
            <Plus className="mr-1 h-3 w-3" />
            Thêm câu hỏi
          </Button>
        </div>
        {quiz.questions.length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            Chưa có câu hỏi nào. Bấm &quot;Thêm câu hỏi&quot; để bắt đầu.
          </p>
        )}
        {quiz.questions.map((q, idx) => (
          <QuestionEditor
            key={q.id}
            question={q}
            index={idx}
            total={quiz.questions.length}
            onUpdate={(patch) => onUpdateQuestion(q.id, patch)}
            onRemove={() => onRemoveQuestion(q.id)}
            onMove={(dir) => onMoveQuestion(q.id, dir)}
          />
        ))}
      </div>
    </div>
  );
}

function QuestionEditor({
  question,
  index,
  total,
  onUpdate,
  onRemove,
  onMove,
}: {
  question: QuestionDraft;
  index: number;
  total: number;
  onUpdate: (patch: Partial<QuestionDraft>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const handleTypeChange = useCallback(
    (newType: QuestionType) => {
      if (newType === question.type) return;
      if (newType === "fill_blank") {
        onUpdate({ type: newType, options: [], correctAnswer: "" });
      } else if (newType === "true_false") {
        onUpdate({
          type: newType,
          options: [
            { id: `o-${Math.random().toString(36).slice(2, 6)}`, text: "Đúng", isCorrect: true },
            { id: `o-${Math.random().toString(36).slice(2, 6)}`, text: "Sai", isCorrect: false },
          ],
          correctAnswer: "",
        });
      } else {
        // multiple_choice: reset về 2 options trống
        onUpdate({
          type: newType,
          options: [
            { id: `o-${Math.random().toString(36).slice(2, 6)}`, text: "", isCorrect: true },
            { id: `o-${Math.random().toString(36).slice(2, 6)}`, text: "", isCorrect: false },
          ],
          correctAnswer: "",
        });
      }
    },
    [question.type, onUpdate]
  );

  const addOption = useCallback(() => {
    onUpdate({
      options: [
        ...question.options,
        { id: `o-${Math.random().toString(36).slice(2, 6)}`, text: "", isCorrect: false },
      ],
    });
  }, [question.options, onUpdate]);

  const updateOption = useCallback(
    (oid: string, patch: Partial<QuestionOption>) => {
      onUpdate({
        options: question.options.map((o) =>
          o.id === oid ? { ...o, ...patch } : o
        ),
      });
    },
    [question.options, onUpdate]
  );

  const removeOption = useCallback(
    (oid: string) => {
      onUpdate({
        options: question.options.filter((o) => o.id !== oid),
      });
    },
    [question.options, onUpdate]
  );

  const toggleCorrect = useCallback(
    (oid: string) => {
      onUpdate({
        options: question.options.map((o) =>
          o.id === oid ? { ...o, isCorrect: !o.isCorrect } : o
        ),
      });
    },
    [question.options, onUpdate]
  );

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="shrink-0">
          #{index + 1}
        </Badge>
        <select
          value={question.type}
          onChange={(e) => handleTypeChange(e.target.value as QuestionType)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="multiple_choice">Trắc nghiệm</option>
          <option value="true_false">Đúng / Sai</option>
          <option value="fill_blank">Điền vào chỗ trống</option>
        </select>
        <div className="flex items-center gap-1 ml-auto">
          <Input
            type="number"
            min={1}
            value={question.points}
            onChange={(e) =>
              onUpdate({ points: parseInt(e.target.value || "1", 10) })
            }
            className="h-7 w-14 text-xs"
            title="Điểm"
          />
          <span className="text-xs text-muted-foreground">điểm</span>
        </div>
        <div className="flex gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            title="Lên"
          >
            ▲
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            title="Xuống"
          >
            ▼
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive"
            onClick={onRemove}
            title="Xóa câu hỏi"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <Input
        value={question.text}
        onChange={(e) => onUpdate({ text: e.target.value })}
        placeholder="Nội dung câu hỏi..."
        className="text-sm"
      />

      {question.type === "multiple_choice" && (
        <div className="space-y-1.5 pl-2">
          <p className="text-xs text-muted-foreground">
            Chọn đáp án đúng bằng cách click vào checkbox
          </p>
          {question.options.map((opt, oi) => (
            <div key={opt.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleCorrect(opt.id)}
                className="shrink-0 text-primary hover:scale-110 transition"
                title={opt.isCorrect ? "Đáp án đúng" : "Đặt làm đáp án đúng"}
              >
                {opt.isCorrect ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              <Input
                value={opt.text}
                onChange={(e) => updateOption(opt.id, { text: e.target.value })}
                placeholder={`Lựa chọn ${oi + 1}`}
                className="h-8 text-sm"
              />
              {question.options.length > 2 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => removeOption(opt.id)}
                  title="Xóa lựa chọn"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={addOption}
          >
            <Plus className="mr-1 h-3 w-3" />
            Thêm lựa chọn
          </Button>
        </div>
      )}

      {question.type === "true_false" && (
        <div className="space-y-1.5 pl-2">
          <p className="text-xs text-muted-foreground">Chọn đáp án đúng</p>
          {question.options.map((opt) => (
            <label
              key={opt.id}
              className={`flex items-center gap-2 rounded border p-2 cursor-pointer ${
                opt.isCorrect
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/50"
              }`}
            >
              <input
                type="radio"
                name={`correct-tf-${question.id}`}
                checked={opt.isCorrect}
                onChange={() =>
                  onUpdate({
                    options: question.options.map((o) => ({
                      ...o,
                      isCorrect: o.id === opt.id,
                    })),
                  })
                }
                className="h-3 w-3"
              />
              <span className="text-sm">{opt.text}</span>
            </label>
          ))}
        </div>
      )}

      {question.type === "fill_blank" && (
        <div className="space-y-1.5 pl-2">
          <p className="text-xs text-muted-foreground">
            Đáp án (so sánh không phân biệt hoa/thường, bỏ qua khoảng trắng đầu/cuối)
          </p>
          <Input
            value={question.correctAnswer}
            onChange={(e) => onUpdate({ correctAnswer: e.target.value })}
            placeholder="Nhập đáp án đúng..."
            className="h-8 text-sm"
          />
        </div>
      )}
    </div>
  );
}
