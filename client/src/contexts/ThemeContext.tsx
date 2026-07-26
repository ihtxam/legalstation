import React, { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark";
export type TextSize = "sm" | "md" | "lg";

const THEME_KEY = "cliavo_theme";
const TEXT_SIZE_KEY = "cliavo_text_size";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  textSize: TextSize;
  setTextSize: (size: TextSize) => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function readStoredTheme(fallback: Theme): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY) || localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* ignore */
  }
  return fallback;
}

function readStoredTextSize(): TextSize {
  try {
    const stored = localStorage.getItem(TEXT_SIZE_KEY);
    if (stored === "sm" || stored === "md" || stored === "lg") return stored;
  } catch {
    /* ignore */
  }
  return "md";
}

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  /** @deprecated always switchable; kept for API compat */
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme(defaultTheme));
  const [textSize, setTextSizeState] = useState<TextSize>(() => readStoredTextSize());

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.textSize = textSize;
    try {
      localStorage.setItem(TEXT_SIZE_KEY, textSize);
    } catch {
      /* ignore */
    }
  }, [textSize]);

  const setTheme = (next: Theme) => setThemeState(next);
  const toggleTheme = () => setThemeState((prev) => (prev === "light" ? "dark" : "light"));
  const setTextSize = (size: TextSize) => setTextSizeState(size);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        textSize,
        setTextSize,
        switchable: true,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
