"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api-client";

interface SecurePdfViewerProps {
  programId: string;
  lessonId: string;
  title: string;
  fileName?: string;
  onComplete?: () => void; // Callback khi đã cuộn đến cuối PDF
}

interface TokenResponse {
  success: boolean;
  data?: { token: string; expiresIn: number; sessionId: string };
  error?: string;
}

// Detect mobile để chọn chiến lược render phù hợp
const IS_MOBILE =
  typeof window !== "undefined" &&
  /Android|iPhone|iPad|iPod|Opera Mini/i.test(
    window.navigator?.userAgent ?? ""
  );

// Component render một trang PDF cụ thể vào canvas.
// Được tách ra và load qua next/dynamic để tránh import pdfjs-dist
// trên server (pdfjs-dist yêu cầu DOM/Canvas ở main thread).
const PdfPage = dynamic(() => import("./pdf-page"), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 items-center justify-center bg-white">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ),
});

export function SecurePdfViewer({
  programId,
  lessonId,
  title,
  fileName,
  onComplete,
}: SecurePdfViewerProps) {
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const hasCompletedRef = useRef(false);

  // Bước 1: Lấy token + tải PDF về Blob (không render).
  // Chỉ blob, không canvas → nhẹ, mobile chịu được.
  const loadPdf = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNumPages(0);
    setCurrentPage(1);
    hasCompletedRef.current = false;

    try {
      const json = await apiPost<TokenResponse["data"]>(
        "/api/stream/token",
        { programId, lessonId, kind: "pdf" }
      );
      if (!json.success || !json.data) {
        throw new Error(json.error ?? "Không tạo được session");
      }

      const pdfRes = await fetch(`/api/stream/${json.data.token}/file`);
      if (!pdfRes.ok) {
        const errText = await pdfRes.text();
        throw new Error(`Lỗi tải PDF: ${errText}`);
      }

      const blob = await pdfRes.blob();
      if (blob.size === 0) {
        throw new Error("File PDF rỗng");
      }
      setPdfBlob(blob);

      // Đếm số trang bằng cách đọc nhẹ header PDF (không render canvas).
      // Nếu lỗi thì fallback render trang 1 để biết numPages.
      try {
        const count = await countPdfPages(blob);
        setNumPages(count);
      } catch {
        // Không đếm được → để PdfPage tự set khi render
        setNumPages(0);
      }
    } catch (e) {
      setError(
        `Không tải được PDF: ${e instanceof Error ? e.message : "unknown"}`
      );
    } finally {
      setLoading(false);
    }
  }, [programId, lessonId]);

  useEffect(() => {
    void loadPdf();
  }, [loadPdf]);

  // Theo dõi scroll để cập nhật currentPage + trigger onComplete
  useEffect(() => {
    const el = containerRef.current;
    if (!el || numPages === 0) return;
    const onScroll = () => {
      const top = el.scrollTop;
      let visible = 1;
      pageRefs.current.forEach((node, pageNum) => {
        if (node.offsetTop <= top + 100) visible = pageNum;
      });
      setCurrentPage(visible);

      if (!hasCompletedRef.current && onComplete) {
        const lastPageEl = pageRefs.current.get(numPages);
        if (lastPageEl) {
          const lastPageBottom =
            lastPageEl.offsetTop + lastPageEl.offsetHeight;
          if (top + el.clientHeight >= lastPageBottom - 100) {
            hasCompletedRef.current = true;
            onComplete();
          }
        }
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [numPages, onComplete]);

  const goToPage = (p: number) => {
    const el = containerRef.current;
    const target = pageRefs.current.get(p);
    if (el && target) {
      el.scrollTo({ top: target.offsetTop - 16, behavior: "smooth" });
    }
  };

  return (
    <div className="space-y-2 overflow-hidden">
      <div className="relative h-[75vh] w-full overflow-hidden rounded-md border bg-muted/20">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Đang tải PDF...</p>
            </div>
          </div>
        )}
        {error && !pdfBlob && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <Alert variant="destructive" className="max-w-md">
              <AlertDescription className="text-xs">{error}</AlertDescription>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => void loadPdf()}
              >
                Thử lại
              </Button>
            </Alert>
          </div>
        )}
        {pdfBlob && (
          <div
            ref={containerRef}
            className="h-full w-full overflow-auto bg-muted/30 p-4"
          >
            {numPages > 0 ? (
              <div style={{ minWidth: 0, maxWidth: "100%" }}>
                {Array.from({ length: numPages }, (_, i) => i + 1).map(
                  (pageNum) => (
                    <div
                      key={pageNum}
                      ref={(el) => {
                        if (el) pageRefs.current.set(pageNum, el);
                        else pageRefs.current.delete(pageNum);
                      }}
                      className="pdf-page"
                      data-page={pageNum}
                      style={{
                        margin: "0 auto 16px",
                        background: "white",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                        maxWidth: "100%",
                        boxSizing: "border-box",
                      }}
                    >
                      <PdfPage
                        blob={pdfBlob}
                        pageNumber={pageNum}
                        scale={scale}
                        isMobile={IS_MOBILE}
                        onNumPagesDetected={setNumPages}
                      />
                    </div>
                  )
                )}
              </div>
            ) : (
              // Chưa đếm được numPages → render trang 1 để xác định
              <div
                ref={(el) => {
                  if (el) pageRefs.current.set(1, el);
                  else pageRefs.current.delete(1);
                }}
                className="pdf-page"
                data-page={1}
                style={{
                  margin: "0 auto 16px",
                  background: "white",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  maxWidth: "100%",
                  boxSizing: "border-box",
                }}
              >
                <PdfPage
                  blob={pdfBlob}
                  pageNumber={1}
                  scale={scale}
                  isMobile={IS_MOBILE}
                  onNumPagesDetected={setNumPages}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toolbar */}
      {pdfBlob && !error && numPages > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background/60 p-2">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage <= 1}
              onClick={() => goToPage(Math.max(1, currentPage - 1))}
              aria-label="Trang trước"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-sm tabular-nums">
              {currentPage} / {numPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage >= numPages}
              onClick={() => goToPage(Math.min(numPages, currentPage + 1))}
              aria-label="Trang sau"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)))
              }
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
              onClick={() =>
                setScale((s) => Math.min(3, +(s + 0.25).toFixed(2)))
              }
              aria-label="Phóng to"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setScale(1.25)}
              aria-label="Đặt lại"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Đếm số trang PDF bằng cách parse nhẹ trailer của file PDF.
 * Tránh phải load toàn bộ PDF qua pdfjs chỉ để biết numPages.
 * Nếu parse fail, sẽ trả về 0 và PdfPage sẽ tự cập nhật khi render trang đầu.
 */
async function countPdfPages(blob: Blob): Promise<number> {
  try {
    const buf = await blob.slice(0, Math.min(blob.size, 1024 * 1024)).arrayBuffer();
    const bytes = new Uint8Array(buf);
    const decoder = new TextDecoder("latin1");
    const text = decoder.decode(bytes);
    // Tìm /N trong trailer: <<.../N 12 >>
    const match = text.match(/\/N\s+(\d+)\s*>>/);
    if (match) return parseInt(match[1], 10);
    // Fallback: đếm /Type /Page (không /Pages)
    const pageMatches = text.match(/\/Type\s*\/Page(?!s)/g);
    if (pageMatches) return pageMatches.length;
    return 0;
  } catch {
    return 0;
  }
}
