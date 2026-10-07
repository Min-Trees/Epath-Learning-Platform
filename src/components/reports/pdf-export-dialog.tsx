"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  FileDown,
  Printer,
  Loader2,
  CheckCircle2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  downloadPdfFromHtml,
  printHtmlReport,
} from "@/lib/pdf-report-generator";

interface PdfExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  htmlContent: string;
  fileName: string;
}

export function PdfExportDialog({
  isOpen,
  onClose,
  title,
  subtitle,
  htmlContent,
  fileName,
}: PdfExportDialogProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Chế độ hiển thị: "fit" (tự động co vừa màn hình) hoặc "custom" (tỷ lệ thu phóng tùy chọn)
  const [viewMode, setViewMode] = useState<"fit" | "custom">("fit");
  const [customZoom, setCustomZoom] = useState<number>(1.0);

  // Kích thước đo lường
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState<number>(800);
  const [contentHeight, setContentHeight] = useState<number>(1120);

  // Đo chiều rộng khung nhìn (Viewport) để tự động co giãn khi resize hoặc đổi hướng màn hình mobile
  useEffect(() => {
    if (!isOpen) return;

    const measureViewport = () => {
      if (viewportRef.current) {
        const w = viewportRef.current.clientWidth;
        if (w > 0) {
          setViewportWidth(w);
        }
      }
    };

    // Đo lần đầu
    measureViewport();

    const resizeObserver = new ResizeObserver(() => {
      measureViewport();
    });

    if (viewportRef.current) {
      resizeObserver.observe(viewportRef.current);
    }

    window.addEventListener("resize", measureViewport);
    window.addEventListener("orientationchange", measureViewport);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", measureViewport);
      window.removeEventListener("orientationchange", measureViewport);
    };
  }, [isOpen]);

  // Đo chiều cao thực tế của tài liệu sau khi được nhúng HTML
  useEffect(() => {
    if (!isOpen) return;

    const measureContent = () => {
      if (contentRef.current) {
        const h = contentRef.current.offsetHeight || contentRef.current.scrollHeight;
        if (h > 0) {
          setContentHeight(h);
        }
      }
    };

    // Đo sau khi render
    const t = setTimeout(measureContent, 50);

    const resizeObserver = new ResizeObserver(() => {
      measureContent();
    });

    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }

    return () => {
      clearTimeout(t);
      resizeObserver.disconnect();
    };
  }, [htmlContent, isOpen]);

  // Tính toán tỷ lệ fit chuẩn cho màn hình hiện tại (chuẩn A4 cơ sở là 800px)
  // Trừ padding lề khoảng 16px - 24px để trang in đẹp và không dính sát mép
  const paddingX = viewportWidth < 640 ? 16 : 24;
  const availableWidth = Math.max(260, viewportWidth - paddingX);
  const fitScale = Math.min(1.0, Number((availableWidth / 800).toFixed(3)));

  // Tỷ lệ scale đang áp dụng
  const effectiveScale = viewMode === "fit" ? fitScale : customZoom;

  const handleZoomIn = () => {
    setViewMode("custom");
    setCustomZoom((prev) => Math.min(1.6, Number((prev + 0.15).toFixed(2))));
  };

  const handleZoomOut = () => {
    setViewMode("custom");
    setCustomZoom((prev) => Math.max(0.35, Number((prev - 0.15).toFixed(2))));
  };

  const handleFitScreen = () => {
    setViewMode("fit");
  };

  const handleResetOriginal = () => {
    setViewMode("custom");
    setCustomZoom(1.0);
  };

  const handleToggleZoom = () => {
    if (viewMode === "fit") {
      setViewMode("custom");
      setCustomZoom(1.0);
    } else {
      setViewMode("fit");
    }
  };

  const handleDownload = async () => {
    try {
      setIsExporting(true);
      setDownloadSuccess(false);
      await downloadPdfFromHtml(htmlContent, fileName);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error("Lỗi khi xuất PDF:", err);
      alert(
        "Đã xảy ra lỗi khi tạo file PDF. Vui lòng thử chức năng 'In / Lưu qua trình duyệt'."
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    printHtmlReport(htmlContent, title);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="fixed inset-0 sm:inset-auto sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] w-full h-full max-w-full max-h-[100dvh] sm:max-w-4xl sm:max-h-[92vh] sm:rounded-lg p-0 flex flex-col gap-0 border-0 sm:border bg-background shadow-2xl overflow-hidden"
      >
        {/* Header tối ưu cho cả Mobile & Desktop */}
        <DialogHeader className="p-3 sm:px-5 sm:py-3.5 border-b bg-card shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pr-8 sm:pr-0">
            <div className="min-w-0">
              <DialogTitle className="text-sm sm:text-base font-semibold flex items-center gap-2 truncate">
                <FileDown className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
                <span className="truncate">{title}</span>
              </DialogTitle>
              {subtitle && (
                <DialogDescription className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                  {subtitle}
                </DialogDescription>
              )}
            </div>

            {/* Các nút hành động chính */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                title="Mở hộp thoại in hoặc lưu PDF bằng trình duyệt"
                className="h-8 px-2.5 text-xs font-medium"
              >
                <Printer className="mr-1.5 h-3.5 w-3.5" />
                In / Lưu
              </Button>
              <Button
                size="sm"
                onClick={handleDownload}
                disabled={isExporting}
                className="h-8 px-3 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Đang tạo...
                  </>
                ) : downloadSuccess ? (
                  <>
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-green-300" />
                    Đã tải về!
                  </>
                ) : (
                  <>
                    <FileDown className="mr-1.5 h-3.5 w-3.5" />
                    Tải PDF
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Thanh công cụ xem trước & Thu phóng (Responsive Toolbar) */}
        <div className="px-3 py-1.5 sm:px-5 sm:py-2 bg-muted/60 border-b flex items-center justify-between gap-2 shrink-0 text-xs">
          <div className="flex items-center gap-1">
            <Button
              variant={viewMode === "fit" ? "secondary" : "ghost"}
              size="sm"
              onClick={handleFitScreen}
              className="h-7 px-2 text-[11px] sm:text-xs gap-1 font-medium"
              title="Tự động thu phóng vừa khít chiều ngang màn hình mobile"
            >
              <Maximize2 className="h-3 w-3" />
              <span>Vừa màn hình</span>
            </Button>

            <Button
              variant={viewMode === "custom" && customZoom === 1.0 ? "secondary" : "ghost"}
              size="sm"
              onClick={handleResetOriginal}
              className="h-7 px-2 text-[11px] sm:text-xs gap-1 font-medium"
              title="Kích thước thực 100%"
            >
              <RotateCcw className="h-3 w-3" />
              <span>100%</span>
            </Button>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomOut}
              disabled={effectiveScale <= 0.35}
              className="h-7 w-7 p-0"
              title="Thu nhỏ"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>

            <span className="min-w-[58px] text-center font-mono text-[11px] text-muted-foreground select-none">
              {Math.round(effectiveScale * 100)}%
              {viewMode === "fit" && <span className="text-[10px] text-primary ml-0.5">fit</span>}
            </span>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomIn}
              disabled={effectiveScale >= 1.6}
              className="h-7 w-7 p-0"
              title="Phóng to"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Khung cuộn xem trước báo cáo (Responsive Viewport) */}
        <div
          ref={viewportRef}
          className="flex-1 min-h-0 overflow-auto bg-slate-200/80 dark:bg-slate-950 p-2 sm:p-4 touch-pan-x touch-pan-y"
          style={{ overscrollBehavior: "contain" }}
        >
          {/* Spacer bọc ngoài có kích thước chuẩn xác theo tỷ lệ scale */}
          <div
            style={{
              width: `${Math.floor(800 * effectiveScale)}px`,
              height: `${Math.ceil(contentHeight * effectiveScale)}px`,
              position: "relative",
              margin: "0 auto",
              overflow: "hidden",
            }}
            className="bg-white text-slate-900 shadow-md rounded border border-slate-300 dark:border-slate-800 transition-all cursor-zoom-in"
            title="Nhấp đúp chuột hoặc chạm 2 lần để chuyển đổi phóng to / vừa màn hình"
            onDoubleClick={handleToggleZoom}
          >
            {/* Nội dung PDF gốc 800px được scale mượt mà */}
            <div
              ref={contentRef}
              style={{
                width: "800px",
                transform: `scale(${effectiveScale})`,
                transformOrigin: "top left",
                position: "absolute",
                left: 0,
                top: 0,
              }}
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-3 py-2 sm:px-5 sm:py-2.5 border-t bg-card text-[11px] text-muted-foreground shrink-0">
          <span className="truncate">
            * Định dạng chuẩn A4 tối ưu cho in ấn & lưu trữ hồ sơ.
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-7 px-2.5 text-xs shrink-0"
          >
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
