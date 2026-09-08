"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  doc,
  setDoc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface VideoProgressState {
  /** đã xem bao nhiêu giây (cao nhất từ trước đến nay) */
  watchedSeconds: number;
  /** đã đánh dấu hoàn thành chưa */
  completed: boolean;
  /** thời lượng video thực tế (giây) — do client báo cáo */
  duration: number;
  /** tỉ lệ % (0–100) */
  percentage: number;
  /** loading state */
  loading: boolean;
}

interface UseVideoProgressOptions {
  userId?: string;
  courseId: string;
  lessonId: string;
  /** đánh dấu hoàn thành khi percentage >= threshold (mặc định 95% để tránh sát mép) */
  completionThreshold?: number;
  /** Thời gian debounce cho việc ghi progress (ms). Mặc định 3000ms (tăng từ 2000ms) */
  writeDebounceMs?: number;
  /** Bật/tắt realtime listener. Tắt để giảm reads, bật để có cập nhật real-time */
  enableRealtime?: boolean;
}

/**
 * Hook quản lý tiến độ xem video của user cho một (course, lesson).
 * 
 * OPTIMIZATION v2:
 * - Tăng debounce từ 2s → 3s để giảm số lần write
 * - Thêm option enableRealtime để toggle realtime listener
 * - Thêm local cache để tránh đọc Firestore liên tục
 * - Tối ưu logic ghi: chỉ ghi khi có thay đổi thực sự
 *
 * - Path Firestore: users/{userId}/lessonProgress/{lessonId}
 *   (đặt dưới user để dễ truy vấn tiến độ của 1 user, không phải scan course).
 * - Realtime: onSnapshot → return state luôn khi có thay đổi.
 * - writeProgress(): ghi watchedSeconds + completed (idempotent).
 *   Phải gọi từ player khi user tua → currentTime nhảy vọt.
 */
export function useVideoProgress({
  userId,
  courseId,
  lessonId,
  completionThreshold = 95,
  writeDebounceMs = 3000, // Tăng từ 2000ms lên 3000ms
  enableRealtime = true, // Mặc định bật realtime
}: UseVideoProgressOptions) {
  const [state, setState] = useState<VideoProgressState>({
    watchedSeconds: 0,
    completed: false,
    duration: 0,
    percentage: 0,
    loading: Boolean(userId),
  });

  // Local cache to avoid unnecessary Firestore reads
  const localCacheRef = useRef<Map<string, VideoProgressState>>(new Map());
  const cacheKey = `${userId || "anon"}_${lessonId}`;
  
  const lastReportedRef = useRef(0);
  const writeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingWriteRef = useRef<{ watchedSeconds: number; duration: number } | null>(null);
  const hasLoadedRef = useRef(false);

  // Subscribe realtime (có thể tắt để giảm reads)
  useEffect(() => {
    if (!userId || !enableRealtime) {
      setState((s) => ({ ...s, loading: false }));
      // Nếu có local cache, dùng cache thay vì Firestore
      const cached = localCacheRef.current.get(cacheKey);
      if (cached) {
        setState({ ...cached, loading: false });
      }
      return;
    }
    
    // Nếu đã load từ local cache, set state trước
    const cached = localCacheRef.current.get(cacheKey);
    if (cached && hasLoadedRef.current) {
      setState({ ...cached, loading: false });
    }
    
    const ref = doc(db, "users", userId, "lessonProgress", lessonId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        hasLoadedRef.current = true;
        const data = snap.data();
        if (!data) {
          setState((s) => ({ ...s, loading: false }));
          return;
        }
        const watched = (data.watchedSeconds as number) ?? 0;
        const completed = Boolean(data.completed);
        const duration = (data.duration as number) ?? 0;
        const percentage =
          duration > 0 ? Math.min(100, (watched / duration) * 100) : 0;
        
        const newState: VideoProgressState = {
          watchedSeconds: watched,
          completed,
          duration,
          percentage,
          loading: false,
        };
        
        // Update local cache
        localCacheRef.current.set(cacheKey, newState);
        setState(newState);
      },
      () => {
        setState((s) => ({ ...s, loading: false }));
      }
    );
    return () => {
      unsub();
      if (writeTimeoutRef.current) clearTimeout(writeTimeoutRef.current);
    };
  }, [userId, lessonId, enableRealtime, cacheKey]);

  const writeProgress = useCallback(
    async (watchedSeconds: number, duration: number) => {
      if (!userId) return;
      
      // Không ghi nếu giá trị mới nhỏ hơn đã lưu (chống tua lùi ghi đè)
      if (watchedSeconds < lastReportedRef.current - 2) return;
      
      // Không ghi nếu đã completed
      const cached = localCacheRef.current.get(cacheKey);
      if (cached?.completed) return;

      lastReportedRef.current = Math.max(lastReportedRef.current, watchedSeconds);

      // Lưu lại pending write
      pendingWriteRef.current = { watchedSeconds, duration };

      // Cancel timeout cũ
      if (writeTimeoutRef.current) {
        clearTimeout(writeTimeoutRef.current);
      }

      // Debounce - tăng lên 3s để giảm số lần ghi
      writeTimeoutRef.current = setTimeout(async () => {
        const pending = pendingWriteRef.current;
        if (!pending || !userId) return;

        const safeDuration = pending.duration > 0 ? pending.duration : pending.watchedSeconds;
        const percentage = safeDuration > 0 ? Math.min(100, (pending.watchedSeconds / safeDuration) * 100) : 0;
        const completed = percentage >= completionThreshold;

        // Update local state immediately (optimistic update)
        const newState: VideoProgressState = {
          watchedSeconds: pending.watchedSeconds,
          completed,
          duration: safeDuration,
          percentage,
          loading: false,
        };
        localCacheRef.current.set(cacheKey, newState);
        setState(newState);

        const ref = doc(db, "users", userId, "lessonProgress", lessonId);
        try {
          await setDoc(ref, {
            courseId,
            lessonId,
            watchedSeconds: pending.watchedSeconds,
            duration: safeDuration,
            percentage,
            completed,
            lastUpdatedAt: serverTimestamp(),
            ...(completed ? { completedAt: serverTimestamp() } : {}),
          }, { merge: true });
        } catch {
          // ignore - sẽ retry ở lần update tiếp theo
        }
      }, writeDebounceMs);
    },
    [userId, courseId, lessonId, completionThreshold, writeDebounceMs, cacheKey]
  );

  return { ...state, writeProgress };
}