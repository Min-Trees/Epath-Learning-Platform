"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  Loader2,
  Play,
  Maximize2,
  Minimize2,
  Eye,
  Ban,
  RotateCcw,
} from "lucide-react";
import { useVideoProgress } from "@/hooks/use-video-progress";
import { useBlockDevTools } from "@/hooks/use-block-devtools";
import { apiPost } from "@/lib/api-client";

interface SecureVideoPlayerProps {
  programId: string;
  lessonId: string;
  title: string;
  userId?: string;
  requireFullWatch?: boolean;
  onComplete?: () => void;
}

interface TokenResponse {
  success: boolean;
  data?: {
    token: string;
    expiresIn: number;
    sessionId: string;
    fileKey?: string;
  };
  error?: string;
}

function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h > 0) {
    return `${h}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${min}:${String(sec).padStart(2, "0")}`;
}

/**
 * Trình phát video bảo mật chống reset & tự động phát tiếp vị trí đang xem dở:
 * - Lưu vị trí phát vào localStorage (ngay lập tức) + đồng bộ Firestore
 * - Tự động phát tiếp (Auto-Resume) khi tải lại trang hoặc mở lại bài học
 * - Bảo toàn currentTime khi token auto-refresh, không bao giờ reset về 0
 */
export function SecureVideoPlayer({
  programId,
  lessonId,
  title,
  userId,
  requireFullWatch = false,
  onComplete,
}: SecureVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTimeRef = useRef(0);
  const tokenRef = useRef<string | null>(null);
  const tokenExpiryRef = useRef<number>(0);
  const fetchingRef = useRef(false);
  const hasCompletedRef = useRef(false);

  // Resume State
  const resumeStorageKey = `epath_video_resume_${userId || "anon"}_${programId}_${lessonId}`;
  const [resumedTime, setResumedTime] = useState<number | null>(null);
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const hasResumedRef = useRef(false);

  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [urlReady, setUrlReady] = useState(false);

  const progress = useVideoProgress({ userId, courseId: programId, lessonId });

  // Anti-DevTools block
  const [devtoolsOpen, setDevtoolsOpen] = useState(false);
  useBlockDevTools(true);
  useEffect(() => {
    const onOpen = () => {
      setDevtoolsOpen(true);
      videoRef.current?.pause();
    };
    const onClose = () => setDevtoolsOpen(false);
    window.addEventListener("app:devtools-opened", onOpen);
    window.addEventListener("app:devtools-closed", onClose);
    return () => {
      window.removeEventListener("app:devtools-opened", onOpen);
      window.removeEventListener("app:devtools-closed", onClose);
    };
  }, []);

  // Lắng nghe beforeunload & pagehide để lưu chính xác giây cuối cùng khi thoát trang
  useEffect(() => {
    const saveCurrent = () => {
      const v = videoRef.current;
      if (v && v.currentTime > 0) {
        try {
          localStorage.setItem(resumeStorageKey, String(v.currentTime));
        } catch {}
      }
    };
    window.addEventListener("beforeunload", saveCurrent);
    window.addEventListener("pagehide", saveCurrent);
    return () => {
      window.removeEventListener("beforeunload", saveCurrent);
      window.removeEventListener("pagehide", saveCurrent);
    };
  }, [resumeStorageKey]);

  /**
   * Fetch stream token (cached until 90s before TTL)
   */
  const fetchStreamUrl = useCallback(async (): Promise<string> => {
    const now = Date.now();
    // Reuse cached token nếu còn >90s hạn (TTL 4h)
    if (tokenRef.current && tokenExpiryRef.current > now + 90000) {
      return `/api/stream/${tokenRef.current}/file`;
    }

    if (fetchingRef.current) {
      await new Promise<void>((resolve) => {
        const check = () => {
          if (!fetchingRef.current || tokenRef.current) resolve();
          else setTimeout(check, 50);
        };
        check();
      });
      if (tokenRef.current && tokenExpiryRef.current > Date.now()) {
        return `/api/stream/${tokenRef.current}/file`;
      }
    }

    fetchingRef.current = true;
    try {
      const res = await apiPost<TokenResponse["data"]>("/api/stream/token", {
        programId,
        lessonId,
        kind: "video",
      });

      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Không tạo được session");
      }

      tokenRef.current = res.data.token;
      tokenExpiryRef.current = now + (res.data.expiresIn * 1000);
      return `/api/stream/${res.data.token}/file`;
    } finally {
      fetchingRef.current = false;
    }
  }, [programId, lessonId]);

  /**
   * Khởi tạo URL video
   */
  useEffect(() => {
    let cancelled = false;

    // Reset state khi đổi bài học
    tokenRef.current = null;
    tokenExpiryRef.current = 0;
    hasCompletedRef.current = false;
    hasResumedRef.current = false;
    setResumedTime(null);
    setShowResumeBanner(false);
    setStreamUrl(null);
    setHasPlayedOnce(false);
    setError(null);
    setUrlReady(false);
    setLoading(true);

    if (videoRef.current) {
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }

    (async () => {
      try {
        const url = await fetchStreamUrl();
        if (cancelled) return;

        setStreamUrl(url);
        if (videoRef.current) {
          videoRef.current.src = url;
          videoRef.current.load();
        }
        setUrlReady(true);
      } catch (e) {
        if (cancelled) return;
        setError(
          `Không tải được video: ${e instanceof Error ? e.message : "unknown"}`
        );
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId, lessonId]);

  /**
   * Auto-refresh token trước khi hết hạn — Không làm gián đoạn hoặc reset video
   */
  useEffect(() => {
    if (!urlReady) return;

    const REFRESH_BEFORE_MS = 5 * 60 * 1000; // refresh khi còn 5 phút
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const scheduleRefresh = () => {
      if (cancelled) return;
      const remaining = tokenExpiryRef.current - Date.now();
      if (remaining <= 0) {
        void doRefresh();
        return;
      }
      const wait = Math.max(remaining - REFRESH_BEFORE_MS, 30_000);
      timer = setTimeout(() => {
        void doRefresh();
      }, wait);
    };

    const doRefresh = async () => {
      if (cancelled) return;
      const v = videoRef.current;
      if (!v) {
        scheduleRefresh();
        return;
      }

      // Ghi nhớ vị trí phát hiện tại trước khi refresh
      const savedTime = v.currentTime || lastTimeRef.current;
      const wasPlaying = !v.paused;

      try {
        tokenRef.current = null;
        tokenExpiryRef.current = 0;
        const url = await fetchStreamUrl();
        if (cancelled) return;

        // Chỉ đổi src nếu URL token thay đổi thật sự
        if (v.src !== url) {
          v.src = url;
          v.load();
          const onLoaded = () => {
            v.removeEventListener("loadedmetadata", onLoaded);
            try {
              if (savedTime > 0) {
                v.currentTime = savedTime;
                lastTimeRef.current = savedTime;
              }
              if (wasPlaying) {
                void v.play().catch(() => {});
              }
            } catch {}
          };
          v.addEventListener("loadedmetadata", onLoaded);
          setStreamUrl(url);
        }
      } catch (e) {
        if (cancelled) return;
        console.warn("[secure-video] token refresh failed:", e);
      }
      scheduleRefresh();
    };

    scheduleRefresh();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [urlReady, fetchStreamUrl]);

  const onTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const cur = v.currentTime;
    const dur = v.duration || 0;

    if (requireFullWatch) {
      if (cur > lastTimeRef.current + 2 && lastTimeRef.current > 0) {
        v.currentTime = lastTimeRef.current;
        return;
      }
      if (cur < lastTimeRef.current - 2 && lastTimeRef.current > 0) {
        v.currentTime = lastTimeRef.current;
        return;
      }
    }
    lastTimeRef.current = cur;

    // Lưu ngay vị trí xem vào localStorage để không bao giờ bị mất vị trí
    if (cur > 1) {
      try {
        localStorage.setItem(resumeStorageKey, String(cur));
      } catch {}
    }

    void progress.writeProgress(cur, dur);

    // Kích hoạt hoàn thành khi xem hết video (>= 95% thời lượng hoặc còn dưới 1 giây)
    if (dur > 0 && (cur >= dur - 1 || (cur / dur) >= 0.95)) {
      if (!hasCompletedRef.current) {
        hasCompletedRef.current = true;
        onComplete?.();
      }
    }
  }, [progress, requireFullWatch, onComplete, resumeStorageKey]);

  const onPlay = useCallback(() => {
    setHasPlayedOnce(true);
    setLoading(false);
  }, []);

  const onPause = useCallback(() => {
    const v = videoRef.current;
    if (v && v.currentTime > 0) {
      try {
        localStorage.setItem(resumeStorageKey, String(v.currentTime));
      } catch {}
    }
  }, [resumeStorageKey]);

  const onEnded = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    try {
      localStorage.removeItem(resumeStorageKey);
    } catch {}
    void progress.writeProgress(v.duration || lastTimeRef.current, v.duration || 0);
    if (!hasCompletedRef.current) {
      hasCompletedRef.current = true;
      onComplete?.();
    }
  }, [progress, onComplete, resumeStorageKey]);

  // Khôi phục vị trí xem dở khi metadata video tải xong
  const handleLoadedMetadata = useCallback(() => {
    setLoading(false);
    setUrlReady(true);
    const v = videoRef.current;
    if (!v) return;

    if (!hasResumedRef.current) {
      hasResumedRef.current = true;
      let targetTime = 0;

      // 1. Kiểm tra localStorage (ưu tiên cao nhất, tức thì)
      try {
        const stored = localStorage.getItem(resumeStorageKey);
        if (stored) targetTime = parseFloat(stored) || 0;
      } catch {}

      // 2. Fallback: Lấy từ Firestore progress nếu localStorage chưa có
      if (!targetTime && progress.watchedSeconds > 3) {
        targetTime = progress.watchedSeconds;
      }

      // Chỉ tua tiếp nếu thời gian xem dở từ 3 giây trở lên và chưa hết video
      if (targetTime > 3 && (v.duration ? targetTime < v.duration - 3 : true)) {
        try {
          v.currentTime = targetTime;
          lastTimeRef.current = targetTime;
          setResumedTime(targetTime);
          setShowResumeBanner(true);
          setTimeout(() => setShowResumeBanner(false), 6000);
        } catch {}
      }
    }
  }, [resumeStorageKey, progress.watchedSeconds]);

  // Click Play: nếu token hết hạn thì lấy mới và giữ nguyên vị trí xem dở
  const handlePlayClick = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;

    const now = Date.now();
    if (!tokenRef.current || tokenExpiryRef.current <= now) {
      try {
        setLoading(true);
        const savedTime = v.currentTime || lastTimeRef.current;
        const url = await fetchStreamUrl();
        setStreamUrl(url);
        v.src = url;
        v.load();
        const onReady = () => {
          v.removeEventListener("canplay", onReady);
          if (savedTime > 0) {
            try {
              v.currentTime = savedTime;
              lastTimeRef.current = savedTime;
            } catch {}
          }
          void v.play();
        };
        v.addEventListener("canplay", onReady);
        setUrlReady(true);
        return;
      } catch (e) {
        setError(`Không tải được video: ${e instanceof Error ? e.message : "unknown"}`);
        setLoading(false);
        return;
      }
    }

    if (!urlReady) {
      try {
        setLoading(true);
        const url = await fetchStreamUrl();
        setStreamUrl(url);
        v.src = url;
        v.load();
        setUrlReady(true);
      } catch (e) {
        setError(`Không tải được video: ${e instanceof Error ? e.message : "unknown"}`);
        setLoading(false);
        return;
      }
    }

    void v.play();
  }, [urlReady, fetchStreamUrl]);

  // Xem lại từ đầu
  const handleRestartFromBeginning = () => {
    const v = videoRef.current;
    if (v) {
      try {
        v.currentTime = 0;
        lastTimeRef.current = 0;
        localStorage.setItem(resumeStorageKey, "0");
      } catch {}
      setShowResumeBanner(false);
    }
  };

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await containerRef.current?.requestFullscreen();
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="relative aspect-video w-full overflow-hidden rounded-lg bg-black select-none fullscreen:aspect-auto fullscreen:h-screen fullscreen:w-screen fullscreen:rounded-none"
        onContextMenu={(e) => e.preventDefault()}
      >
        <video
          ref={videoRef}
          controls={!requireFullWatch}
          controlsList="nodownload noremoteplayback noplaybackrate"
          disablePictureInPicture
          playsInline
          preload="auto"
          onContextMenu={(e) => e.preventDefault()}
          onTimeUpdate={onTimeUpdate}
          onPlay={onPlay}
          onPause={onPause}
          onEnded={onEnded}
          onWaiting={() => setLoading(true)}
          onCanPlay={() => setLoading(false)}
          onError={() => {
            setError("Không tải được video. File có thể đã bị xóa hoặc không tồn tại.");
            setLoading(false);
            setHasPlayedOnce(true);
          }}
          onDragStart={(e) => e.preventDefault()}
          onLoadedMetadata={handleLoadedMetadata}
          className="h-full w-full"
        />

        {/* Thông báo tiếp tục xem từ vị trí dở */}
        {showResumeBanner && resumedTime && resumedTime > 0 && (
          <div className="absolute top-3 left-3 right-3 sm:left-auto sm:right-3 z-30 flex items-center justify-between gap-3 bg-black/85 text-white text-xs px-3 py-2 rounded-md shadow-xl border border-white/15 backdrop-blur animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-1.5 truncate">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
              <span>Tiếp tục từ <strong>{formatTime(resumedTime)}</strong></span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleRestartFromBeginning}
                className="text-xs text-sky-300 hover:text-sky-200 underline font-medium cursor-pointer"
              >
                Xem lại từ đầu
              </button>
              <button
                type="button"
                onClick={() => setShowResumeBanner(false)}
                className="text-white/60 hover:text-white p-0.5 ml-0.5 cursor-pointer"
                aria-label="Đóng thông báo"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Loading spinner */}
        {loading && urlReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10 pointer-events-none">
            <Loader2 className="h-10 w-10 animate-spin text-white" />
          </div>
        )}

        {/* Initial loading */}
        {loading && !urlReady && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 z-10">
            <Loader2 className="h-10 w-10 animate-spin text-white" />
            <p className="text-white/80 text-sm">Đang chuẩn bị video...</p>
          </div>
        )}

        {/* Play button overlay */}
        {!hasPlayedOnce && urlReady && !error && (
          <button
            type="button"
            onClick={handlePlayClick}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 hover:bg-black/50 transition cursor-pointer z-20"
            aria-label="Phát video"
          >
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-md ring-2 ring-white/60 transition hover:scale-110 hover:bg-white/30">
              <Play className="h-9 w-9 text-white fill-white ml-1" />
            </span>
            <span className="text-white text-base font-medium drop-shadow-lg">
              Bấm để phát video
            </span>
          </button>
        )}

        {/* Progress bar for requireFullWatch mode */}
        {requireFullWatch && userId && (
          <div className="pointer-events-none absolute bottom-2 left-2 right-2 z-[3] flex items-center gap-2 rounded-md bg-black/70 px-3 py-1.5 text-xs text-white backdrop-blur-sm">
            <Eye className="h-3.5 w-3.5" />
            <div className="flex-1">
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full bg-emerald-400 transition-all"
                  style={{ width: `${Math.min(100, progress.percentage)}%` }}
                />
              </div>
            </div>
            <span className="font-mono">
              {progress.completed
                ? "✓ Hoàn thành"
                : `${Math.floor(progress.percentage)}%`}
            </span>
          </div>
        )}

        {/* Fullscreen button */}
        <button
          type="button"
          onClick={toggleFullscreen}
          className="absolute bottom-3 right-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition hover:bg-black/80"
          aria-label={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </button>

        {/* Anti-piracy watermark */}
        {streamUrl && (
          <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            <div className="bg-black/50 backdrop-blur-sm px-4 py-2 rounded-lg">
              <p className="text-white/70 text-xs flex items-center gap-2">
                <Ban className="h-3 w-3" />
                Không được phép tải video
              </p>
            </div>
          </div>
        )}

        {/* DevTools blocker overlay */}
        {devtoolsOpen && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/95 backdrop-blur-md cursor-default">
            <div className="flex flex-col items-center gap-3 px-6 py-5 rounded-lg bg-black/80 ring-1 ring-white/10">
              <Ban className="h-10 w-10 text-red-400" />
              <p className="text-white text-sm font-medium">
                Đã phát hiện DevTools đang mở
              </p>
              <p className="text-white/70 text-xs text-center max-w-xs">
                Vui lòng đóng cửa sổ Inspect/Console để tiếp tục xem video.
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">{error}</AlertDescription>
          <button
            onClick={async () => {
              setError(null);
              setLoading(true);
              try {
                const url = await fetchStreamUrl();
                setStreamUrl(url);
                if (videoRef.current) {
                  videoRef.current.src = url;
                  videoRef.current.load();
                }
                setUrlReady(true);
              } catch (e) {
                setError(`Không tải được video: ${e instanceof Error ? e.message : "unknown"}`);
                setLoading(false);
              }
            }}
            className="mt-2 text-xs underline"
          >
            Thử lại
          </button>
        </Alert>
      )}
    </div>
  );
}
