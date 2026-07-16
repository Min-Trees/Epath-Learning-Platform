"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

/**
 * Prefetch data khi user hover/focus vào link.
 * Dùng với Next.js Link: <Link prefetch={false} onMouseEnter={() => prefetch(...)}>
 *
 * Đặc biệt hữu ích cho route /admin/* nặng — khi user hover menu, fetch data
 * sẵn → khi click không cần chờ loading.
 *
 * NOTE: chỉ prefetch nếu data chưa có trong cache (React Query tự check).
 */
export function usePrefetch() {
  const qc = useQueryClient();
  return useCallback(
    (key: readonly unknown[]) => {
      const state = qc.getQueryState(key);
      // Bỏ qua nếu đang fetch hoặc đã có data fresh (< 30s)
      if (!state || (state.isFetching === false && state.dataUpdateCount === 0)) {
        qc.prefetchQuery({
          queryKey: key as unknown[],
          queryFn: () => Promise.reject(new Error("prefetch placeholder")),
          staleTime: 30 * 1000,
        });
      }
    },
    [qc]
  );
}