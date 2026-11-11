"use client";
/** Контекст темы связывает выбранную схему с общими цветами компонентов; не меняет настройки оформления клуба на сервере. */
import classes from "./theme-provider.module.scss";

import { useSystemColorScheme } from "@/shared/browser/viewport";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { SchemeColors, type ColorScheme } from "@/shared/styles/theme";
type ThemeContextValue = {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
};
const ThemeContext = createContext<ThemeContextValue | null>(null);
/** Контекст хранит выбранную схему и синхронизирует её с CSS-переменными; изменение оформления клуба к этому состоянию не относится. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme() ?? "light";
  const [colorScheme, setColorSchemeState] =
    useState<ColorScheme>(systemScheme);
  /** Набор токенов, data-theme и dark-класс применяются вместе к корню документа, чтобы CSS и React читали одну выбранную схему. */
  const applyScheme = useCallback((scheme: ColorScheme) => {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.dataset.theme = scheme;
      root.classList.toggle("dark", scheme === "dark");
      const palette = SchemeColors[scheme];
      Object.entries(palette).forEach(([token, value]) => {
        root.style.setProperty(`--color-${token}`, value);
      });
    }
  }, []);
  /** Явный выбор сначала обновляет React-состояние и сразу применяет соответствующие DOM-токены. */
  const setColorScheme = useCallback(
    (scheme: ColorScheme) => {
      setColorSchemeState(scheme);
      applyScheme(scheme);
    },
    [applyScheme],
  );
  useEffect(() => {
    applyScheme(colorScheme);
  }, [applyScheme, colorScheme]);
  const value = useMemo(
    () => ({
      colorScheme,
      setColorScheme,
    }),
    [colorScheme, setColorScheme],
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
