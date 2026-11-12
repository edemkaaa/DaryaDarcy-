"use client";
/** Светлая схема документа согласована с цветами компонентов и не зависит от сезонного оформления клуба. */
import classes from "./theme-provider.module.scss";

import { useColorScheme } from "./use-color-scheme";
import { createContext, useContext, useEffect, useMemo } from "react";
import { SchemeColors, type ColorScheme } from "@/shared/styles/theme";
type ThemeContextValue = {
  colorScheme: ColorScheme;
};
const ThemeContext = createContext<ThemeContextValue | null>(null);
/** CSS-токены и контекст используют ту же светлую схему, что и useColors. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme();
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = colorScheme;
    root.classList.remove("dark");
    Object.entries(SchemeColors[colorScheme]).forEach(([token, value]) => {
      root.style.setProperty(`--color-${token}`, value);
    });
  }, [colorScheme]);
  const value = useMemo(
    () => ({
      colorScheme,
    }),
    [colorScheme],
  );
  return (
    <ThemeContext.Provider value={value}>
      <div className={["ui-stack ", classes.div].filter(Boolean).join(" ")}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
/** Вне провайдера выдаём явную ошибку конфигурации дерева вместо выдуманной темы. */
export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeContext must be used within ThemeProvider");
  }
  return ctx;
}
