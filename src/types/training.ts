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
  // Các role được phép xem program này (nếu không có thì ai cũng xem được sau khi publish)
  allowedRoles?: string[];
  // Nhóm chương trình
  groupId?: string | null;
}

export interface ProgramWithGroup extends Program {
  groupName?: string | null;
}

// ─── ProgramGroup ────────────────────────────────────────────
export interface ProgramGroup {
  id: string;
  name: string;
  order: number;
  createdAt: Date;
  updatedAt?: Date;
}

// ─── Lesson (Bài học) ───────────────────────────────────────
export type LessonContentType = "text" | "video" | "pdf";

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
  // Các role được phép xem lesson này (nếu không có thì kế thừa từ program)
  allowedRoles?: string[];
  createdAt: Date;
  updatedAt?: Date;
}

// ─── Test (Bài kiểm tra) ─────────────────────────────────────
// Lưu trong subcollection: programs/{programId}/lessons/{lessonId}/test/{testId}
// Theo spec: mỗi lesson chỉ có một test, nên testId có thể là "default" hoặc 1 id bất kỳ.

export type QuestionType = "multiple_choice" | "essay";

// Câu hỏi trắc nghiệm
export interface MultipleChoiceQuestion {
  type: "multiple_choice";
  question: string;
  options: string[];
  correctIndex: number;
  point: number;
}

// Câu hỏi tự luận
export interface EssayQuestion {
  type: "essay";
  question: string;
  sampleAnswer: string;
  point: number;
}

export type TestQuestion = MultipleChoiceQuestion | EssayQuestion;

// Phiên bản public trả về cho client (ẩn correctIndex và sampleAnswer)
export interface PublicMultipleChoiceQuestion {
  type: "multiple_choice";
  question: string;
  options: string[];
  point: number;
}

export interface PublicEssayQuestion {
  type: "essay";
  question: string;
  point: number;
}

export type PublicTestQuestion = PublicMultipleChoiceQuestion | PublicEssayQuestion;

export interface LessonTest {
  id: string;
  programId: string;
  lessonId: string;
  questions: TestQuestion[];
  passScore: number; // % điểm để "đạt"
  createdAt: Date;
  updatedAt?: Date;
}

// Phiên bản public trả về cho client (ẩn correctIndex và sampleAnswer)
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
  hasEssayPendingReview: boolean; // true nếu có câu tự luận cần admin check
}

// Kết quả chấm điểm từng câu hỏi (trả về cho admin/user sau khi submit)
export interface QuestionGradingResult {
  questionIndex: number;
  question: string;
  type: QuestionType;
  point: number;
  earnedPoint: number;
  isCorrect: boolean;
  // Cho multiple choice
  userAnswerIndex?: number;
  correctIndex?: number;
  // Cho essay
  userAnswerText?: string;
  sampleAnswer?: string; // chỉ trả về cho admin
  isPendingReview?: boolean; // true nếu cần admin check
}

export interface TestSubmitDetailResult extends TestSubmitResult {
  questionResults: QuestionGradingResult[];
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
  hasPendingReview?: boolean; // true khi có essay chờ manager/admin chấm
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

/**
 * Tổng quan tiến độ của một nhân viên trong team (dùng cho trang Team của manager).
 */
export interface TeamMemberProgress {
  userId: string;
  displayName?: string;
  email: string;
  department?: string;
  totalAssigned: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  overallPercent: number; // % hoàn thành trung bình các chương trình
  averageTestScore: number; // % điểm test trung bình các chương trình
  lastActivityAt?: Date | null;
}

export interface TeamReportSummary {
  managerId: string;
  totalEmployees: number;
  totalAssigned: number; // tổng số chương trình đã gán cho cả team
  completed: number;
  inProgress: number;
  notStarted: number;
  completionRate: number; // % chương trình hoàn thành / tổng
  averageTestScore: number; // điểm test trung bình cả team
  members: TeamMemberProgress[];
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

// ─── Upload (S3) ─────────────────────────────────────────────
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

// ─── Ticket (Báo cáo lỗi/Hỗ trợ) ─────────────────────────────
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketCategory =
  | "bug"
  | "video_issue"
  | "quiz_issue"
  | "login_issue"
  | "content_error"
  | "suggestion"
  | "other";

export interface Ticket {
  id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  screenshotUrl?: string;
  createdAt: Date;
  updatedAt?: Date;
  resolvedAt?: Date;
  adminNote?: string;
}

export interface CreateTicketRequest {
  title: string;
  description: string;
  category: TicketCategory;
  priority?: TicketPriority;
  screenshotUrl?: string;
}

export interface TicketListResponse {
  items: Ticket[];
  total: number;
  page: number;
  pageSize: number;
}
