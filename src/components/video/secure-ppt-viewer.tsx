"use client";

import { useState, useEffect, useRef } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ShieldCheck,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  X,
  Presentation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api-client";

interface SecurePptViewerProps {
  programId: string;
  lessonId: string;
  title: string;
  fileName?: string;
}

interface TokenResponse {
  success: boolean;
  data?: { token: string; expiresIn: number; sessionId: string };
  error?: string;
}

interface PptSlide {
  index: number;
  html: string;
}
interface PptRenderResponse {
  slides: PptSlide[];
  width: number;
  height: number;
}

export function SecurePptViewer({
  programId,
  lessonId,
  title,
  fileName,
}: SecurePptViewerProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [slides, setSlides] = useState<PptSlide[]>([]);
  const [currentSlide, setCurrentSlide] = useState(1);
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const loadPpt = async () => {
    setLoading(true);
    setError(null);
    setSlides([]);
    setCurrentSlide(1);

    try {
      const json = await apiPost<TokenResponse["data"]>(
        "/api/stream/token",
        { programId, lessonId, kind: "ppt" }
      );
      if (!json.success || !json.data) {
        throw new Error(json.error ?? "Không tạo được session");
      }

      const res = await fetch(`/api/stream/${json.data.token}/ppt`);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Lỗi tải PPT: ${txt || res.statusText}`);
      }

      const data = (await res.json()) as PptRenderResponse;
      if (!data.slides || data.slides.length === 0) {
        throw new Error("File PPT không có slide nào");
      }
      setSlides(data.slides);
    } catch (e) {
      setError(
        `Không tải được PPT: ${e instanceof Error ? e.message : "unknown"}`
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPpt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || slides.length === 0) return;
    const onScroll = () => {
      const els = el.querySelectorAll<HTMLElement>(".ppt-slide");
      let visible = 1;
      const top = el.scrollTop;
      els.forEach((p, idx) => {
        if (p.offsetTop <= top + 50) visible = idx + 1;
      });
      setCurrentSlide(visible);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [slides.length]);

  const goToSlide = (n: number) => {
    const el = containerRef.current;
    if (!el) return;
    const target = el.querySelector<HTMLElement>(
      `.ppt-slide[data-slide="${n}"]`
    );
    if (target) {
      el.scrollTo({ top: target.offsetTop, behavior: "smooth" });
    }
  };

  const total = slides.length;

  return (
    <div className="space-y-2">
      <div className="relative h-[75vh] w-full overflow-hidden rounded-md border bg-muted/20">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Đang chuyển PPT sang HTML...
              </p>
            </div>
          </div>
        )}
        {error && slides.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <Alert variant="destructive" className="max-w-md">
              <AlertDescription className="text-xs">{error}</AlertDescription>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => void loadPpt()}
              >
                Thử lại
              </Button>
            </Alert>
          </div>
        )}
        {slides.length > 0 && (
          <div
            ref={containerRef}
            className="h-full w-full overflow-auto bg-muted/30 p-4"
          >
            <div
              style={{
                transform: `scale(${scale})`,
                transformOrigin: "top center",
              }}
            >
              <div
                dangerouslySetInnerHTML={{
                  __html: slides.map((s) => s.html).join(""),
                }}
              />
            </div>
          </div>
        )}
      </div>

      {slides.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background/60 p-2">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              disabled={currentSlide <= 1}
              onClick={() => goToSlide(Math.max(1, currentSlide - 1))}
              aria-label="Slide trước"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-sm tabular-nums">
              {currentSlide} / {total}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={currentSlide >= total}
              onClick={() => goToSlide(Math.min(total, currentSlide + 1))}
              aria-label="Slide sau"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)))}
              aria-label="Thu nhỏ"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="px-2 text-sm tabular-nums">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setScale((s) => Math.min(3, +(s + 0.25).toFixed(2)))}
              aria-label="Phóng to"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setScale(1)}
              aria-label="Đặt lại"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3 w-3" />
          <Presentation className="h-3 w-3" />
          PPT render sang HTML · URL S3 được ẩn hoàn toàn · Hỗ trợ .pptx
        </p>
      </div>

      {fileName && (
        <p className="text-xs text-muted-foreground">File: {fileName}</p>
      )}
    </div>
  );
}