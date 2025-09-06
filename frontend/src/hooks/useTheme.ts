import { useEffect, useMemo, useState } from "react";

export type ThemeMode = "system" | "light" | "dark";
const THEME_KEY = "theme";

export function useTheme() {
  const initialMode: ThemeMode = (() => {
    try {
      return (localStorage.getItem(THEME_KEY) as ThemeMode) || "system";
    } catch {
      return "system";
    }
  })();

  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const [sysDark, setSysDark] = useState<boolean>(() => {
    return typeof window !== "undefined" &&
      "matchMedia" in window &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !("matchMedia" in window)) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");

    const handler = (e: MediaQueryListEvent) => setSysDark(e.matches);

    // Modern API
    if ("addEventListener" in mq) {
      mq.addEventListener("change", handler);
    }
    // Legacy Safari
    else if ("addListener" in mq) {
      (mq as unknown as { addListener: (cb: (e: MediaQueryListEvent) => void) => void })
        .addListener(handler);
    }

    return () => {
      if ("removeEventListener" in mq) {
        mq.removeEventListener("change", handler);
      } else if ("removeListener" in mq) {
        (mq as unknown as { removeListener: (cb: (e: MediaQueryListEvent) => void) => void })
          .removeListener(handler);
      }
    };
  }, []);

  const isDark = useMemo(
    () => mode === "dark" || (mode === "system" && sysDark),
    [mode, sysDark]
  );

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", isDark);
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.setAttribute("content", isDark ? "dark light" : "light dark");
  }, [isDark]);

  const setTheme = (m: ThemeMode) => {
    setMode(m);
    try {
      localStorage.setItem(THEME_KEY, m);
    } catch {}
  };

  return { mode, isDark, setTheme };
}
