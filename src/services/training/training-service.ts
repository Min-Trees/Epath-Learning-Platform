import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";
import type {
  Program,
  Lesson,
  LessonTest,
  PublicTest,
  TestQuestion,
  TestSubmitResult,
  Assignment,
  ProgramProgress,
  LessonProgress,
  PresignUploadRequest,
  PresignUploadResponse,
  PresignDownloadResponse,
  ProgramReportSummary,
  UserReportSummary,
} from "@/types/training";

// ─── Programs ────────────────────────────────────────────────
export const programService = {
  list: () => apiGet<{ items: Program[] }>("/api/programs"),
  get: (id: string) =>
    apiGet<{ program: Program; lessons: Lesson[] }>(`/api/programs/${id}`),
  create: (data: { title: string; description?: string }) =>
    apiPost<{ programId: string }>("/api/programs", data),
  update: (id: string, data: { title?: string; description?: string }) =>
    apiPut(`/api/programs/${id}`, data),
  remove: (id: string) => apiDelete(`/api/programs/${id}`),
  publish: (id: string) => apiPost(`/api/programs/${id}/publish`, {}),
  unpublish: (id: string) => apiDelete(`/api/programs/${id}/publish`),
};

// ─── Lessons ─────────────────────────────────────────────────
export const lessonService = {
  list: (programId: string) =>
    apiGet<{ lessons: Lesson[] }>(`/api/programs/${programId}/lessons`),
  get: (programId: string, lessonId: string) =>
    apiGet<Lesson>(`/api/programs/${programId}/lessons/${lessonId}`),
  create: (
    programId: string,
    data: {
      title: string;
      order?: number;
      contentType: "text" | "video" | "pdf" | "ppt";
      textContent?: string;
    }
  ) => apiPost<{ lessonId: string }>(`/api/programs/${programId}/lessons`, data),
  update: (
    programId: string,
    lessonId: string,
    data: Partial<{
      title: string;
      order: number;
      contentType: "text" | "video" | "pdf" | "ppt";
      textContent: string | null;
      fileKey: string | null;
      fileMeta: {
        fileName: string;
        size: number;
        mimeType: string;
        duration?: number;
      } | null;
    }>
  ) => apiPut(`/api/programs/${programId}/lessons/${lessonId}`, data),
  remove: (programId: string, lessonId: string) =>
    apiDelete(`/api/programs/${programId}/lessons/${lessonId}`),
  confirmUpload: (
    programId: string,
    lessonId: string,
    body: {
      fileKey: string;
      fileMeta: { fileName: string; size: number; mimeType: string; duration?: number };
    }
  ) =>
    apiPost(
      `/api/programs/${programId}/lessons/${lessonId}/confirm-upload`,
      body
    ),
};

// ─── Tests ───────────────────────────────────────────────────
export interface AdminLessonTest {
  id: string;
  questions: TestQuestion[];
  passScore: number;
}

export const testService = {
  get: (programId: string, lessonId: string) =>
    apiGet<PublicTest>(
      `/api/programs/${programId}/lessons/${lessonId}/test`
    ),
  /** Chỉ admin mới gọi được - server trả về kèm correctIndex */
  getAdmin: (programId: string, lessonId: string) =>
    apiGet<AdminLessonTest>(
      `/api/programs/${programId}/lessons/${lessonId}/test`
    ),
  upsert: (
    programId: string,
    lessonId: string,
    body: { questions: TestQuestion[]; passScore: number }
  ) =>
    apiPost(
      `/api/programs/${programId}/lessons/${lessonId}/test`,
      body
    ),
  submit: (
    programId: string,
    lessonId: string,
    answers: number[]
  ) =>
    apiPost<TestSubmitResult>(
      `/api/programs/${programId}/lessons/${lessonId}/test/submit`,
      { answers }
    ),
};

// ─── Uploads (R2 presign) ────────────────────────────────────
export const uploadService = {
  presign: (body: PresignUploadRequest) =>
    apiPost<PresignUploadResponse>("/api/uploads/presign", body),
  /**
   * Upload file trực tiếp tới uploadUrl (PUT). Đối với R2 thật, đây là S3 PUT.
   * Đối với local fallback, route sẽ yêu cầu Bearer token => caller cần truyền
   * token vào header Authorization (xem uploadFileToUrl).
   */
  uploadFileToUrl: async (
    uploadUrl: string,
    file: File,
    headers: Record<string, string> = {}
  ): Promise<Response> => {
    return fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers,
    });
  },
};

// ─── Lesson access (cho employee) ────────────────────────────
export const accessService = {
  getLessonUrl: (lessonId: string) =>
    apiGet<PresignDownloadResponse>(`/api/lessons/${lessonId}/access-url`),
};

// ─── Assignments ─────────────────────────────────────────────
export const assignmentService = {
  list: (params: { userId?: string; programId?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.userId) q.set("userId", params.userId);
    if (params.programId) q.set("programId", params.programId);
    const qs = q.toString();
    return apiGet<{ items: Assignment[] }>(
      `/api/assignments${qs ? "?" + qs : ""}`
    );
  },
  create: (data: { userIds: string[]; programId: string }) =>
    apiPost<{ created: string[]; skipped: string[] }>(
      "/api/assignments",
      data
    ),
  unassign: (userId: string, programId: string) =>
    apiDelete(
      `/api/assignments/unassign?userId=${encodeURIComponent(
        userId
      )}&programId=${encodeURIComponent(programId)}`
    ),
};

// ─── My programs (employee) ──────────────────────────────────
export const myProgramsService = {
  list: () =>
    apiGet<{
      items: Array<{
        assignmentId: string;
        userId: string;
        programId: string;
        status: string;
        assignedAt: Date | null;
        program: { id: string; title: string; description: string; status: string } | null;
        progress?: { totalLessons: number; completedLessons: number; percent: number };
      }>;
    }>("/api/me/programs"),
};

// ─── Progress ────────────────────────────────────────────────
export const progressService = {
  get: (programId: string, userId?: string) => {
    const q = new URLSearchParams({ programId });
    if (userId) q.set("userId", userId);
    return apiGet<{
      progress: ProgramProgress | null;
      lessons: LessonProgress[];
    }>(`/api/progress?${q.toString()}`);
  },
  update: (
    programId: string,
    lessonId: string,
    lessonStatus: "in_progress" | "completed"
  ) =>
    apiPost("/api/progress", { programId, lessonId, lessonStatus }),
};

// ─── Reports ─────────────────────────────────────────────────
export const reportService = {
  programProgress: (programId: string) =>
    apiGet<ProgramReportSummary>(
      `/api/reports/programs/${programId}/progress`
    ),
  userProgress: (userId: string) =>
    apiGet<UserReportSummary>(`/api/reports/users/${userId}/progress`),
};
