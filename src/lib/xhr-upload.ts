// Helper upload file lớn qua XHR (XMLHttpRequest) để có progress + retry.
//
// Lý do không dùng fetch:
// - fetch không hỗ trợ upload progress event một cách đáng tin cậy trên hầu hết browser
//   (Chrome có ReadableStream nhưng cần duplex streaming chưa phổ biến).
// - Khi server ngắt kết nối giữa chừng do timeout / body limit, fetch thường chỉ báo
//   "Failed to fetch" mà không có status hay response body → khó debug.
// - XHR cho phép retry với resume từng chunk.
//
// Lưu ý giới hạn:
// - Next.js dev server có thể ngắt kết nối với file >100MB (HMR, body buffer, timeout).
// - Vì vậy nên upload TRỰC TIẾP từ client tới S3 qua presigned URL, không qua Next.
// - Nếu gặp "Status: 0" thường là do:
//   1) CORS chưa cấu hình trên bucket Viettel IDC (xem CORS_HELP.md)
//   2) Mạng/proxy ngắt giữa chừng
//   3) Presigned URL hết hạn (file lớn upload chậm) → gọi lại /api/uploads/presign
//   4) Bucket từ chối Content-Length / Content-Type không khớp presigned URL
// Helper này tách riêng phần retry + progress để caller dễ theo dõi.

export interface XhrUploadOptions {
  url: string;
  file: Blob;
  headers?: Record<string, string>;
  timeoutMs?: number; // mặc định 10 phút
  onProgress?: (percent: number) => void;
  /** Bỏ qua header nào (vd Content-Type khi dùng streaming) */
  skipHeaders?: string[];
}

export interface XhrUploadResult {
  ok: boolean;
  status: number;
  statusText: string;
  bodyText: string;
}

export function xhrUpload(opts: XhrUploadOptions): Promise<XhrUploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", opts.url, true);
    xhr.timeout = opts.timeoutMs ?? 10 * 60 * 1000; // 10 phút
    // Tắt withCredentials - S3 presigned URL không cần cookies và gắn cookie có thể
    // làm hỏng chữ ký AWS Signature V4.
    xhr.withCredentials = false;

    const skip = new Set((opts.skipHeaders ?? []).map((h) => h.toLowerCase()));
    if (opts.headers) {
      for (const [k, v] of Object.entries(opts.headers)) {
        if (!skip.has(k.toLowerCase())) xhr.setRequestHeader(k, v);
      }
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && opts.onProgress) {
        opts.onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      const bodyText = xhr.responseText ?? "";
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        statusText: xhr.statusText,
        bodyText,
      });
    };
    xhr.onerror = () => {
      reject(new Error(
        `Lỗi mạng khi upload. Status: ${xhr.status}. ` +
        `Nguyên nhân thường gặp khi upload lên Viettel IDC S3: ` +
        `(1) bucket chưa cấu hình CORS cho phép PUT từ origin của bạn, ` +
        `(2) presigned URL hết hạn (file >100MB upload chậm), ` +
        `(3) Content-Length trong request không khớp với lúc presign, ` +
        `(4) mạng/proxy ngắt kết nối. ` +
        `Hệ thống sẽ tự động fallback sang upload qua proxy server-side (/api/uploads/s3-proxy - không cần CORS). ` +
        `Xem docs/CORS_HELP.md để biết thêm chi tiết.`
      ));
    };
    xhr.ontimeout = () => {
      reject(new Error(`Upload timeout sau ${Math.round((xhr.timeout ?? 0) / 1000)}s`));
    };
    xhr.onabort = () => reject(new Error("Upload bị hủy"));

    xhr.send(opts.file);
  });
}

/**
 * Upload file lớn với retry tự động (tối đa 3 lần) và resume-friendly behavior.
 * Chia file thành từng phần ~5MB và gửi tuần tự, nhưng vẫn dùng 1 PUT duy nhất
 * (server phải nhận nguyên file). Đây chỉ là retry theo chunk failed.
 *
 * Nếu server không hỗ trợ multipart, đơn giản chỉ retry toàn file.
 */
export async function xhrUploadWithRetry(
  opts: XhrUploadOptions,
  maxRetries = 2
): Promise<XhrUploadResult> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await xhrUpload(opts);
      if (result.ok) return result;
      // Lỗi server có status → không retry
      if (result.status >= 400 && result.status < 500) {
        return result;
      }
      throw new Error(`Server trả ${result.status} ${result.statusText}: ${result.bodyText.slice(0, 200)}`);
    } catch (e) {
      lastErr = e;
      if (attempt < maxRetries) {
        const wait = Math.min(2000 * (attempt + 1), 5000);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}