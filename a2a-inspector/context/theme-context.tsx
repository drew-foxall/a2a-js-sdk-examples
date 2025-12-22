"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ThemeMode } from "@/types/inspector";

interface ThemeContextValue {
  /** Current theme mode setting */
  mode: ThemeMode;
  /** Resolved theme (light or dark) */
  resolvedTheme: "light" | "dark";
  /** Set theme mode */
  setMode: (mode: ThemeMode) => void;
  /** Toggle between light and dark */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "a2a-inspector-theme";

/**
 * Valid theme mode values.
 */
const THEME_MODE_VALUES: readonly ThemeMode[] = ["light", "dark", "system"] as const;

/**
 * Type guard to check if a value is a valid ThemeMode.
 */
function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === "string" && THEME_MODE_VALUES.includes(value as ThemeMode);
}

/**
 * Theme context provider with system preference detection and persistence.
 */
export function ThemeProvider({ children }: { readonly children: ReactNode }): React.JSX.Element {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  // Load saved preference on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isThemeMode(saved)) {
      setModeState(saved);
    }
    setMounted(true);
  }, []);

  // Resolve theme based on mode and system preference
  useEffect(() => {
    if (!mounted) return;

    const updateResolvedTheme = (): void => {
      if (mode === "system") {
        const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        setResolvedTheme(systemPrefersDark ? "dark" : "light");
      } else {
        setResolvedTheme(mode);
      }
    };

    updateResolvedTheme();

    // Listen for system preference changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (): void => {
      if (mode === "system") {
        updateResolvedTheme();
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [mode, mounted]);

  // Apply theme to document
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
  }, [resolvedTheme, mounted]);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
  }, []);

  const toggle = useCallback(() => {
    setMode(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setMode]);

  const value = useMemo(
    () => ({
      mode,
      resolvedTheme,
      setMode,
      toggle,
    }),
    [mode, resolvedTheme, setMode, toggle]
  );

  // Prevent flash of incorrect theme
  if (!mounted) {
    return (
      <ThemeContext.Provider
        value={{ mode: "system", resolvedTheme: "dark", setMode: () => {}, toggle: () => {} }}
      >
        {children}
      </ThemeContext.Provider>
    );
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Hook to access theme context.
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
