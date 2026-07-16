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
} from "lucide-react";
import { useVideoProgress } from "@/hooks/use-video-progress";
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
    fileKey: string;
  };
  error?: string;
}

interface FileResponse {
  success: boolean;
  url?: string;
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
  const videoUrlRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const lastTimeRef = useRef(0);

  const progress = useVideoProgress({ userId, courseId: programId, lessonId });

  const loadVideo = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const tokenRes = await apiPost<TokenResponse["data"]>(
        "/api/stream/token",
        { programId, lessonId, kind: "video" }
      );
      if (!tokenRes.success || !tokenRes.data) {
        throw new Error(tokenRes.error ?? "Không tạo được session");
      }

      tokenRef.current = tokenRes.data.token;

      const fileRes = await fetch(`/api/stream/${tokenRes.data.token}/file`);
      const fileJson = (await fileRes.json()) as FileResponse;
      if (!fileJson.success || !fileJson.url) {
        throw new Error(fileJson.error ?? "Không lấy được URL video");
      }

      videoUrlRef.current = fileJson.url;
      setLoading(false);
    } catch (e) {
      setError(
        `Không tải được video: ${e instanceof Error ? e.message : "unknown"}`
      );
      setLoading(false);
    }
  }, [programId, lessonId]);

  useEffect(() => {
    void loadVideo();
  }, [loadVideo]);

  useEffect(() => {
    if (!videoRef.current || !videoUrlRef.current) return;
    if (videoRef.current.src !== videoUrlRef.current) {
      videoRef.current.src = videoUrlRef.current;
    }
  }, [loading]);

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
    } catch (e) {
      console.warn("Fullscreen failed:", e);
    }
  };

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="relative aspect-video w-full overflow-hidden rounded-lg bg-black select-none fullscreen:aspect-auto fullscreen:h-screen fullscreen:w-screen fullscreen:rounded-none"
      >
        <video
          ref={videoRef}
          controls={!requireFullWatch}
          controlsList="nodownload noremoteplayback noplaybackrate"
          disablePictureInPicture
          playsInline
          preload="metadata"
          onContextMenu={(e) => e.preventDefault()}
          onTimeUpdate={onTimeUpdate}
          onPlay={onPlay}
          onEnded={onEnded}
          onWaiting={() => setLoading(true)}
          onCanPlay={() => setLoading(false)}
          className="h-full w-full"
        />

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 className="h-10 w-10 animate-spin text-white" />
          </div>
        )}

        {!hasPlayedOnce && !loading && (
          <button
            type="button"
            onClick={() => videoRef.current?.play()}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/30 hover:bg-black/40 transition cursor-pointer"
            aria-label="Phát video"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/70 ring-2 ring-white/80 backdrop-blur-sm">
              <Play className="h-7 w-7 text-white fill-white" />
            </span>
            <span className="text-white text-sm font-medium drop-shadow">
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
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-3 w-3" />
        Presigned URL · session token · Viettel IDC S3
      </p>
    </div>
  );
}
