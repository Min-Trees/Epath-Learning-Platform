"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  ShieldCheck,
  Loader2,
  Play,
  Maximize2,
  Minimize2,
  Eye,
  Ban,
} from "lucide-react";
import { useVideoProgress } from "@/hooks/use-video-progress";
import { useBlockDevTools } from "@/hooks/use-block-devtools";
import { usePrefetchVideo } from "@/hooks/use-prefetch-video";
import type { PrefetchHandle } from "@/hooks/use-prefetch-video";
import { apiPost } from "@/lib/api-client";

interface SecureVideoPlayerProps {
  programId: string;
  lessonId: string;
  title: string;
  userId?: string;
  requireFullWatch?: boolean;
}

interface TokenResponse {
  success: boolean;
  data?: {
    token: string;
    expiresIn: number;
    sessionId: string;
  };
  error?: string;
}

export function SecureVideoPlayer({
  programId,
  lessonId,
  title,
  userId,
  requireFullWatch = false,
}: SecureVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTimeRef = useRef(0);
  const prefetchHandleRef = useRef<PrefetchHandle | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const progress = useVideoProgress({ userId, courseId: programId, lessonId });
  // startFn ổn định identity (useCallback []). Không wrap trong object
  // để tránh tạo ref mới mỗi render.
  const startFn = usePrefetchVideo();

  // Chặn DevTools + view source. Khi phát hiện DevTools mở → pause video + phủ overlay.
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

  const loadVideo = useCallback(async () => {
    setLoading(true);
    setError(null);
    setHasLoaded(false);

    // Reset video element nếu cần
    if (videoRef.current?.src.startsWith("blob:")) {
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }

    try {
      // Lấy stream session token (TTL 120s, đã ký bằng STREAM_SESSION_SECRET)
      const tokenRes = await apiPost<TokenResponse["data"]>(
        "/api/stream/token",
        { programId, lessonId, kind: "video" }
      );
      if (!tokenRes.success || !tokenRes.data) {
        throw new Error(tokenRes.error ?? "Không tạo được session");
      }

      const streamUrl = `/api/stream/${tokenRes.data.token}/file`;

      // Gán URL trực tiếp cho <video>: browser tự lo HTTP Range streaming + buffer.
      // Đồng thời warm HTTP cache bằng cách fetch parallel các range sau,
      // để khi user tua đến giữa/cuối → buffer đã sẵn sàng.
      const handle = await startFn(streamUrl);

      if (videoRef.current) {
        videoRef.current.src = handle.url;
        prefetchHandleRef.current = handle;
      }

      setHasLoaded(true);
      setLoading(false);
    } catch (e) {
      console.error("[player] loadVideo ERROR", e);
      setError(
        `Không tải được video: ${e instanceof Error ? e.message : "unknown"}`
      );
      setLoading(false);
    }
  }, [programId, lessonId, startFn]);

// Load video đúng 1 lần khi component mount, hoặc khi programId/lessonId đổi.
// Dùng ref để tránh loadVideo thay đổi identity gây re-run effect.
const loadVideoRef = useRef(loadVideo);
loadVideoRef.current = loadVideo;

useEffect(() => {
  void loadVideoRef.current();

  return () => {
    // Cleanup chỉ chạy khi unmount hoặc deps thay đổi.
    // Lưu ý: KHÔNG reset video.src ở đây nếu chưa unmount — sẽ abort play() đang chạy.
    prefetchHandleRef.current?.cleanup();
    prefetchHandleRef.current = null;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [programId, lessonId]);

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
    void progress.writeProgress(cur, dur);
  }, [progress, requireFullWatch]);

  const onPlay = useCallback(() => {
    setHasPlayedOnce(true);
  }, []);

  const onEnded = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    void progress.writeProgress(v.duration || lastTimeRef.current, v.duration || 0);
  }, [progress]);

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
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

  // Prevent right-click
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  // Prevent video download via drag
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="relative aspect-video w-full overflow-hidden rounded-lg bg-black select-none fullscreen:aspect-auto fullscreen:h-screen fullscreen:w-screen fullscreen:rounded-none"
        onContextMenu={handleContextMenu}
      >
        <video
          ref={videoRef}
          controls={!requireFullWatch}
          controlsList="nodownload noremoteplayback noplaybackrate"
          disablePictureInPicture
          playsInline
          preload="auto"
          onContextMenu={handleContextMenu}
          onTimeUpdate={onTimeUpdate}
          onPlay={onPlay}
          onEnded={onEnded}
          onWaiting={() => setLoading(true)}
          onCanPlay={() => setLoading(false)}
          onDragStart={handleDragStart}
          className="h-full w-full"
        />

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-12 w-12 animate-spin text-white" />
              <p className="text-white/80 text-sm">Đang tải video...</p>
            </div>
          </div>
        )}

        {!hasPlayedOnce && hasLoaded && !loading && (
          <button
            type="button"
            onClick={() => videoRef.current?.play()}
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

        {/* Anti-piracy watermark overlay */}
        {hasLoaded && (
          <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            <div className="bg-black/50 backdrop-blur-sm px-4 py-2 rounded-lg">
              <p className="text-white/70 text-xs flex items-center gap-2">
                <Ban className="h-3 w-3" />
                Không được phép tải video
              </p>
            </div>
          </div>
        )}

        {/* Che video khi DevTools mở — buộc đóng DevTools để xem tiếp */}
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
            onClick={() => void loadVideo()}
            className="mt-2 text-xs underline"
          >
            Thử lại
          </button>
        </Alert>
      )}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-3 w-3" />
        HTTP Range streaming · tải song song 4 đoạn · URL S3 ẩn · token 120s · chống DevTools
      </p>
    </div>
  );
}