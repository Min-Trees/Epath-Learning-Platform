"use client";

import { useEffect } from "react";

/**
 * Hook chặn phím tắt mở Developer Tools
 * - F12
 * - Ctrl+Shift+I (Chrome DevTools)
 * - Ctrl+Shift+J (Console)
 * - Ctrl+Shift+C (Elements)
 * - Ctrl+U (View source)
 */
export function useBlockDevTools() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const blockedKeys = [
        "F12",
        "F12",
        "u",
        "U",
      ];
      
      // Chặn F12
      if (e.key === "F12") {
        e.preventDefault();
        return;
      }

      // Chặn Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
      if (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key)) {
        e.preventDefault();
        return;
      }

      // Chặn Ctrl+U (View source)
      if (e.ctrlKey && e.key.toLowerCase() === "u") {
        e.preventDefault();
        return;
      }

      // Chặn Ctrl+Shift+K (Firefox Web Console)
      if (e.ctrlKey && e.shiftKey && e.key === "K") {
        e.preventDefault();
        return;
      }
    };

    const contextMenuHandler = (e: MouseEvent) => {
      e.preventDefault();
    };

    document.addEventListener("keydown", handler);
    document.addEventListener("contextmenu", contextMenuHandler);

    return () => {
      document.removeEventListener("keydown", handler);
      document.removeEventListener("contextmenu", contextMenuHandler);
    };
  }, []);
}
