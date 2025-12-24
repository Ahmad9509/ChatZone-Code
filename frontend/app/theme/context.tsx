"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type ThemeSetting = "light" | "dark" | "system";

type ThemeContextValue = {
  mode: ThemeSetting;
  resolvedMode: "light" | "dark";
  setMode: (mode: ThemeSetting) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "cz.theme";

function getSystemPreference(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(mode: "light" | "dark") {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", mode === "dark" ? "dark" : "light");
}

function readStoredSetting(): ThemeSetting {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeSetting | null;
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeSetting>(() => readStoredSetting());
  const [resolvedMode, setResolvedMode] = useState<"light" | "dark">(() =>
    mode === "system" ? getSystemPreference() : mode
  );

  const updateResolved = useCallback((setting: ThemeSetting) => {
    const nextResolved = setting === "system" ? getSystemPreference() : setting;
    setResolvedMode(nextResolved);
    applyTheme(nextResolved);
  }, []);

  const setMode = useCallback(
    (next: ThemeSetting) => {
      setModeState(next);
      if (typeof window !== "undefined") {
        if (next === "system") {
          window.localStorage.removeItem(STORAGE_KEY);
        } else {
          window.localStorage.setItem(STORAGE_KEY, next);
        }
      }
      updateResolved(next);
    },
    [updateResolved]
  );

  const toggle = useCallback(() => {
    const newMode = mode === "system" 
      ? (resolvedMode === "light" ? "dark" : "light")
      : (mode === "light" ? "dark" : "light");
    setMode(newMode);
  }, [mode, resolvedMode, setMode]);

  useEffect(() => {
    updateResolved(mode);
  }, [mode, updateResolved]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (event: MediaQueryListEvent) => {
      if (mode !== "system") return;
      const next = event.matches ? "dark" : "light";
      setResolvedMode(next);
      applyTheme(next);
    };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [mode]);

  const value = useMemo(
    () => ({ mode, resolvedMode, setMode, toggle }),
    [mode, resolvedMode, setMode, toggle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
