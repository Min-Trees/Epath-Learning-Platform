// ─── Program (Chương trình training) ─────────────────────────
export type ProgramStatus = "draft" | "published";

export interface Program {
  id: string;
  title: string;
  description: string;
  status: ProgramStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
  publishedAt?: Date;
}

// ─── Lesson (Bài học) ────────────────────────────────────────
export type LessonContentType = "text" | "video" | "pdf" | "ppt";

export interface LessonFileMeta {
  fileName: string;
  size: number;
  mimeType: string;
  duration?: number;
}

export interface Lesson {
  id: string;
  programId: string;
  title: string;
  order: number;
  contentType: LessonContentType;
  textContent?: string;
  fileKey?: string;
  fileMeta?: LessonFileMeta;
  hasTest: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

// ─── Test (Bài kiểm tra) ─────────────────────────────────────
// Lưu trong subcollection: programs/{programId}/lessons/{lessonId}/test/{testId}
// Theo spec: mỗi lesson chỉ có một test, nên testId có thể là "default" hoặc 1 id bất kỳ.
export interface TestQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  point: number;
}

export interface LessonTest {
  id: string;
  programId: string;
  lessonId: string;
  questions: TestQuestion[];
  passScore: number; // % điểm để "đạt"
  createdAt: Date;
  updatedAt?: Date;
}

// Phiên bản public trả về cho client (ẩn correctIndex)
export interface PublicTestQuestion {
  question: string;
  options: string[];
  point: number;
}

export interface PublicTest {
  id: string;
  programId: string;
  lessonId: string;
  questions: PublicTestQuestion[];
  passScore: number;
}

export interface TestSubmitResult {
  score: number; // % 0..100
  totalPoint: number;
  earnedPoint: number;
  passed: boolean;
  attemptCount: number;
}

// ─── Assignment (Gán chương trình cho Employee) ──────────────
// Document id format: `${userId}_${programId}`
export type AssignmentStatus = "not_started" | "in_progress" | "completed";

export interface Assignment {
  id: string;
  userId: string;
  programId: string;
  assignedAt: Date;
  assignedBy: string;
  status: AssignmentStatus;
  startedAt?: Date;
  completedAt?: Date;
}

// ─── Progress (Tiến độ từng lesson) ──────────────────────────
// Path: progress/{userId}_{programId}/lessons/{lessonId}
export type LessonStatus = "not_started" | "in_progress" | "completed";

export interface TestResult {
  score: number; // % lần gần nhất
  passed: boolean;
  attemptCount: number;
  lastAttemptAt: Date;
}

export interface ProgramProgress {
  id: string;
  userId: string;
  programId: string;
  status: AssignmentStatus;
  startedAt?: Date;
  completedAt?: Date;
  totalLessons: number;
  completedLessons: number;
  percent: number;
  updatedAt?: Date;
}

export interface LessonProgress {
  id: string;
  userId: string;
  programId: string;
  lessonId: string;
  lessonStatus: LessonStatus;
  testResult?: TestResult;
  updatedAt?: Date;
}

// ─── Reports ─────────────────────────────────────────────────
export interface ProgramReportSummary {
  programId: string;
  programTitle: string;
  totalAssigned: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  completionRate: number; // %
  averageTestScore: number; // %
  atRiskUsers: { userId: string; displayName?: string; email: string; status: AssignmentStatus; percent: number }[];
}

export interface UserReportSummary {
  userId: string;
  displayName?: string;
  email: string;
  totalAssigned: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  averageTestScore: number;
  programs: {
    programId: string;
    programTitle: string;
    status: AssignmentStatus;
    percent: number;
    averageTestScore: number;
    lessons: {
      lessonId: string;
      title: string;
      order: number;
      lessonStatus: LessonStatus;
      testPassed?: boolean;
      testScore?: number;
      attemptCount?: number;
    }[];
  }[];
}

// ─── Upload (R2) ─────────────────────────────────────────────
export interface PresignUploadRequest {
  fileName: string;
  mimeType: string;
  programId: string;
  lessonId: string;
  size?: number;
}

export interface PresignUploadResponse {
  uploadUrl: string;
  fileKey: string;
  expiresIn: number; // giây
  publicUrl?: string; // optional, nếu bucket public
}

export interface PresignDownloadResponse {
  url: string;
  expiresIn: number;
  fileKey: string;
  mimeType?: string;
}
