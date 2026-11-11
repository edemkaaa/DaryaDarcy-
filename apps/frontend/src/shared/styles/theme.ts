"use client";
/** Общий экспорт темы сохраняет единый способ получения цветовых токенов на экранах. */
/**
 * Thin re-exports so consumers don't need to know about internal theme plumbing.
 * Full implementation lives in lib/_core/theme.ts.
 */
export {
  Colors,
  Fonts,
  SchemeColors,
  ThemeColors,
  type ColorScheme,
  type ThemeColorPalette,
} from "@/shared/styles/theme-core";
