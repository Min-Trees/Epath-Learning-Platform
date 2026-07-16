"use client";

import { useEffect, useState } from "react";

/**
 * Trả về giá trị sau khi debounce (ms).
 * Dùng cho input search để tránh filter mỗi keystroke.
 */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}