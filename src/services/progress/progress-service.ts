import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Progress, CourseProgress, ProgressStatus } from "@/types";

const PROGRESS_COLLECTION = "progress";

export async function getUserProgress(
  userId: string,
  courseId?: string
): Promise<Progress[]> {
  const constraints = [where("userId", "==", userId)];

  if (courseId) {
    constraints.push(where("courseId", "==", courseId));
  }

  const q = query(
    collection(db, PROGRESS_COLLECTION),
    ...constraints,
    orderBy("updatedAt", "desc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<Progress, "id">),
  }));
}

export async function getProgressById(id: string): Promise<Progress | null> {
  const docRef = doc(db, PROGRESS_COLLECTION, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return {
    id: docSnap.id,
    ...(docSnap.data() as Omit<Progress, "id">),
  };
}

export async function getLessonProgress(
  userId: string,
  courseId: string,
  lessonId: string
): Promise<Progress | null> {
  const q = query(
    collection(db, PROGRESS_COLLECTION),
    where("userId", "==", userId),
    where("courseId", "==", courseId),
    where("lessonId", "==", lessonId)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...(doc.data() as Omit<Progress, "id">),
  };
}

export async function createOrUpdateProgress(
  userId: string,
  courseId: string,
  lessonId: string,
  data: Partial<Progress>
): Promise<string> {
  const existingProgress = await getLessonProgress(userId, courseId, lessonId);

  if (existingProgress) {
    const docRef = doc(db, PROGRESS_COLLECTION, existingProgress.id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
    return existingProgress.id;
  }

  const docRef = await addDoc(collection(db, PROGRESS_COLLECTION), {
    userId,
    courseId,
    lessonId,
    status: "in_progress",
    quizAttempts: 0,
    lastAccessedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...data,
  });

  return docRef.id;
}

export async function updateVideoProgress(
  userId: string,
  courseId: string,
  lessonId: string,
  videoProgress: number,
  videoWatchedSeconds: number
): Promise<void> {
  const progressId = await createOrUpdateProgress(userId, courseId, lessonId, {
    videoProgress,
    videoWatchedSeconds,
  });

  const docRef = doc(db, PROGRESS_COLLECTION, progressId);

  if (videoProgress >= 90) {
    await updateDoc(docRef, { status: "completed" });
  }
}

export async function updateDocumentProgress(
  userId: string,
  courseId: string,
  lessonId: string,
  documentProgress: number,
  documentScrollPercentage: number
): Promise<void> {
  const progressId = await createOrUpdateProgress(userId, courseId, lessonId, {
    documentProgress,
    documentScrollPercentage,
  });

  const docRef = doc(db, PROGRESS_COLLECTION, progressId);

  if (documentProgress >= 90) {
    await updateDoc(docRef, { status: "completed" });
  }
}

export async function updateQuizProgress(
  userId: string,
  courseId: string,
  lessonId: string,
  quizScore: number
): Promise<void> {
  const progressId = await createOrUpdateProgress(userId, courseId, lessonId, {
    quizScore,
  });

  const docRef = doc(db, PROGRESS_COLLECTION, progressId);
  const progressDoc = await getDoc(docRef);

  if (progressDoc.exists()) {
    const data = progressDoc.data();
    const newAttempts = (data.quizAttempts || 0) + 1;
    await updateDoc(docRef, { quizAttempts: newAttempts });
  }
}

export async function calculateCourseProgress(
  userId: string,
  courseId: string,
  totalLessons: number
): Promise<CourseProgress> {
  const progressList = await getUserProgress(userId, courseId);

  const completedLessons = progressList.filter(
    (p) => p.status === "completed"
  ).length;

  const percentage =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const videoProgresses = progressList
    .filter((p) => p.videoProgress !== undefined)
    .map((p) => p.videoProgress || 0);

  const videoAvg =
    videoProgresses.length > 0
      ? videoProgresses.reduce((a, b) => a + b, 0) / videoProgresses.length
      : 0;

  const quizScores = progressList
    .filter((p) => p.quizScore !== undefined)
    .map((p) => p.quizScore || 0);

  const quizAvg =
    quizScores.length > 0
      ? quizScores.reduce((a, b) => a + b, 0) / quizScores.length
      : 0;

  return {
    courseId,
    userId,
    completedLessons,
    totalLessons,
    percentage,
    videoProgress: videoAvg,
    documentProgress: 0,
    quizAverage: quizAvg,
    totalTimeSpent: 0,
    streak: 0,
    lastAccessedAt: new Date(),
  };
}

export async function markLessonComplete(
  userId: string,
  courseId: string,
  lessonId: string
): Promise<void> {
  await createOrUpdateProgress(userId, courseId, lessonId, {
    status: "completed",
    completedAt: new Date(),
  });
}

export async function getCourseCompletionStatus(
  userId: string,
  courseId: string,
  passingScore: number
): Promise<{ isComplete: boolean; canGetCertificate: boolean }> {
  const progressList = await getUserProgress(userId, courseId);

  const completedCount = progressList.filter(
    (p) => p.status === "completed"
  ).length;

  const quizScores = progressList
    .filter((p) => p.quizScore !== undefined)
    .map((p) => p.quizScore || 0);

  const avgScore =
    quizScores.length > 0
      ? quizScores.reduce((a, b) => a + b, 0) / quizScores.length
      : 0;

  return {
    isComplete: completedCount > 0,
    canGetCertificate: avgScore >= passingScore,
  };
}
