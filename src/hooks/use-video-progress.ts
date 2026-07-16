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
}

/**
 * Hook quản lý tiến độ xem video của user cho một (course, lesson).
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
}: UseVideoProgressOptions) {
  const [state, setState] = useState<VideoProgressState>({
    watchedSeconds: 0,
    completed: false,
    duration: 0,
    percentage: 0,
    loading: Boolean(userId),
  });

  const lastReportedRef = useRef(0);
  const writeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingWriteRef = useRef<{ watchedSeconds: number; duration: number } | null>(null);

  // Subscribe realtime
  useEffect(() => {
    if (!userId) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    const ref = doc(db, "users", userId, "lessonProgress", lessonId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
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
        setState({
          watchedSeconds: watched,
          completed,
          duration,
          percentage,
          loading: false,
        });
      },
      () => setState((s) => ({ ...s, loading: false }))
    );
    return () => {
      unsub();
      if (writeTimeoutRef.current) clearTimeout(writeTimeoutRef.current);
    };
  }, [userId, lessonId]);

  const writeProgress = useCallback(
    async (watchedSeconds: number, duration: number) => {
      if (!userId) return;
      // Không ghi nếu giá trị mới nhỏ hơn đã lưu (chống tua lùi ghi đè)
      if (watchedSeconds < lastReportedRef.current - 2) return;

      lastReportedRef.current = Math.max(lastReportedRef.current, watchedSeconds);

      // Lưu lại pending write
      pendingWriteRef.current = { watchedSeconds, duration };

      // Cancel timeout cũ
      if (writeTimeoutRef.current) {
        clearTimeout(writeTimeoutRef.current);
      }

      // Debounce 2s - gộp nhiều lần gọi thành 1 write
      writeTimeoutRef.current = setTimeout(async () => {
        const pending = pendingWriteRef.current;
        if (!pending || !userId) return;

        const safeDuration = pending.duration > 0 ? pending.duration : pending.watchedSeconds;
        const percentage = safeDuration > 0 ? Math.min(100, (pending.watchedSeconds / safeDuration) * 100) : 0;
        const completed = percentage >= completionThreshold;

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
        } catch (e) {
          console.warn("Failed to write video progress:", e);
        }
      }, 2000);
    },
    [userId, courseId, lessonId, completionThreshold]
  );

  return { ...state, writeProgress };
}