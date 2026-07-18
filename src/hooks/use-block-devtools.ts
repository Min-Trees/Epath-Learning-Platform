"use client";

import { useEffect } from "react";

/**
 * Chặn các phím tắt mở DevTools + view source + save.
 * KHÔNG thể chặn DevTools 100% trên web (user luôn có thể dùng menu trình duyệt),
 * nhưng chặn được các phím tắt phổ biến và raise bar cho người dùng phổ thông.
 *
 * Phím tắt bị chặn:
 *  - F12
 *  - Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C (Inspect)
 *  - Ctrl+U (View Source)
 *  - Ctrl+S (Save Page)
 *  - Ctrl+P (Print — có thể lộ nội dung)
 *  - Ctrl+Shift+P (Command Palette in DevTools)
 *
 * Phát hiện DevTools đang mở (heuristic theo window size) → dispatch event
 * `app:devtools-opened` / `app:devtools-closed` để component khác pause video.
 */
export function useBlockDevTools(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const isEditableTarget = (target: EventTarget | null): boolean => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      return (
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.isContentEditable === true
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // F12
      if (e.code === "F12") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;

      const key = e.key.toLowerCase();

      // Ctrl+Shift+I/J/C/P
      if (e.shiftKey) {
        if (key === "i" || key === "j" || key === "c" || key === "p") {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      // Ctrl+U / Ctrl+S / Ctrl+P — bỏ qua khi đang gõ trong input
      if (key === "u" || key === "s" || key === "p") {
        if (!isEditableTarget(e.target)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      if (!isEditableTarget(e.target)) {
        e.preventDefault();
      }
    };

    // Heuristic phát hiện DevTools mở: chênh lệch outer vs inner > 160px
    let devtoolsOpen = false;
    const threshold = 160;
    const checkDevTools = () => {
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      const isOpen = widthDiff > threshold || heightDiff > threshold;
      if (isOpen && !devtoolsOpen) {
        devtoolsOpen = true;
        window.dispatchEvent(new CustomEvent("app:devtools-opened"));
      } else if (!isOpen && devtoolsOpen) {
        devtoolsOpen = false;
        window.dispatchEvent(new CustomEvent("app:devtools-closed"));
      }
    };
    const interval = window.setInterval(checkDevTools, 1000);

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("contextmenu", onContextMenu, true);

    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("contextmenu", onContextMenu, true);
      window.clearInterval(interval);
    };
  }, [enabled]);
}