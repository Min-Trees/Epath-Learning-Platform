"use client";

import { ReactNode, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { useThemeStore } from "@/stores";
import { useBlockDevTools } from "@/hooks/use-block-devtools";

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
 * OPTIMIZATION v2 - Cải thiện performance:
 * - staleTime: 5 phút → trong 5 phút, các component mount lại sẽ thấy data ngay (không gọi API).
 *   Giảm đáng kể số lượng request khi user navigate qua lại giữa các trang.
 * - gcTime: 10 phút → cache tồn tại 10 phút sau khi không ai dùng.
 * - refetchOnWindowFocus: false → KHÔNG re-fetch khi user Alt+Tab qua lại.
 * - refetchOnMount: false → dùng cache trước, refresh ngầm nếu stale.
 * - retry: 2 → retry 2 lần khi lỗi mạng thay vì 1.
 * - retryDelay: exponential backoff với cap 10s thay vì 5s.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Tăng từ 30s lên 5 phút để giảm số request
      staleTime: 5 * 60 * 1000,
      // Tăng từ 5 phút lên 10 phút để giữ data lâu hơn
      gcTime: 10 * 60 * 1000,
      // Không refetch khi window focus để tránh request liên tục
      refetchOnWindowFocus: false,
      // Không refetch khi mount - dùng cached data trước
      refetchOnMount: false,
      // Retry 2 lần thay vì 1 để tăng khả năng thành công
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
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
      <DevToolsBlocker />
    </QueryClientProvider>
  );
}

function DevToolsBlocker() {
  useBlockDevTools();
  return null;
}
