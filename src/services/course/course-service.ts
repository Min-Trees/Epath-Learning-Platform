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
  DocumentData,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  Course,
  CourseFilters,
  PaginationParams,
  PaginatedResponse,
} from "@/types";

const COURSES_COLLECTION = "courses";

interface GetCoursesOptions {
  filters?: CourseFilters;
  pagination?: PaginationParams;
  includeInstructor?: boolean;
}

export async function getCourses(
  options: GetCoursesOptions = {}
): Promise<PaginatedResponse<Course>> {
  const { filters = {}, pagination = {}, includeInstructor = true } = options;

  const constraints: QueryConstraint[] = [];

  if (filters.category) {
    constraints.push(where("category", "==", filters.category));
  }
  if (filters.level) {
    constraints.push(where("level", "==", filters.level));
  }
  if (filters.status) {
    constraints.push(where("status", "==", filters.status));
  }
  if (filters.instructorId) {
    constraints.push(where("instructorId", "==", filters.instructorId));
  }

  if (filters.search) {
    constraints.push(where("title", ">=", filters.search));
    constraints.push(where("title", "<=", filters.search + "\uf8ff"));
  }

  constraints.push(orderBy("createdAt", "desc"));

  const page = pagination.page || 1;
  const pageSize = pagination.pageSize || 10;
  constraints.push(limit(pageSize * page));

  const q = query(collection(db, COURSES_COLLECTION), ...constraints);
  const snapshot = await getDocs(q);

  const items: Course[] = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<Course, "id">),
  }));

  let result = items;
  if (items.length > pageSize) {
    result = items.slice(items.length - pageSize);
  }

  return {
    items: result,
    total: snapshot.size,
    page,
    pageSize,
    totalPages: Math.ceil(snapshot.size / pageSize),
  };
}

export async function getCourseById(
  id: string,
  includeInstructor = true
): Promise<Course | null> {
  const docRef = doc(db, COURSES_COLLECTION, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  const course = {
    id: docSnap.id,
    ...(docSnap.data() as Omit<Course, "id">),
  };

  return course;
}

export async function getPublishedCourses(
  pagination?: PaginationParams
): Promise<PaginatedResponse<Course>> {
  return getCourses({
    filters: { status: "published" },
    pagination,
  });
}

export async function getCoursesByInstructor(
  instructorId: string
): Promise<Course[]> {
  const q = query(
    collection(db, COURSES_COLLECTION),
    where("instructorId", "==", instructorId),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<Course, "id">),
  }));
}

export async function getCoursesByCategory(
  category: string
): Promise<Course[]> {
  const q = query(
    collection(db, COURSES_COLLECTION),
    where("category", "==", category),
    where("status", "==", "published"),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<Course, "id">),
  }));
}

export async function createCourse(
  data: Omit<Course, "id" | "createdAt" | "updatedAt" | "enrolledCount" | "completedCount" | "averageRating" | "totalRatings">
): Promise<string> {
  const docRef = await addDoc(collection(db, COURSES_COLLECTION), {
    ...data,
    enrolledCount: 0,
    completedCount: 0,
    averageRating: 0,
    totalRatings: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function updateCourse(
  id: string,
  data: Partial<Course>
): Promise<void> {
  const docRef = doc(db, COURSES_COLLECTION, id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCourse(id: string): Promise<void> {
  const docRef = doc(db, COURSES_COLLECTION, id);
  await deleteDoc(docRef);
}

export async function publishCourse(id: string): Promise<void> {
  await updateCourse(id, {
    status: "published",
    publishedAt: new Date(),
  });
}

export async function unpublishCourse(id: string): Promise<void> {
  await updateCourse(id, {
    status: "draft",
  });
}

export async function enrollInCourse(
  courseId: string,
  userId: string
): Promise<void> {
  const courseRef = doc(db, COURSES_COLLECTION, courseId);
  const courseSnap = await getDoc(courseRef);

  if (!courseSnap.exists()) {
    throw new Error("Course not found");
  }

  const course = courseSnap.data() as Course;
  const enrolledCount = (course.enrolledCount || 0) + 1;

  await updateDoc(courseRef, {
    enrolledCount,
    updatedAt: serverTimestamp(),
  });
}

export async function getFeaturedCourses(limitCount = 6): Promise<Course[]> {
  const q = query(
    collection(db, COURSES_COLLECTION),
    where("status", "==", "published"),
    orderBy("enrolledCount", "desc"),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<Course, "id">),
  }));
}

export async function getRecentCourses(limitCount = 6): Promise<Course[]> {
  const q = query(
    collection(db, COURSES_COLLECTION),
    where("status", "==", "published"),
    orderBy("publishedAt", "desc"),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<Course, "id">),
  }));
}
