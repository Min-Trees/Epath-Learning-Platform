"use client";

import { useCallback, useRef } from "react";

/**
 * Progressive video loading (đơn giản, không MediaSource).
 *
 * Mục tiêu: khi user tua đến giữa/cuối video thì không phải đợi buffer.
 *
 * Cách hoạt động:
 * 1. Gán <video src={streamUrl}> trực tiếp — browser tự lo HTTP Range + buffer.
 * 2. NGAY SAU ĐÓ fetch parallel 3 range (0-25%, 25-50%, 50-75%, 75-100%)
 *    qua fetch() thuần → warm HTTP cache.
 * 3. Khi user tua đến range nào, browser dùng lại cache → play ngay.
 *
 * Tại sao warm HTTP cache work?
 * - Browser cache key = (URL, Range header).
 * - <video> element dùng CHUNG HTTP cache với fetch() (cùng UA, cùng URL).
 * - Khi browser yêu cầu Range X-Y cho <video>, nếu đã có trong cache → dùng luôn.
 *
 * Lưu ý quan trọng: Mỗi range được chia theo tỉ lệ PHẦN TRĂM, không theo byte tuyệt đối.
 * Vì khi warm HTTP cache, browser sẽ map range tương đối theo byte khi video element
 * request. Để chính xác, ta dùng byte thật (lấy từ Content-Length của HEAD request).
 */

interface PrefetchOptions {
  /** Số chunk song song để warm cache. Mặc định 3. */
  parallelChunks?: number;
}

export interface PrefetchHandle {
  /** Gắn vào <video src={...}> */
  url: string;
  /** Cleanup: abort fetches đang chạy */
  cleanup: () => void;
}

const PARALLEL_DEFAULT = 3;

interface RangeChunk {
  start: number;
  end: number;
}

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
 * Chia totalBytes thành N chunk đều nhau. Chunk đầu bắt đầu từ byte 0.
 */
function buildChunks(totalBytes: number, chunkCount: number): RangeChunk[] {
  const chunks: RangeChunk[] = [];
  const baseSize = Math.floor(totalBytes / chunkCount);
  for (let i = 0; i < chunkCount; i++) {
    const start = i * baseSize;
    const end = i === chunkCount - 1 ? totalBytes - 1 : (i + 1) * baseSize - 1;
    chunks.push({ start, end });
  }
  return chunks;
}

export function usePrefetchVideo() {
  const abortRef = useRef<AbortController | null>(null);
  const startInFlightRef = useRef(false);

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

      try {
        // 1. Lấy Content-Length
        const headInfo = await fetchRangeHead(streamUrl, abortRef.current?.signal ?? new AbortController().signal);
        if (!headInfo) {
          // Không lấy được size → trả URL gốc, không warm cache
          releaseLock();
          return { url: streamUrl, cleanup: () => {} };
        }

        // 2. Chia chunks và fetch song song (warm HTTP cache)
        const abort = new AbortController();
        abortRef.current?.abort();
        abortRef.current = abort;

        const chunks = buildChunks(headInfo.totalBytes, parallel);
        chunks.forEach((c) => {
          // Fire-and-forget: chỉ warm cache, không cần result
          fetch(streamUrl, {
            headers: { Range: `bytes=${c.start}-${c.end}` },
            signal: abort.signal,
            credentials: "same-origin",
            cache: "force-cache",
          }).catch(() => {
            // ignore — warm cache fail không ảnh hưởng playback
          });
        });

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
