/**
 * In-Memory TTL Cache Utility
 * Giảm tải Firestore read quota & tăng tốc độ phản hồi cho các báo cáo phân tích nặng.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Tự động quét dọn entries hết hạn mỗi 60 giây nếu có
    if (typeof setInterval !== "undefined") {
      this.cleanupTimer = setInterval(() => {
        this.cleanExpired();
      }, 60_000);
      // Unref để không chặn Node event loop khi test/shutdown
      if (this.cleanupTimer.unref) {
        this.cleanupTimer.unref();
      }
    }
  }

  /**
   * Lấy dữ liệu từ cache nếu còn hạn
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  /**
   * Lưu dữ liệu với thời gian sống TTL (mặc định ms)
   * @param key Key định danh
   * @param data Dữ liệu cần lưu
   * @param ttlMs Time-to-live tính theo mili-giây (mặc định 60,000ms = 60s)
   */
  set<T>(key: string, data: T, ttlMs = 60_000): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
      createdAt: Date.now(),
    });
  }

  /**
   * Xóa một key cụ thể
   */
  del(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Xóa các keys bắt đầu bằng tiền tố (hữu ích khi muốn làm mới theo namespace)
   */
  invalidatePrefix(prefix: string): number {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Xóa toàn bộ cache
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Dọn dẹp các cache entry đã hết hạn
   */
  private cleanExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Lấy số lượng phần tử hiện tại
   */
  size(): number {
    return this.store.size;
  }
}

// Global singleton cache instance
export const memoryCache = new MemoryCache();
