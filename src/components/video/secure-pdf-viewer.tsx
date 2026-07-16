"use client";

import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api-client";

/**
 * SecurePdfViewer - hiển thị PDF qua session token.
 *
 * Client gọi /api/stream/token?kind=pdf để lấy JWT, sau đó dùng
 * token đó để fetch PDF qua /api/stream/[token]/file. Server verify
 * token + quyền user → stream PDF từ R2 (private).
 *
 * Lưu ý: Token được đặt vào URL, không phải header Authorization, để
 * <iframe src="..."> có thể load trực tiếp. Browser sẽ không hiển thị
 * URL gốc R2. Người dùng có thể copy URL nhưng chỉ dùng được trong
 * 10 phút và bị ràng buộc user/lesson.
 */

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
  const [iframeLoading, setIframeLoading] = useState(false);

  const loadPdf = async () => {
    setLoading(true);
    setError(null);
    setIframeLoading(false);
    try {
      const json = await apiPost<TokenResponse["data"]>(
        "/api/stream/token",
        { programId, lessonId, kind: "pdf" }
      );
      if (!json.success || !json.data) {
        throw new Error(json.error ?? "Không tạo được session");
      }
      setPdfUrl(`/api/stream/${json.data.token}/file`);
      setIframeLoading(true);
    } catch (e) {
      setError(`Không tải được PDF: ${e instanceof Error ? e.message : "unknown"}`);
      setPdfUrl(null);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load PDF when component mounts
  useEffect(() => {
    loadPdf();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDownload = () => {
    if (!pdfUrl) return;
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-2">
      <div className="relative h-[70vh] w-full overflow-hidden rounded-md border bg-muted/20">
        {(loading || iframeLoading) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Đang tải PDF...</p>
            </div>
          </div>
        )}
        {error && !pdfUrl && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <Alert variant="destructive" className="max-w-md">
              <AlertDescription className="text-xs">{error}</AlertDescription>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={loadPdf}
              >
                Thử lại
              </Button>
            </Alert>
          </div>
        )}
        {pdfUrl && (
          <iframe
            src={pdfUrl}
            className="h-full w-full"
            title={title}
            onLoad={() => setIframeLoading(false)}
            onError={() => {
              setIframeLoading(false);
              setError("Không hiển thị được PDF");
            }}
          />
        )}
        {!pdfUrl && !error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Button onClick={loadPdf}>Tải PDF</Button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3 w-3" />
          PDF stream qua session token · không URL trực tiếp tới R2.
        </p>
        {pdfUrl && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
          >
            <Download className="mr-1 h-3 w-3" />
            Mở tab mới
          </Button>
        )}
      </div>

      {fileName && (
        <p className="text-xs text-muted-foreground">File: {fileName}</p>
      )}
    </div>
  );
}
