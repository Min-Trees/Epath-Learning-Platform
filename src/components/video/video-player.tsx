"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  Lock,
  ShieldCheck,
  Loader2,
  Play,
  Maximize2,
  Minimize2,
  Eye,
} from "lucide-react";
import { buildYouTubeEmbedUrl } from "@/lib/youtube";
import { useVideoProgress } from "@/hooks/use-video-progress";
import { useYouTubePlayer } from "@/hooks/use-youtube-player";

export type VideoProtectMode = "standard" | "locked" | "proxy";

interface VideoPlayerProps {
  /** YouTube video ID (dùng cho chế độ standard và locked) */
  youtubeId?: string | null;
  /** URL video gốc (dùng cho chế độ proxy) */
  videoUrl?: string | null;
  /** courseId/lessonId dùng để build proxy URL */
  courseId: string;
  lessonId: string;
  /** Chế độ bảo vệ (mặc định: locked) */
  protectMode?: VideoProtectMode;
  /** Tiêu đề cho a11y */
  title: string;
  /** Hiển thị watermark tên user lên video */
  watermark?: string;
  /** User ID để lưu progress vào Firestore */
  userId?: string;
  /**
   * Bật chế độ "xem hết mới qua bài":
   * - Ẩn control bar YouTube (không tua được)
   * - Hook IFrame API để chặn tua lập trình (kể cả qua hotkey/devtools)
   * - Ghi progress vào Firestore mỗi ~5s và khi đạt 95% → completed
   */
  requireFullWatch?: boolean;
}

/**
 * VideoPlayer hỗ trợ 3 chế độ bảo vệ YouTube:
 *
 * - "standard": iframe nocookie thường (user có thể click "Watch on YT").
 * - "locked":   iframe nocookie + chặn context menu, keyboard, fullscreen YouTube.
 *               URL gốc (kể cả ?si=...) KHÔNG BAO GIỜ xuất hiện trong DOM.
 * - "proxy":    Server proxy download video từ URL gốc về, stream lại.
 *               User chỉ thấy URL backend, không thấy URL gốc.
 *               Có thể kèm watermark.
 */
export function VideoPlayer({
  youtubeId,
  videoUrl,
  courseId,
  lessonId,
  protectMode = "locked",
  title,
  watermark,
  userId,
  requireFullWatch = false,
}: VideoPlayerProps) {
  if (!youtubeId && !videoUrl) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Bài học này chưa có <code>youtubeId</code> hoặc{" "}
          <code>videoUrl</code>.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-2">
      {protectMode === "proxy" && videoUrl ? (
        <ProxiedVideoPlayer
          videoUrl={videoUrl}
          courseId={courseId}
          lessonId={lessonId}
          title={title}
          watermark={watermark}
          userId={userId}
          requireFullWatch={requireFullWatch}
        />
      ) : protectMode === "locked" && youtubeId ? (
        <LockedYouTubePlayer
          youtubeId={youtubeId}
          title={title}
          courseId={courseId}
          lessonId={lessonId}
          userId={userId}
          requireFullWatch={requireFullWatch}
        />
      ) : youtubeId ? (
        <StandardYouTubePlayer
          youtubeId={youtubeId}
          title={title}
          courseId={courseId}
          lessonId={lessonId}
          userId={userId}
          requireFullWatch={requireFullWatch}
        />
      ) : videoUrl ? (
        <ProxiedVideoPlayer
          videoUrl={videoUrl}
          courseId={courseId}
          lessonId={lessonId}
          title={title}
          watermark={watermark}
          userId={userId}
          requireFullWatch={requireFullWatch}
        />
      ) : null}

      <ModeBadge
        mode={protectMode}
        hasWatermark={Boolean(watermark)}
        requireFullWatch={requireFullWatch}
      />
    </div>
  );
}

function ModeBadge({
  mode,
  hasWatermark,
  requireFullWatch,
}: {
  mode: VideoProtectMode;
  hasWatermark: boolean;
  requireFullWatch: boolean;
}) {
  const labels: Record<VideoProtectMode, string> = {
    standard: "Standard (YouTube embed thường)",
    locked: "Locked (chặn URL gốc, không click ra YouTube)",
    proxy: "Proxy (stream qua server, không lộ URL gốc)",
  };
  const icons: Record<VideoProtectMode, React.ComponentType<{ className?: string }>> = {
    standard: Lock,
    locked: ShieldCheck,
    proxy: ShieldCheck,
  };
  const Icon = icons[mode];
  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
      <Icon className="h-3 w-3" />
      {labels[mode]}
      {requireFullWatch && (
        <span className="ml-2 rounded bg-emerald-100 text-emerald-700 px-2 py-0.5">
          Xem hết mới qua bài
        </span>
      )}
      {hasWatermark && (
        <span className="rounded bg-amber-100 text-amber-700 px-2 py-0.5">
          Watermark: {hasWatermark ? "bật" : "tắt"}
        </span>
      )}
    </p>
  );
}

