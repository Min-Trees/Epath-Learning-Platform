/**
 * Cache dùng chung cho /api/me/programs.
 *
 * Vấn đề đã gặp:
 *   - Trước đây cache key dùng header `x-user-id` nhưng header này không được
 *     set bởi bất kỳ đâu → mọi user share chung 1 cache key "anon".
 *   - Cache 5 phút, không có invalidation khi publish/unpublish hoặc
 *     gán/hủy-gán chương trình → user thấy dữ liệu cũ sau khi admin thay đổi.
 *
 * Thiết kế mới:
 *   - Key theo `uid` thật của user (lấy từ Firebase Auth).
 *   - TTL ngắn (30s) để an toàn nếu invalidation bị miss.
 *   - Export hàm `invalidateUser(uid)` và `invalidateAll()` để các route
 *     khác có thể clear cache khi có thay đổi liên quan.
 */

type CacheEntry<T> = { data: T; expiry: number };

const DEFAULT_TTL_MS = 30 * 1000; // 30 giây (an toàn, giảm đáng kể stale data)

const meProgramsCache = new Map<string, CacheEntry<unknown>>();

export function getCachedMePrograms<T = unknown>(
  uid: string
): T | null {
  const key = buildKey(uid);
  const cached = meProgramsCache.get(key);
  if (!cached) return null;
  if (cached.expiry <= Date.now()) {
    meProgramsCache.delete(key);
    return null;
  }
  return cached.data as T;
}

export function setCachedMePrograms<T = unknown>(
  uid: string,
  data: T,
  ttlMs: number = DEFAULT_TTL_MS
): void {
  meProgramsCache.set(buildKey(uid), {
    data,
    expiry: Date.now() + ttlMs,
  });
}

/**
 * Xóa cache của 1 user cụ thể (dùng khi assignment/progress của user đó thay đổi).
 */
export function invalidateUser(uid: string): void {
  if (!uid) return;
  meProgramsCache.delete(buildKey(uid));
}

/**
 * Xóa cache của nhiều user.
 */
export function invalidateUsers(uids: Iterable<string>): void {
  for (const uid of uids) invalidateUser(uid);
}

/**
 * Xóa toàn bộ cache (dùng khi publish/unpublish/delete program, hoặc
 * bất kỳ thay đổi nào có thể ảnh hưởng đến nhiều user).
 */
export function invalidateAll(): void {
  meProgramsCache.clear();
}

function buildKey(uid: string): string {
  return `me_programs_${uid}`;
}
