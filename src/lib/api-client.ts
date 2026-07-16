// Client-side helper để gọi API có xác thực.
// Tự gắn Bearer token từ Firebase Auth vào mỗi request.
// Cache token trong 5 phút để tránh fetch liên tục.

import { auth } from "@/lib/firebase";

// Token cache - tránh gọi getIdToken() liên tục
let cachedToken: { token: string; expires: number } | null = null;
const TOKEN_TTL = 5 * 60 * 1000; // 5 phút

async function getIdToken(): Promise<string | null> {
  // Kiểm tra cache trước
  if (cachedToken && cachedToken.expires > Date.now()) {
    return cachedToken.token;
  }

  if (!auth.currentUser) {
    cachedToken = null;
    return null;
  }
  try {
    const token = await auth.currentUser.getIdToken();
    if (token) {
      cachedToken = { token, expires: Date.now() + TOKEN_TTL };
    }
    return token;
  } catch {
    cachedToken = null;
    return null;
  }
}

// Xóa cache token (gọi khi logout)
export function clearTokenCache(): void {
  cachedToken = null;
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string; [k: string]: unknown }> {
  const token = await getIdToken();
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type") && init.body && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(path, { ...init, headers });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return (json as { success: boolean; data?: T; error?: string; [k: string]: unknown }) ??
    { success: false, error: "Bad response" };
}

export async function apiGet<T = unknown>(path: string) {
  return apiFetch<T>(path, { method: "GET" });
}
export async function apiPost<T = unknown>(path: string, body: unknown) {
  return apiFetch<T>(path, { method: "POST", body: JSON.stringify(body) });
}
export async function apiPut<T = unknown>(path: string, body: unknown) {
  return apiFetch<T>(path, { method: "PUT", body: JSON.stringify(body) });
}
export async function apiDelete<T = unknown>(path: string, body?: unknown) {
  return apiFetch<T>(path, {
    method: "DELETE",
    body: body ? JSON.stringify(body) : undefined,
  });
}
