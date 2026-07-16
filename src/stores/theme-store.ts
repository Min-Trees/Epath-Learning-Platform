import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Theme } from "@/types";

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: "system",

      setTheme: (theme) => set({ theme }),

      toggleTheme: () => {
        const current = get().theme;
        const nextTheme =
          current === "light"
            ? "dark"
            : current === "dark"
              ? "system"
              : "light";
        set({ theme: nextTheme });
      },
    }),
    {
      name: "theme-storage",
    }
  )
);
