// Helpers dùng chung cho API routes - xác thực bằng Firebase ID token
// và lấy role từ Firestore (Admin SDK). Trả về null nếu không hợp lệ.
// Sử dụng in-memory cache để giảm Firestore reads.

import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { UserRole } from "@/types";

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  isAdmin: boolean;
}

// In-memory cache cho user roles (30 giây)
const userCache = new Map<string, { data: AuthUser; expires: number }>();
const CACHE_TTL = 30_000;

function getCachedUser(uid: string): AuthUser | null {
  const cached = userCache.get(uid);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  userCache.delete(uid);
  return null;
}

function setCachedUser(uid: string, user: AuthUser): void {
  userCache.set(uid, { data: user, expires: Date.now() + CACHE_TTL });
}

export async function getAuthUser(
  req: NextRequest
): Promise<AuthUser | null> {
  const authHeader =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const idToken = match[1].trim();
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);

    // Thử cache trước
    const cached = getCachedUser(decoded.uid);
    if (cached) return cached;

    // Lấy role từ users/{uid} (admin SDK bypass rules)
    let role: UserRole = "employee";
    let displayName: string | null = decoded.name ?? null;
    let email: string | null = decoded.email ?? null;
    try {
      const userSnap = await adminDb
        .collection("users")
        .doc(decoded.uid)
        .get();
      if (userSnap.exists) {
        const data = userSnap.data() as { role?: UserRole; displayName?: string; email?: string };
        if (data.role) role = data.role;
        if (data.displayName) displayName = data.displayName;
        if (data.email) email = data.email;
      }
    } catch {
      // ignore
    }
    const user: AuthUser = {
      uid: decoded.uid,
      email,
      displayName,
      role,
      isAdmin: role === "admin",
    };
    setCachedUser(decoded.uid, user);
    return user;
  } catch (e) {
    console.warn("[api-auth] verifyIdToken failed:", e);
    return null;
  }
}

export function isAdmin(user: AuthUser | null): boolean {
  return user?.role === "admin";
}

export function bad(message: string, status = 400) {
  return Response.json(
    { success: false, error: message },
    { status }
  );
}

export function ok<T>(data?: T, init?: ResponseInit) {
  return Response.json({ success: true, data }, init);
}

export function getBaseUrl(req: NextRequest): string {
  // Ưu tiên header x-forwarded-proto + host để dựng URL từ môi trường thật.
  const proto =
    req.headers.get("x-forwarded-proto") ??
    new URL(req.url).protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) return `${proto}://${host}`;
  return new URL(req.url).origin;
}
