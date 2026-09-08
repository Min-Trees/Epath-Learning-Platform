"use client";

import { useCallback, useRef } from "react";

/**
 * Progressive video loading với Smart Buffer Strategy
 * 
 * Mục tiêu: Khi user tua đến giữa/cuối video thì không phải đợi buffer
 * 
 * Version 4 - Ưu tiên đơn giản và ổn định:
 * 1. Chỉ warm cache 1-2 chunk đầu thay vì 6-10 (giảm tải server)
 * 2. Không conflict với video element đang fetch
 * 3. Video element tự lo streaming tự nhiên
 * 
 * Cách hoạt động:
 * 1. Gán <video src={streamUrl}> trực tiếp — browser tự lo HTTP Range + buffer.
 * 2. NGAY SAU ĐÓ fetch 1-2 chunk đầu để warm HTTP cache (buffer đầu video).
 * 3. Khi user tua đến range nào, browser dùng lại cache → play ngay.
 * 
 * Tại sao warm HTTP cache work?
 * - Browser cache key = (URL, Range header).
 * - <video> element dùng CHUNG HTTP cache với fetch() (cùng UA, cùng URL).
 * - Khi browser yêu cầu Range X-Y cho <video>, nếu đã có trong cache → dùng luôn.
 */

interface PrefetchOptions {
  /** Số chunk song song để warm cache. Mặc định 2 (giảm từ 6). */
  parallelChunks?: number;
  /** Retry count for failed requests */
  retryCount?: number;
  /** Abort signal for cleanup */
  signal?: AbortSignal;
}

export interface PrefetchHandle {
  /** Gắn vào <video src={...}> */
  url: string;
  /** Cleanup: abort fetches đang chạy */
  cleanup: () => void;
}

const PARALLEL_DEFAULT = 2; // Giảm từ 6 xuống 2 để không overload server
const RETRY_COUNT = 2; // Giảm retry để không chờ lâu

// Dynamic chunk count dựa trên kích thước video - GIẢM ĐỂ KHÔNG OVERLOAD SERVER
function getOptimalChunkCount(totalBytes: number): number {
  const sizeMB = totalBytes / (1024 * 1024);
  // Chỉ warm 1-2 chunk đầu, không warm cả video
  if (sizeMB < 50) return 1;   // Video nhỏ: 1 chunk
  if (sizeMB < 200) return 2; // Video vừa: 2 chunks
  return 3;                    // Video lớn: 3 chunks (tối đa)
}

interface RangeChunk {
  start: number;
  end: number;
  priority: number; // 0 = highest
}

/**
 * Lấy Content-Length từ HEAD request
 */
async function fetchRangeHead(
  url: string,
  signal: AbortSignal
): Promise<{ totalBytes: number } | null> {
  try {
    const res = await fetch(url, {
      headers: { Range: "bytes=0-0" },
      signal,
      credentials: "same-origin",
    });
    if (!res.ok && res.status !== 206) return null;
    const cr = res.headers.get("Content-Range");
    if (!cr) return null;
    const m = /\/(\d+)$/.exec(cr);
    if (!m) return null;
    const total = Number(m[1]);
    if (!total || total < 2) return null;
    return { totalBytes: total };
  } catch {
    return null;
  }
}

/**
 * Chia totalBytes thành N chunk (chỉ lấy đầu video để warm cache)
 * Không lấy hết video vì:
 * 1. Video element đã tự fetch các range cần thiết
 * 2. Warm cache chỉ cần buffer đầu video
 */
function buildSmartChunks(totalBytes: number): RangeChunk[] {
  const chunkCount = getOptimalChunkCount(totalBytes);
  const chunks: RangeChunk[] = [];
  const chunkSize = Math.ceil(totalBytes / chunkCount);
  
  // Chỉ lấy chunk đầu tiên (buffer ~10% đầu video)
  // Video element sẽ tự fetch phần còn lại
  for (let i = 0; i < Math.min(chunkCount, 2); i++) { // Tối đa 2 chunks
    const start = i * chunkSize;
    const end = i === Math.min(chunkCount, 2) - 1 
      ? totalBytes - 1 
      : (i + 1) * chunkSize - 1;
    chunks.push({ start, end, priority: i }); // Chunk đầu tiên có priority cao nhất
  }
  
  return chunks;
}

