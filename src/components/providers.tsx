"use client";

import { ReactNode, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { useThemeStore } from "@/stores";

/**
 * React Query Devtools — load bằng next/dynamic với ssr:false.
 *
 * Tại sao cần ssr:false:
 *   - Devtools dùng useQueryClient() bên trong component tree.
 *   - Trên server, QueryClient chỉ tồn tại trong QueryClientProvider, nhưng
 *     SSR render vẫn gặp component này trước khi Provider wire-up xong → throw.
 *   - `dynamic` với ssr:false đảm bảo component chỉ render ở client.
 *
 * Khi nào hiện:
 *   - Chỉ load ở dev mode (NODE_ENV !== 'production').
 *   - Ở production, next/dynamic sẽ skip import → không tăng bundle.
 */
const ReactQueryDevtools = dynamic(
  () =>
    import("@tanstack/react-query-devtools").then(
      (m) => m.ReactQueryDevtools
    ),
  { ssr: false }
);

/**
 * QueryClient cấu hình cho toàn app.
 *
 * Giải thích cấu hình:
 * - staleTime: 30s → trong 30s, các component mount lại sẽ thấy data ngay (không gọi Firestore).
 * - gcTime: 5 phút → cache tồn tại 5 phút sau khi không ai dùng (quay lại tab cũ thấy data ngay).
 * - refetchOnWindowFocus: false → KHÔNG re-fetch khi user Alt+Tab qua lại (giảm request).
 *   (User bấm "Tải lại" nếu muốn data mới nhất.)
 * - retry: 1 → chỉ retry 1 lần khi lỗi mạng (đỡ chờ).
 * - placeholderData: keepPreviousData ở hook → chuyển trang không flash loading.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false, // dùng cache trước, refresh ngầm nếu stale
      retry: 1,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    },
    mutations: {
      retry: 0,
    },
  },
});

function ThemeHandler({ children }: { children: ReactNode }) {
  const { theme } = useThemeStore();

  useEffect(() => {
    const root = window.document.documentElement;

    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    } else {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      if (mediaQuery.matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  }, [theme]);

  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  // Chỉ mount Devtools ở dev mode — ở production trả null, không tăng bundle.
  const showDevtools = process.env.NODE_ENV !== "production";

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <ThemeHandler>{children}</ThemeHandler>
        </TooltipProvider>
      </AuthProvider>
      {showDevtools && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  );
}
