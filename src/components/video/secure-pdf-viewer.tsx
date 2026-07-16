"use client";

import { useState, useEffect, useRef } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, Loader2, Download } from "lucide-react";
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
  const [iframeLoading, setIframeLoading] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  const loadPdf = async () => {
    setLoading(true);
    setError(null);
    setIframeLoading(false);

    // Cleanup previous blob URL
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
      setIframeLoading(true);
    } catch (e) {
      setError(`Không tải được PDF: ${e instanceof Error ? e.message : "unknown"}`);
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
                onClick={() => void loadPdf()}
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
            <Button onClick={() => void loadPdf()}>Tải PDF</Button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3 w-3" />
          Blob streaming · URL S3 được ẩn hoàn toàn
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
