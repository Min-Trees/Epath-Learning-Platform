"use client";

import { useEffect, useRef } from "react";

/**
 * Hook anti-seek cho iframe YouTube.
 *
 * Polling `getCurrentTime` mỗi `pollIntervalMs` ms qua window.postMessage.
 * Nếu currentTime nhảy vọt hơn `seekThreshold` giây so với lần trước →
 * tua → gọi `seekTo(lastTime)` để reset.
 *
 * Khi currentTime >= `duration - 1` (coi như hết) → `onComplete()`.
 *
 * Yêu cầu iframe URL đã có `enablejsapi=1`.
 */
export interface UseYouTubePlayerOptions {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  enabled: boolean;
  /** bật chống tua (khi course yêu cầu xem hết) */
  preventSeek: boolean;
  /** polling interval (ms) */
  pollIntervalMs?: number;
  /** ngưỡng tua — bao nhiêu giây nhảy vọt = tua */
  seekThreshold?: number;
  /** gọi mỗi poll với currentTime + duration */
  onProgress?: (currentTime: number, duration: number) => void;
  /** gọi khi đạt >=95% duration */
  onComplete?: (duration: number) => void;
}

export function useYouTubePlayer({
  iframeRef,
  enabled,
  preventSeek,
  pollIntervalMs = 1000,
  seekThreshold = 3,
  onProgress,
  onComplete,
}: UseYouTubePlayerOptions) {
  const lastTimeRef = useRef(0);
  const durationRef = useRef(0);
  const lastSentOnCompleteRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;

    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      try {
        win.postMessage(
          JSON.stringify({
            event: "command",
            func: "getCurrentTime",
            args: [],
          }),
          "*"
        );
        win.postMessage(
          JSON.stringify({ event: "command", func: "getDuration", args: [] }),
          "*"
        );
      } catch {
        // ignore
      }
    };

    const interval = setInterval(tick, pollIntervalMs);

    const onMessage = (e: MessageEvent) => {
      if (
        e.origin !== "https://www.youtube-nocookie.com" &&
        e.origin !== "https://www.youtube.com"
      ) {
        return;
      }
      const data = e.data;
      if (!data || typeof data !== "object") return;

      // YouTube IFrame API gửi response dạng:
      //   { event: "info", info: { currentTime, duration } }   (playback updates)
      //   { event: "command", id, func, args: [value] }         (response polling)
      const d = data as Record<string, unknown>;

      if (d.event === "info" && d.info && typeof d.info === "object") {
        const info = d.info as { currentTime?: number; duration?: number };
        const cur = info.currentTime ?? 0;
        const dur = info.duration ?? 0;
        if (dur > 0) durationRef.current = dur;
        onProgress?.(cur, durationRef.current);
        return;
      }

      if (d.event === "command" && Array.isArray(d.args)) {
        // response cho getCurrentTime → args[0] là number
        const val = d.args[0];
        if (typeof val !== "number") return;
        const cur = val;

        if (preventSeek) {
          const last = lastTimeRef.current;
          // Nếu tăng quá nhanh → tua
          if (cur > last + seekThreshold && last > 0) {
            win.postMessage(
              JSON.stringify({
                event: "command",
                func: "seekTo",
                args: [last, true],
              }),
              "*"
            );
            // Không cập nhật lastTime — vẫn giữ giá trị cũ
            return;
          }
          // Tua lùi cũng reset
          if (cur < last - seekThreshold && last > 0) {
            win.postMessage(
              JSON.stringify({
                event: "command",
                func: "seekTo",
                args: [last, true],
              }),
              "*"
            );
            return;
          }
        }

        lastTimeRef.current = cur;
        onProgress?.(cur, durationRef.current);

        if (
          durationRef.current > 0 &&
          cur >= durationRef.current * 0.95 &&
          lastSentOnCompleteRef.current !== durationRef.current
        ) {
          lastSentOnCompleteRef.current = durationRef.current;
          onComplete?.(durationRef.current);
        }
      }
    };

    window.addEventListener("message", onMessage);
    // Tick ngay lần đầu
    tick();

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("message", onMessage);
    };
  }, [
    enabled,
    iframeRef,
    pollIntervalMs,
    preventSeek,
    seekThreshold,
    onProgress,
    onComplete,
  ]);
}