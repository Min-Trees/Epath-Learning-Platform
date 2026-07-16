// This file is for server-side use only
// Do not import this in client-side code

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Lấy private key. Hai trường hợp:
 *   1. Env đã chứa newline thật (\n) — không cần replace
 *   2. Env chứa ký tự `\n` literal (4 ký tự: backslash n) — cần replace
 *
 * Cả hai đều được chuẩn hóa về `\n` thật trước khi truyền cho cert().
 */
const privateKeyRaw = process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "";
const privateKey = privateKeyRaw.includes("\\n")
  ? privateKeyRaw.replace(/\\n/g, "\n")
  : privateKeyRaw;

const app = getApps()[0] || initializeApp({
  credential: cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey,
  }),
});

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
export default app;
