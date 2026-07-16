"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
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

/**
 * SecureVideoPlayer - Player dùng HLS streaming qua session token.
 *
 * Flow:
 * 1. POST /api/stream/token → JWT token (10 phút)
 * 2. HLS.js load playlist: GET /api/stream/[token]/playlist.m3u8
 * 3. Mỗi segment: GET /api/stream/[token]/segment/[N].ts
 *    - Server FFmpeg transcode + watermark user
 *
 * Không URL trực tiếp tới R2 nào xuất hiện trong Network tab.
 * Mỗi segment có watermark "email · sid · segN" ở góc dưới phải.
 */

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
  const hlsRef = useRef<Hls | null>(null);
  const tokenRef = useRef<string | null>(null);
  const tokenExpiresAtRef = useRef<number>(0);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const lastTimeRef = useRef(0);

  const progress = useVideoProgress({ userId, programId, lessonId });

  /**
   * Lấy session token từ server. Cache trong ref, refresh trước khi hết hạn 60s.
   */
  const getToken = useCallback(async (): Promise<string | null> => {
    const now = Date.now();
    if (tokenRef.current && tokenExpiresAtRef.current - now > 60_000) {
      return tokenRef.current;
    }
    try {
      const json = await apiPost<TokenResponse["data"]>(
        "/api/stream/token",
        { programId, lessonId, kind: "video" }
      );
      if (!json.success || !json.data) {
        throw new Error(json.error ?? "Không tạo được session");
      }
      tokenRef.current = json.data.token;
      tokenExpiresAtRef.current = now + json.data.expiresIn * 1000;
      return json.data.token;
    } catch (e) {
      setError(
        `Không tạo được session: ${e instanceof Error ? e.message : "unknown"}`
      );
      return null;
    }
  }, [programId, lessonId]);

  /**
   * Build playlist URL với token hiện tại. HLS.js sẽ fetch playlist này.
   * Lưu ý: HLS.js fetch playlist không kèm header Authorization, nhưng URL
   * đã chứa token → server vẫn xác thực được.
   */
  const buildPlaylistUrl = useCallback((token: string): string => {
    return `/api/stream/${token}/playlist.m3u8`;
  }, []);

  /**
   * Setup HLS player.
   */
  const setupPlayer = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    setLoading(true);
    setError(null);

    const token = await getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    const playlistUrl = buildPlaylistUrl(token);

    // Cleanup instance cũ
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        // Preload nhiều hơn để không bị dừng
        maxBufferLength: 120,
        maxMaxBufferLength: 180,
        maxBufferSize: 200 * 1024 * 1024,
        maxBufferHole: 1,
        // Start level: load ngay level cao nhất
        startLevel: -1,
        capLevelToPlayerSize: false,
        // Retry nhiều hơn
        manifestLoadingMaxRetry: 5,
        manifestLoadingRetryDelay: 1000,
        levelLoadingMaxRetry: 5,
        levelLoadingRetryDelay: 1000,
        fragLoadingMaxRetry: 10,
        fragLoadingRetryDelay: 2000,
      });

      hls.loadSource(playlistUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // Token có thể đã hết hạn → thử refresh
              tokenRef.current = null;
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setError(
                `Lỗi phát video: ${data.type} - ${data.details ?? ""}`
              );
          }
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS
      video.src = playlistUrl;
      video.addEventListener("loadedmetadata", () => setLoading(false), {
        once: true,
      });
    } else {
      setError("Trình duyệt không hỗ trợ HLS playback");
      setLoading(false);
    }
  }, [getToken, buildPlaylistUrl]);

  useEffect(() => {
    void setupPlayer();
    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [setupPlayer]);

  /**
   * Chống tua khi requireFullWatch: nếu currentTime nhảy vọt → reset.
   */
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

  // Fullscreen
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
        HLS streaming · session token · watermark per-user · không URL trực
        tiếp tới R2.
      </p>
    </div>
  );
}
