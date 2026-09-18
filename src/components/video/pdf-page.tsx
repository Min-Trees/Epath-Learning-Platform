"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";

interface PdfPageProps {
  blob: Blob;
  pageNumber: number;
  /** Zoom do user chọn (1 = 100%). Trên mobile sẽ nhân với fit-to-width scale. */
  scale: number;
  isMobile: boolean;
  onNumPagesDetected?: (n: number) => void;
}

/**
 * Render một trang PDF vào <canvas>.
 *
 * Tối ưu cho mobile:
 * - Dùng IntersectionObserver: chỉ render khi trang gần vào viewport (rootMargin 800px).
 * - Worker lấy từ file đi kèm trong node_modules/pdfjs-dist (luôn khớp version).
 * - Cleanup đúng cách khi unmount để giải phóng canvas + pdf document.
 * - **Fit-to-width**: trên mobile, đo width của container cha rồi dùng
 *   scale = containerWidth / pdfNativeWidth * userScale. Canvas bitmap
 *   khớp với CSS width → không bị trình duyệt co lại → text giữ nguyên
 *   kích thước đọc được. Đây chính là fix "PDF trên mobile quá nhỏ".
 */
export default function PdfPage({
  blob,
  pageNumber,
  scale,
  isMobile,
  onNumPagesDetected,
}: PdfPageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const pdfDocRef = useRef<unknown>(null);
  const [rendering, setRendering] = useState(false);
  const [inView, setInView] = useState(false);
  const [failed, setFailed] = useState(false);
  // Re-render khi window resize để fit-to-width cập nhật theo viewport mới
  const [containerWidth, setContainerWidth] = useState<number>(0);

  // Lắng nghe viewport: chỉ render khi gần vào màn hình
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true); // Fallback nếu không có IO
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setInView(true);
        }
      },
      { rootMargin: isMobile ? "800px 0px" : "400px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isMobile]);

  // Đo width container cha + lắng nghe resize để fit-to-width mobile hoạt động
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;
    const measure = () => {
      // Trừ padding p-4 (16px mỗi bên) của scroll container
      const w = parent.clientWidth - 32;
      setContainerWidth(w > 0 ? w : 0);
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [inView]);

  const renderPage = useCallback(async () => {
    if (!canvasRef.current || !inView) return;
    setRendering(true);
    setFailed(false);
    try {
      const pdfjsLib = await import("pdfjs-dist");

      // Worker đi kèm trong node_modules — luôn khớp version, không 404
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();
      }

      // Tải document 1 lần, cache theo blob (các trang dùng chung doc).
      // Dùng type pdfjs-dist thật — tránh xung đột khi tự định nghĩa.
      let doc = pdfDocRef.current as PDFDocumentProxy | null;
      if (!doc) {
        const arrayBuffer = await blob.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({
          data: arrayBuffer,
          disableAutoFetch: false,
          disableStream: false,
        });
        doc = await loadingTask.promise;
        pdfDocRef.current = doc;
        if (onNumPagesDetected) onNumPagesDetected(doc.numPages);
      }

      if (pageNumber > doc.numPages) {
        setFailed(true);
        return;
      }

      const page = await doc.getPage(pageNumber);

      // --- Fit-to-width cho mobile ---
      // Lấy native viewport (scale=1) để biết trang PDF rộng bao nhiêu CSS px
      const nativeViewport = page.getViewport({ scale: 1 });
      let effectiveScale: number;
      if (isMobile && containerWidth > 0) {
        // Scale để PDF vừa khít container width hiện tại
        const fitScale = containerWidth / nativeViewport.width;
        effectiveScale = fitScale * scale;
        // Giới hạn trên để canvas không vượt max canvas size mobile (~16MB)
        // viewport.width * dpr * viewport.height * dpr * 4 bytes ≤ ~16MB
        // → heuristic: scale ≤ 3 trên mobile là an toàn cho A4
        effectiveScale = Math.min(effectiveScale, 3);
      } else {
        // Desktop: giữ nguyên user scale, không cap 1.5 nữa
        effectiveScale = Math.min(scale, 3);
      }

      const viewport = page.getViewport({ scale: effectiveScale });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      // Style width = intrinsic CSS width của PDF → không bị trình duyệt
      // co lại theo parent width nữa (vì giờ đã tính sẵn cho vừa khít).
      // Vẫn giới hạn maxWidth:100% để chắc chắn không tràn khi xoay máy.
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      // Huỷ render trước đó nếu còn đang chạy
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch { /* ignore */ }
      }

      const renderTask = page.render({
        canvas,
        canvasContext: ctx,
        viewport,
      });
      renderTaskRef.current = renderTask;

      await renderTask.promise;
      renderTaskRef.current = null;

      // Overlay số trang (giữ nguyên UX cũ)
      const numPages = doc.numPages;
      const overlay = containerRef.current?.querySelector(
        ".pdf-page-num"
      ) as HTMLElement | null;
      if (overlay) overlay.textContent = `${pageNumber}/${numPages}`;
    } catch (e) {
      // Lỗi do huỷ render là bình thường khi đổi trang / unmount
      const msg = e instanceof Error ? e.message : String(e);
      if (/cancelled|abort/i.test(msg)) return;
      console.error(`[PdfPage ${pageNumber}] render error:`, msg);
      setFailed(true);
    } finally {
      setRendering(false);
    }
  }, [blob, pageNumber, scale, isMobile, inView, onNumPagesDetected, containerWidth]);

  // Render khi đủ điều kiện
  useEffect(() => {
    if (inView) {
      void renderPage();
    }
    return () => {
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch { /* ignore */ }
        renderTaskRef.current = null;
      }
    };
  }, [inView, renderPage]);

  // Cleanup document khi component cuối cùng trong viewer unmount
  useEffect(() => {
    return () => {
      const doc = pdfDocRef.current as { destroy?: () => Promise<void> | void } | null;
      if (doc?.destroy) {
        try {
          const result = doc.destroy();
          if (result && typeof (result as Promise<void>).then === "function") {
            void (result as Promise<void>);
          }
        } catch { /* ignore */ }
      }
      pdfDocRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%" }}
      data-page-number={pageNumber}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          maxWidth: "100%",
          height: "auto",
          userSelect: "none",
          // @ts-expect-error: vendor-prefix CSS không có trong CSSProperties
          WebkitUserDrag: "none",
        }}
        onContextMenu={(e) => e.preventDefault()}
      />
      {/* Watermark bảo mật — overlay nhẹ */}
      <div
        className="pdf-page-num"
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          background: "rgba(0,0,0,0.6)",
          color: "white",
          fontSize: 11,
          padding: "2px 8px",
          borderRadius: 4,
          pointerEvents: "none",
        }}
      >
        {pageNumber}
      </div>
      {rendering && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.6)",
          }}
        >
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {failed && !rendering && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.9)",
            color: "#b91c1c",
            fontSize: 12,
            padding: 8,
            textAlign: "center",
          }}
        >
          Không render được trang này
        </div>
      )}
    </div>
  );
}