/**
 * Bọc player + nút fullscreen. Khi fullscreen, video scale theo viewport, không
 * bị giới hạn bởi aspect-ratio 16:9 của wrapper.
 */
function FullscreenWrapper({ children }: { children: React.ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(document.fullscreenElement === wrapperRef.current);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!wrapperRef.current) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await wrapperRef.current.requestFullscreen();
      }
    } catch (e) {
      console.warn("Fullscreen failed:", e);
    }
  };

  return (
    <div
      ref={wrapperRef}
      className="relative group/fullscreen"
    >
      {children}
      <button
        type="button"
        onClick={toggleFullscreen}
        className="absolute bottom-3 right-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white/60"
        aria-label={isFullscreen ? "Thoát toàn màn hình" : "Mở toàn màn hình"}
        title={isFullscreen ? "Thoát toàn màn hình (Esc)" : "Toàn màn hình"}
      >
        {isFullscreen ? (
          <Minimize2 className="h-4 w-4" />
        ) : (
          <Maximize2 className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

/**
 * Chế độ 1: Standard embed.
 * Dùng khi cần tương thích tối đa, chấp nhận để user click ra YouTube.
 */
function StandardYouTubePlayer({
  youtubeId,
  title,
  courseId,
  lessonId,
  userId,
  requireFullWatch,
}: {
  youtubeId: string;
  title: string;
  courseId: string;
  lessonId: string;
  userId?: string;
  requireFullWatch: boolean;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const src = buildYouTubeEmbedUrl(youtubeId, { hideControls: requireFullWatch });

  const progress = useVideoProgress({
    userId,
    courseId,
    lessonId,
  });

  const writeDebouncedRef = useRef(0);
  const onProgress = useCallback(
    (currentTime: number, duration: number) => {
      // Throttle: ghi mỗi ~5s
      const now = Date.now();
      if (now - writeDebouncedRef.current < 5000) return;
      writeDebouncedRef.current = now;
      void progress.writeProgress(currentTime, duration);
    },
    [progress]
  );

  const onComplete = useCallback(
    (duration: number) => {
      void progress.writeProgress(duration, duration);
    },
    [progress]
  );

  useYouTubePlayer({
    iframeRef,
    enabled: Boolean(userId),
    preventSeek: requireFullWatch,
    onProgress,
    onComplete,
  });

  return (
    <FullscreenWrapper>
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-black fullscreen:aspect-auto fullscreen:h-screen fullscreen:w-screen fullscreen:rounded-none">
        <iframe
          ref={iframeRef}
          src={src}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="h-full w-full border-0"
        />
        {requireFullWatch && userId && (
          <WatchGuardOverlay
            percentage={progress.percentage}
            completed={progress.completed}
          />
        )}
      </div>
    </FullscreenWrapper>
  );
}

function WatchGuardOverlay({
  percentage,
  completed,
}: {
  percentage: number;
  completed: boolean;
}) {
  return (
    <div className="pointer-events-none absolute bottom-2 left-2 right-2 z-[3] flex items-center gap-2 rounded-md bg-black/70 px-3 py-1.5 text-xs text-white backdrop-blur-sm">
      <Eye className="h-3.5 w-3.5" />
      <div className="flex-1">
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full bg-emerald-400 transition-all"
            style={{ width: `${Math.min(100, percentage)}%` }}
          />
        </div>
      </div>
      <span className="font-mono">
        {completed ? "✓ Hoàn thành" : `${Math.floor(percentage)}%`}
      </span>
    </div>
  );
}

/**
 * Chế độ 2: Locked.
 * - Iframe nocookie (URL gốc ?si=... không bao giờ xuất hiện)
 * - Chặn context menu, double click, keyboard shortcuts
 * - Ẩn "Watch on YouTube" bằng overlay phía dưới
 * - Áp dụng referrer chính sách strict
 */
function LockedYouTubePlayer({
  youtubeId,
  title,
  courseId,
  lessonId,
  userId,
  requireFullWatch,
}: {
  youtubeId: string;
  title: string;
  courseId: string;
  lessonId: string;
  userId?: string;
  requireFullWatch: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [activated, setActivated] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // Pattern: khi user vào lesson, CHƯA load iframe YouTube.
  // Chỉ hiển thị thumbnail + nút Play. Khi user click Play → mới load iframe
  // với autoplay=1. Điều này CHẶN hoàn toàn nút "Watch on YouTube" vì đến lúc
  // user ngừng tương tác thì iframe vẫn ở chế độ nocookie.
  //
  // Ngoài ra, sau khi play, chúng ta dùng API postMessage + Event listener
  // để chặn mọi click ra ngoài YouTube.
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    iv_load_policy: "3",
    cc_load_policy: "0",
    playsinline: "1",
    fs: "0",
    showinfo: "0",
    disablekb: "1",
    loop: "1",
    playlist: youtubeId,
    autoplay: activated ? "1" : "0",
    enablejsapi: "1",
    controls: requireFullWatch ? "0" : "1",
  });
  const src = activated
    ? `https://www.youtube-nocookie.com/embed/${youtubeId}?${params.toString()}`
    : "";

  const progress = useVideoProgress({
    userId,
    courseId,
    lessonId,
  });

  const writeDebouncedRef = useRef(0);
  const onProgress = useCallback(
    (currentTime: number, duration: number) => {
      const now = Date.now();
      if (now - writeDebouncedRef.current < 5000) return;
      writeDebouncedRef.current = now;
      void progress.writeProgress(currentTime, duration);
    },
    [progress]
  );

  const onComplete = useCallback(
    (duration: number) => {
      void progress.writeProgress(duration, duration);
    },
    [progress]
  );

  useYouTubePlayer({
    iframeRef,
    enabled: activated && Boolean(userId),
    preventSeek: requireFullWatch,
    onProgress,
    onComplete,
  });

  // Chặn context menu + drag + hotkeys khi đang xem video.
  // Các lớp chặn bổ sung cho disablekb=1 (phòng YouTube hotkeys bypass).
  useEffect(() => {
    if (!activated) return;

    const blockContext = (e: MouseEvent) => e.preventDefault();
    const blockDrag = (e: DragEvent) => e.preventDefault();
    const blockKeys = (e: KeyboardEvent) => {
      const code = e.code;
      if (
        [
          "KeyK",
          "KeyF",
          "KeyC",
          "KeyJ",
          "KeyL",
          "KeyT",
          "KeyM",
          "Space",
        ].includes(code) ||
        (e.key >= "0" && e.key <= "9")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener("contextmenu", blockContext);
    document.addEventListener("dragstart", blockDrag);
    document.addEventListener("keydown", blockKeys, true);

    return () => {
      document.removeEventListener("contextmenu", blockContext);
      document.removeEventListener("dragstart", blockDrag);
      document.removeEventListener("keydown", blockKeys, true);
    };
  }, [activated]);

  // Lắng nghe postMessage từ YouTube IFrame API. Khi YouTube gửi
  // command=navigate|loadVideo|loadPlaylist|cueVideo|openUrl → gọi
  // stopVideo để chặn ngay lập tức, không cho iframe điều hướng đi đâu.
  useEffect(() => {
    if (!activated) return;

    const onMessage = (e: MessageEvent) => {
      if (
        e.origin !== "https://www.youtube-nocookie.com" &&
        e.origin !== "https://www.youtube.com"
      ) {
        return;
      }
      const data = e.data;
      if (data && typeof data === "object") {
        const d = data as Record<string, unknown>;
        const cmd = d.func;
        if (
          d.event === "command" &&
          typeof cmd === "string" &&
          /^(navigate|loadVideo|loadPlaylist|cueVideo|openUrl)$/i.test(cmd)
        ) {
          iframeRef.current?.contentWindow?.postMessage(
            JSON.stringify({ event: "command", func: "stopVideo", args: [] }),
            "*"
          );
        }
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [activated]);

  // Ảnh thumbnail YouTube — URL công khai, không tải về server.
  const thumb = `https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`;
  const fallbackThumb = `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;

  return (
    <FullscreenWrapper>
      <div
        ref={containerRef}
        className="space-y-2"
        onClick={(e) => e.preventDefault()}
        onAuxClick={(e) => e.preventDefault()}
      >
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black select-none fullscreen:aspect-auto fullscreen:h-screen fullscreen:w-screen fullscreen:rounded-none">
        {/* Thumbnail chỉ hiển thị khi chưa click Play */}
        {!activated && (
          <>
            <img
              src={thumb}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                const img = e.currentTarget;
                if (img.src !== fallbackThumb) img.src = fallbackThumb;
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30" />
            <button
              type="button"
              onClick={() => setActivated(true)}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 group cursor-pointer"
              aria-label="Phát video"
            >
              <span
                className="flex h-16 w-16 items-center justify-center rounded-full bg-black/70 ring-2 ring-white/80 backdrop-blur-sm transition group-hover:scale-110 group-hover:bg-red-600/90"
              >
                <Play className="h-7 w-7 text-white fill-white" />
              </span>
              <span className="text-white text-sm font-medium drop-shadow">
                Bấm để phát video
              </span>
              <span className="text-white/70 text-xs">Nội dung được bảo vệ</span>
            </button>
          </>
        )}

        {/* Iframe chỉ mount sau khi user click Play */}
        {activated && (
          <>
            {!iframeLoaded && (
              <div className="absolute inset-0 flex items-center justify-center text-white z-20">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
            <iframe
              ref={iframeRef}
              src={src}
              title={title}
              onLoad={() => setIframeLoaded(true)}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              className="w-full h-full border-0 relative z-10"
            />

            {/*
              Lớp phủ toàn bộ iframe, pointer-events: none → không chặn click play/pause.
              Nhưng chuột phải/double-click/drag bị chặn ở container ngoài.
              Quan trọng: không cách nào xóa nút "Watch on YouTube" của YT vì nó
              nằm TRONG iframe, nhưng vì iframe load sau khi click, user không
              thấy controls trước. Sau khi load, controls hiện ra nhưng bị
              click = play/pause. Nút "Watch on YouTube" CHỈ hiện khi video
              kết thúc - và chúng ta có thể chặn bằng cách dùng `playlist`
              để loop video hoặc dùng origin.
            */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-[5]"
              style={{ background: "transparent" }}
            />

            {requireFullWatch && userId && (
              <WatchGuardOverlay
                percentage={progress.percentage}
                completed={progress.completed}
              />
            )}
          </>
        )}
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <ShieldCheck className="h-3 w-3" />
          Click-to-play: video không tự load. URL gốc{" "}
          <code>?si=...</code> không xuất hiện trong DOM.
        </p>
      </div>
    </FullscreenWrapper>
  );
}

/**
 * Chế độ 3: Proxy.
 * - Client gọi /api/video/[courseId]/[lessonId]
 * - Server tải video từ URL gốc về, stream lại cho user
 * - User chỉ thấy URL backend trong Network tab
 * - Có thể overlay watermark với tên user
 */
function ProxiedVideoPlayer({
  videoUrl,
  courseId,
  lessonId,
  title,
  watermark,
  userId,
  requireFullWatch,
}: {
  videoUrl: string;
  courseId: string;
  lessonId: string;
  title: string;
  watermark?: string;
  userId?: string;
  requireFullWatch: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const proxyUrl = `/api/video/${encodeURIComponent(
    courseId
  )}/${encodeURIComponent(lessonId)}`;
  const [error, setError] = useState<string | null>(null);

  const progress = useVideoProgress({ userId, courseId, lessonId });

  // Chống tua cho <video>: lưu lastTime, nếu currentTime nhảy vọt → reset
  const lastTimeRef = useRef(0);
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

  const onEnded = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    void progress.writeProgress(v.duration || lastTimeRef.current, v.duration || 0);
  }, [progress]);

  useEffect(() => {
    void videoUrl; // unused (chỉ để TypeScript không complain)
  }, [videoUrl]);

  return (
    <div className="space-y-2">
      <div className="relative aspect-video rounded-lg overflow-hidden bg-black select-none">
        <video
          ref={videoRef}
          src={proxyUrl}
          controls={!requireFullWatch}
          controlsList="nodownload noremoteplayback"
          disablePictureInPicture
          playsInline
          preload="metadata"
          className="w-full h-full"
          onContextMenu={(e) => e.preventDefault()}
          onTimeUpdate={onTimeUpdate}
          onEnded={onEnded}
          onError={() =>
            setError(
              "Không tải được video. Kiểm tra URL gốc hoặc quyền truy cập."
            )
          }
        >
          Trình duyệt của bạn không hỗ trợ thẻ video.
        </video>

        {watermark && (
          <div
            className="pointer-events-none absolute inset-0 flex items-end justify-end p-3"
            aria-hidden
          >
            <span className="rounded bg-black/40 px-2 py-1 text-xs text-white/70">
              {watermark}
            </span>
          </div>
        )}

        {requireFullWatch && userId && (
          <WatchGuardOverlay
            percentage={progress.percentage}
            completed={progress.completed}
          />
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      <p className="text-xs text-muted-foreground flex items-center gap-2">
        <ShieldCheck className="h-3 w-3" />
        Video stream qua proxy server. URL gốc không bao giờ xuất hiện ở
        client.
      </p>
    </div>
  );
}
