// Helper upload file với 3 chế độ: direct-s3, proxy, local-fallback.
//
// Ưu tiên mặc định khi S3 đã cấu hình: PROXY (PUT qua Next.js → S3 qua aws-sdk).
// Lý do: bypass CORS hoàn toàn, không cần cấu hình bucket. Phù hợp với
// user chưa cấu hình CORS trên Viettel IDC S3.
//
// Các chế độ:
//   - "direct-s3": PUT tới presigned URL của S3 (nhanh nhất, cần CORS).
//   - "proxy":     PUT qua /api/uploads/s3-proxy (bypass CORS, chậm hơn ~10%).
//   - "local-fallback": PUT tới /api/uploads/local-receive (chỉ dev).
//
// Helper này tự chọn chế độ dựa trên response presign + flag forceMode.

import { xhrUploadWithRetry, XhrUploadResult } from "./xhr-upload";

export interface UploadTarget {
  uploadUrl: string;
  fileKey: string;
  expiresIn: number;
  localFallback: boolean;
  proxyUrl: string | null;
}

export interface PerformUploadOptions {
  target: UploadTarget;
  file: Blob;
  contentType: string;
  /** Bỏ qua — chỉ dùng cho test/debug */
  forceMode?: "direct-s3" | "proxy" | "local-fallback";
  /** Khi direct-s3 thất bại, có tự động fallback sang proxy không. Mặc định true. */
  fallbackToProxy?: boolean;
  onProgress?: (percent: number) => void;
  /** Bearer token cho Authorization header (chỉ cần cho local-fallback và proxy) */
  authToken?: string;
}

export interface PerformUploadResult {
  ok: boolean;
  status: number;
  bodyText: string;
  mode: "direct-s3" | "proxy" | "local-fallback";
}

export async function performUpload(
  opts: PerformUploadOptions
): Promise<PerformUploadResult> {
  const { target, file, contentType, forceMode, fallbackToProxy = true, onProgress, authToken } = opts;

  // Quyết định mode
  let mode: "direct-s3" | "proxy" | "local-fallback";
  if (forceMode) {
    mode = forceMode;
  } else if (target.localFallback) {
    mode = "local-fallback";
  } else if (target.proxyUrl) {
    mode = "proxy";
  } else {
    mode = "direct-s3";
  }

  // Chuẩn bị URL + headers theo mode
  let url: string;
  const headers: Record<string, string> = { "Content-Type": contentType };

  switch (mode) {
    case "direct-s3":
      url = target.uploadUrl;
      // Không gắn Authorization cho S3 (URL đã có chữ ký).
      break;
    case "proxy":
      url = target.proxyUrl!;
      if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
      break;
    case "local-fallback":
      url = target.uploadUrl;
      if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
      break;
  }

  try {
    const result: XhrUploadResult = await xhrUploadWithRetry({
      url,
      file,
      headers,
      onProgress,
      timeoutMs: 60 * 60 * 1000, // 1 giờ cho file lớn
    });

    // Nếu direct-s3 thất bại (CORS/network/timeout) → fallback sang proxy.
    if (
      !result.ok &&
      mode === "direct-s3" &&
      fallbackToProxy &&
      target.proxyUrl
    ) {
      console.warn(
        "[upload] direct-s3 thất bại, fallback sang proxy. Status:",
        result.status
      );
      return performUpload({
        ...opts,
        forceMode: "proxy",
        fallbackToProxy: false, // không lặp vô hạn
      });
    }

    return { ...result, mode };
  } catch (e) {
    // Lỗi mạng → fallback sang proxy
    if (mode === "direct-s3" && fallbackToProxy && target.proxyUrl) {
      console.warn("[upload] direct-s3 lỗi mạng, fallback sang proxy:", e);
      return performUpload({
        ...opts,
        forceMode: "proxy",
        fallbackToProxy: false,
      });
    }
    throw e;
  }
}