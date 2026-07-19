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
  } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api-client";

interface SecurePdfViewerProps {
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

export function SecurePdfViewer({
  programId,
  lessonId,
  title,
  fileName,
}: SecurePdfViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pagesHtml, setPagesHtml] = useState<string[]>([]);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.25);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const loadPdf = async () => {
    setLoading(true);
    setError(null);
    setPagesHtml([]);
    setNumPages(0);
    setCurrentPage(1);

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
      setPdfUrl(null);
    }

    try {
      const json = await apiPost<TokenResponse["data"]>(
        "/api/stream/token",
        { programId, lessonId, kind: "pdf" }
      );
      if (!json.success || !json.data) {
        throw new Error(json.error ?? "Không tạo được session");
      }

      // Fetch PDF blob through server (hides S3 URL)
      const pdfRes = await fetch(`/api/stream/${json.data.token}/file`);
      if (!pdfRes.ok) {
        const errText = await pdfRes.text();
        throw new Error(`Lỗi tải PDF: ${errText}`);
      }

      const blob = await pdfRes.blob();
      const objectUrl = URL.createObjectURL(blob);
      objectUrlRef.current = objectUrl;
      setPdfUrl(objectUrl);

      // Render PDF thành HTML bằng pdfjs-dist (Mozilla pdf.js).
      // Worker bundle lấy qua CDN để tránh vấn đề bundling với Next.js.
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/" +
        pdfjsLib.version +
        "/pdf.worker.min.mjs";

      const arrayBuffer = await blob.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      setNumPages(pdf.numPages);

      const rendered: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) continue;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvas, canvasContext: context, viewport }).promise;

        const dataUrl = canvas.toDataURL("image/png");
        const textContent = await page.getTextContent();
        const textItems = textContent.items
          .map((item: { str?: string } | unknown) => {
            if (item && typeof item === "object" && "str" in item) {
              return (item as { str?: string }).str ?? "";
            }
            return "";
          })
          .join(" ");

        rendered.push(`
          <div class="pdf-page" data-page="${i}" style="position:relative;width:${viewport.width}px;height:${viewport.height}px;margin:0 auto 16px;background:white;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            <img src="${dataUrl}" alt="page ${i}" style="width:100%;height:100%;display:block;user-select:none;-webkit-user-drag:none;pointer-events:none;" draggable="false"/>
            <div class="pdf-text-layer" style="position:absolute;inset:0;overflow:hidden;opacity:0.0001;pointer-events:auto;" aria-hidden="true">${escapeHtml(textItems)}</div>
            <div style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.6);color:white;font-size:11px;padding:2px 8px;border-radius:4px;">${i}/${pdf.numPages}</div>
          </div>
        `);
      }
      setPagesHtml(rendered);
    } catch (e) {
      setError(
        `Không tải được PDF: ${e instanceof Error ? e.message : "unknown"}`
      );
      setPdfUrl(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPdf();
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theo dõi trang hiện tại dựa vào scroll position
  useEffect(() => {
    const el = containerRef.current;
    if (!el || pagesHtml.length === 0) return;
    const onScroll = () => {
      const pageEls = el.querySelectorAll<HTMLElement>(".pdf-page");
      let visible = 1;
      const top = el.scrollTop;
      pageEls.forEach((p, idx) => {
        if (p.offsetTop <= top + 50) visible = idx + 1;
      });
      setCurrentPage(visible);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [pagesHtml.length]);

  const goToPage = (p: number) => {
    const el = containerRef.current;
    if (!el) return;
    const target = el.querySelector<HTMLElement>(
      `.pdf-page[data-page="${p}"]`
    );
    if (target) {
      el.scrollTo({ top: target.offsetTop, behavior: "smooth" });
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative h-[75vh] w-full overflow-hidden rounded-md border bg-muted/20">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Đang chuyển PDF sang HTML...
              </p>
            </div>
          </div>
        )}
        {error && pagesHtml.length === 0 && (
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
        {pagesHtml.length > 0 && (
          <div
            ref={containerRef}
            className="h-full w-full overflow-auto bg-muted/30 p-4"
          >
            <div dangerouslySetInnerHTML={{ __html: pagesHtml.join("") }} />
          </div>
        )}
        {!pdfUrl && !error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Button onClick={() => void loadPdf()}>Tải PDF</Button>
          </div>
        )}
      </div>

      {/* Toolbar */}
      {pagesHtml.length > 0 && (
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
              onClick={() => setScale(1.25)}
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
          PDF render sang HTML · URL S3 được ẩn hoàn toàn
        </p>
      </div>

      {fileName && (
        <p className="text-xs text-muted-foreground">File: {fileName}</p>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
