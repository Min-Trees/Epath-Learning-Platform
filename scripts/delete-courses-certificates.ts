/**
 * Script: Xóa tất cả khóa học, bài học, tài liệu, quiz, certificate trên Firestore
 *
 * Chạy: npm run cleanup
 *
 * ⚠️ CẢNH BÁO: Script này XÓA CỨNG (hard delete) dữ liệu. Không thể khôi phục.
 *
 * Script giữ lại:
 *   - Collection: users
 *   - Collection: notifications
 *   - Collection: ai_knowledge
 *
 * Script xóa:
 *   - Collection: courses (và subcollections: lessons, documents, quizzes)
 *   - Collection: certificates
 *   - Collection: progress
 *   - Collection: quizAttempts
 *   - Cập nhật user.enrolledCourses = [] và user.completedCourses = []
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env.local"));
loadEnvFile(path.resolve(process.cwd(), ".env"));

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v === "your_private_key_here" || v.includes("your_")) {
    throw new Error(
      `Thiếu hoặc chưa cấu hình ${name} trong .env.local.\n` +
        `Hãy lấy service account từ Firebase Console:\n` +
        `  Project Settings → Service Accounts → Generate new private key\n` +
        `Sau đó paste giá trị vào FIREBASE_ADMIN_PRIVATE_KEY trong .env.local`
    );
  }
  return v;
}

const PROJECT_ID = requireEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
const CLIENT_EMAIL = requireEnv("FIREBASE_ADMIN_CLIENT_EMAIL");
const PRIVATE_KEY = requireEnv("FIREBASE_ADMIN_PRIVATE_KEY").replace(
  /\\n/g,
  "\n"
);

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: PROJECT_ID,
      clientEmail: CLIENT_EMAIL,
      privateKey: PRIVATE_KEY,
    }),
  });
}

const db = getFirestore();

const COLLECTIONS_TO_DELETE = [
  "certificates",
  "progress",
  "quizAttempts",
];

const SUBCOLLECTIONS_OF_COURSES = ["lessons", "documents", "quizzes"];

async function deleteCollection(collectionPath: string): Promise<number> {
  const ref = db.collection(collectionPath);
  const snapshot = await ref.get();
  if (snapshot.empty) {
    return 0;
  }
  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  return snapshot.size;
}

async function deleteCourseSubcollections(courseId: string): Promise<number> {
  let total = 0;
  for (const subName of SUBCOLLECTIONS_OF_COURSES) {
    const ref = db.collection("courses").doc(courseId).collection(subName);
    const snapshot = await ref.get();
    if (!snapshot.empty) {
      const batch = db.batch();
      snapshot.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      total += snapshot.size;
    }
  }
  return total;
}

async function clearUserCourseReferences(): Promise<number> {
  const usersRef = db.collection("users");
  const snapshot = await usersRef.get();
  if (snapshot.empty) return 0;

  const batch = db.batch();
  let count = 0;
  snapshot.docs.forEach((userDoc) => {
    const data = userDoc.data();
    if (data.enrolledCourses?.length || data.completedCourses?.length) {
      batch.update(userDoc.ref, {
        enrolledCourses: [],
        completedCourses: [],
        updatedAt: new Date().toISOString(),
      });
      count++;
    }
  });
  if (count > 0) {
    await batch.commit();
  }
  return count;
}

async function main() {
  console.log("=".repeat(60));
  console.log("  CLEANUP: Xóa khóa học & chứng chỉ");
  console.log("=".repeat(60));
  console.log("");

  console.log("[1/4] Xóa subcollections của courses (lessons/documents/quizzes)...");
  const coursesSnap = await db.collection("courses").get();
  let subDeleted = 0;
  for (const course of coursesSnap.docs) {
    subDeleted += await deleteCourseSubcollections(course.id);
    console.log(`  - ${course.id}: cleaned`);
  }
  console.log(`  ✓ Đã xóa ${subDeleted} subcollection docs\n`);

  console.log("[2/4] Xóa collection: courses...");
  const coursesCount = await deleteCollection("courses");
  console.log(`  ✓ Đã xóa ${coursesCount} khóa học\n`);

  console.log("[3/4] Xóa certificates, progress, quizAttempts...");
  let totalOthers = 0;
  for (const col of COLLECTIONS_TO_DELETE) {
    const n = await deleteCollection(col);
    console.log(`  ✓ ${col}: ${n} docs`);
    totalOthers += n;
  }
  console.log(`  Tổng: ${totalOthers} docs\n`);

  console.log("[4/4] Reset enrolledCourses/completedCourses trên users...");
  const usersUpdated = await clearUserCourseReferences();
  console.log(`  ✓ Đã reset ${usersUpdated} users\n`);

  console.log("=".repeat(60));
  console.log("  HOÀN TẤT");
  console.log("=".repeat(60));
  console.log(`  Khóa học: ${coursesCount}`);
  console.log(`  Subcollections: ${subDeleted}`);
  console.log(`  Certificates/Progress/Attempts: ${totalOthers}`);
  console.log(`  Users reset: ${usersUpdated}`);
  console.log("");

  process.exit(0);
}

main().catch((err) => {
  console.error("LỖI:", err);
  process.exit(1);
});