/**
 * Fetch một range với exponential backoff retry
 */
async function fetchRangeWithRetry(
  url: string,
  chunk: RangeChunk,
  signal: AbortSignal,
  retries: number
): Promise<void> {
  const headers = { Range: `bytes=${chunk.start}-${chunk.end}` };
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Exponential backoff: 100ms, 200ms, 400ms
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, 100 * Math.pow(2, attempt - 1)));
      }
      
      const res = await fetch(url, {
        headers,
        signal,
        credentials: "same-origin",
        cache: "force-cache",
      });
      
      if (res.ok || res.status === 206 || res.status === 200) {
        // Success - consume the body to complete the request
        await res.blob().catch(() => {});
        return;
      }
    } catch (e) {
      if (signal.aborted) throw e;
      // Continue to retry
    }
  }
}

export function usePrefetchVideo() {
  const abortRef = useRef<AbortController | null>(null);
  const startInFlightRef = useRef(false);
  const prefetchedRef = useRef<Set<string>>(new Set());

  const start = useCallback(
    async (streamUrl: string, opts: PrefetchOptions = {}): Promise<PrefetchHandle> => {
      if (startInFlightRef.current) {
        // Đã start rồi, không làm gì thêm — trả về URL gốc để caller dùng tiếp
        return {
          url: streamUrl,
          cleanup: () => {},
        };
      }
      startInFlightRef.current = true;
      const releaseLock = () => {
        startInFlightRef.current = false;
      };

      const parallel = Math.max(1, opts.parallelChunks ?? PARALLEL_DEFAULT);
      const retries = opts.retryCount ?? RETRY_COUNT;
      const signal = opts.signal ?? abortRef.current?.signal ?? new AbortController().signal;

      try {
        // 1. Lấy Content-Length (với timeout)
        const headPromise = fetchRangeHead(streamUrl, signal);
        const timeoutPromise = new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error("HEAD timeout")), 3000)
        );
        
        let headInfo: { totalBytes: number } | null = null;
        try {
          headInfo = await Promise.race([headPromise, timeoutPromise]);
        } catch {
          // Timeout or error - try without size info
          headInfo = null;
        }
        
        if (!headInfo) {
          // Không lấy được size → trả URL gốc, không warm cache
          releaseLock();
          return { url: streamUrl, cleanup: () => {} };
        }

        // 3. Setup abort controller cho các fetches
        const abort = new AbortController();
        abortRef.current?.abort();
        abortRef.current = abort;

        // 4. Chia chunks - chỉ lấy 1-2 chunk đầu
        const chunks = buildSmartChunks(headInfo.totalBytes);
        
        // 5. Đợi 500ms để video element bắt đầu load trước
        // Sau đó warm cache với 1 chunk (không parallel nhiều)
        await new Promise(r => setTimeout(r, 500));
        
        if (abort.signal.aborted) {
          releaseLock();
          return { url: streamUrl, cleanup: () => {} };
        }
        
        // Fetch chunks one by one (sequential, not parallel)
        // Để video element fetch chính không bị conflict
        for (const chunk of chunks) {
          if (abort.signal.aborted) break;
          await fetchRangeWithRetry(streamUrl, chunk, abort.signal, retries)
            .catch(() => {}); // Ignore errors - warm cache fail không ảnh hưởng playback
        }

        releaseLock();
        return {
          url: streamUrl,
          cleanup: () => {
            abort.abort();
          },
        };
      } catch (err) {
        releaseLock();
        throw err;
      }
    },
    []
  );

  return start;
}
