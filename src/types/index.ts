// User Types
export type UserRole = "admin" | "hr" | "trainer" | "employee";

export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  department?: string;
  position?: string;
  phone?: string;
  enrolledCourses: string[];
  completedCourses: string[];
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  isActive: boolean;
}

// Course Types
export type CourseStatus = "draft" | "published" | "archived";
export type CourseLevel = "beginner" | "intermediate" | "advanced";
export type CourseCategory =
  | "it"
  | "hr"
  | "sales"
  | "marketing"
  | "management"
  | "compliance"
  | "safety"
  | "other";

export interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail?: string;
  banner?: string;
  category: CourseCategory;
  level: CourseLevel;
  tags: string[];
  instructorId: string;
  instructor?: User;
  status: CourseStatus;
  lessons: Lesson[];
  enrolledCount: number;
  completedCount: number;
  averageRating: number;
  requireFullWatch?: boolean;
  totalRatings: number;
  duration: number;
  passingScore: number;
  certificateTemplate?: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  deadline?: Date;
  enrollmentType: "open" | "approval" | "required";
}

// Lesson Types
export type LessonType = "video" | "document" | "quiz" | "link";

export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  order: number;
  type: LessonType;
  content: LessonContent;
  duration?: number;
  isPreview: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LessonContent {
  videoUrl?: string;
  videoDuration?: number;
  youtubeId?: string;
  documentUrl?: string;
  documentType?: DocumentType;
  quizId?: string;
  linkUrl?: string;
  linkLabel?: string;
}

// Document Types
export type DocumentType = "pdf" | "docx" | "pptx" | "txt" | "md";

export interface Document {
  id: string;
  lessonId: string;
  courseId: string;
  title: string;
  type: DocumentType;
  storagePath: string;
  url: string;
  size: number;
  pageCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Quiz Types
export type QuestionType = "multiple_choice" | "true_false" | "fill_blank";
export type QuestionOption = {
  id: string;
  text: string;
  isCorrect: boolean;
};

export interface Question {
  id: string;
  quizId: string;
  text: string;
  type: QuestionType;
  options?: QuestionOption[];
  correctAnswer?: string;
  explanation?: string;
  points: number;
  order: number;
}

export interface Quiz {
  id: string;
  lessonId: string;
  courseId: string;
  title: string;
  description?: string;
  questions: Question[];
  timeLimit?: number;
  passingScore: number;
  maxAttempts: number;
  randomize: boolean;
  showResults: boolean;
  showCorrectAnswers: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  courseId: string;
  lessonId: string;
  answers: QuizAnswer[];
  score: number;
  totalPoints: number;
  passed: boolean;
  startedAt: Date;
  completedAt?: Date;
  timeSpent: number;
}

export interface QuizAnswer {
  questionId: string;
  answer: string | string[];
  isCorrect: boolean;
  points: number;
}

// Progress Types
export type ProgressStatus = "not_started" | "in_progress" | "completed";

export interface Progress {
  id: string;
  userId: string;
  courseId: string;
  lessonId?: string;
  status: ProgressStatus;
  videoProgress?: number;
  videoWatchedSeconds?: number;
  documentProgress?: number;
  documentScrollPercentage?: number;
  quizScore?: number;
  quizAttempts: number;
  completedAt?: Date;
  lastAccessedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CourseProgress {
  courseId: string;
  userId: string;
  completedLessons: number;
  totalLessons: number;
  percentage: number;
  videoProgress: number;
  documentProgress: number;
  quizAverage: number;
  totalTimeSpent: number;
  streak: number;
  lastAccessedAt: Date;
}

// Certificate Types
export interface Certificate {
  id: string;
  userId: string;
  courseId: string;
  courseName: string;
  userName: string;
  userEmail: string;
  issuedAt: Date;
  validUntil?: Date;
  certificateUrl?: string;
  verificationCode: string;
  score: number;
  isVerified: boolean;
}

// Notification Types
export type NotificationType =
  | "course_new"
  | "course_enrolled"
  | "course_completed"
  | "deadline_reminder"
  | "quiz_available"
  | "quiz_result"
  | "certificate_earned"
  | "announcement"
  | "system";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: Date;
}

// AI Knowledge Types (for RAG-ready architecture)
export interface AIKnowledge {
  id: string;
  title: string;
  content: string;
  source: string;
  category: string;
  courseId?: string;
  tags: string[];
  embeddings?: number[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Filter & Search Types
export interface CourseFilters {
  category?: CourseCategory;
  level?: CourseLevel;
  status?: CourseStatus;
  instructorId?: string;
  search?: string;
  tags?: string[];
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// Form Types
export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  displayName: string;
  role?: UserRole;
}

export interface ForgotPasswordFormData {
  email: string;
}

export interface ResetPasswordFormData {
  password: string;
  confirmPassword: string;
  oobCode?: string;
}

export interface CourseFormData {
  title: string;
  description: string;
  category: CourseCategory;
  level: CourseLevel;
  tags: string[];
  passingScore: number;
  enrollmentType: "open" | "approval" | "required";
  deadline?: Date;
  thumbnail?: File;
  banner?: File;
}

export interface LessonFormData {
  title: string;
  description?: string;
  type: LessonType;
  order: number;
  isPreview: boolean;
  videoUrl?: string;
  documentUrl?: string;
  documentType?: DocumentType;
  quizId?: string;
  linkUrl?: string;
  linkLabel?: string;
}

export interface QuizFormData {
  title: string;
  description?: string;
  timeLimit?: number;
  passingScore: number;
  maxAttempts: number;
  randomize: boolean;
  showResults: boolean;
  showCorrectAnswers: boolean;
  questions: Omit<Question, "id" | "quizId">[];
}

// Dashboard Stats Types
export interface DashboardStats {
  totalCourses: number;
  completedCourses: number;
  inProgressCourses: number;
  averageScore: number;
  totalLearningHours: number;
  certificatesEarned: number;
  currentStreak: number;
  longestStreak: number;
}

export interface AdminStats {
  totalUsers: number;
  totalCourses: number;
  totalEnrollments: number;
  totalCompletions: number;
  averageCompletionRate: number;
  activeUsersThisMonth: number;
  newUsersThisMonth: number;
  courseRatings: { courseId: string; averageRating: number }[];
}

// Storage Types
export interface UploadedFile {
  name: string;
  url: string;
  size: number;
  type: string;
  path: string;
}

// Theme Types
export type Theme = "light" | "dark" | "system";

// Auth State Types
export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// Toast Types
export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "success" | "error" | "warning";
  duration?: number;
}
