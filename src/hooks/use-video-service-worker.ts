"use client";

import { useEffect, useCallback } from "react";

/**
 * Hook để quản lý Video Service Worker
 * 
 * Tính năng:
 * - Đăng ký service worker để cache video chunks
 * - Cleanup cache khi cần
 * - Cung cấp API để xóa cache của video cụ thể
 */
export function useVideoServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // Đăng ký service worker
    navigator.serviceWorker
      .register("/sw-video.js")
      .then((registration) => {
        console.log("[sw] Video service worker registered:", registration.scope);
      })
      .catch((error) => {
        console.error("[sw] Video service worker registration failed:", error);
      });

    // Yêu cầu service worker update khi có phiên bản mới
    const handleUpdate = () => {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage("skipWaiting");
      }
    };

    // Listen for controller change (new service worker activated)
    navigator.serviceWorker.addEventListener("controllerchange", handleUpdate);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleUpdate);
    };
  }, []);

  /**
   * Xóa cache của một video cụ thể
   */
  const clearVideoCache = useCallback((url: string) => {
    if (!navigator.serviceWorker.controller) return;
    
    navigator.serviceWorker.controller.postMessage({
      type: "CLEAR_VIDEO",
      url,
    });
  }, []);

  /**
   * Xóa toàn bộ video cache
   */
  const clearAllVideoCache = useCallback(() => {
    if (!navigator.serviceWorker.controller) return;
    
    navigator.serviceWorker.controller.postMessage({
      type: "CLEAR_ALL",
    });
  }, []);

  return {
    clearVideoCache,
    clearAllVideoCache,
  };
}
