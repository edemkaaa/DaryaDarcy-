"use client";
/** Компонент получает цвета через текущую тему вместо самостоятельной проверки пользовательских настроек. */
import {
  Colors,
  type ColorScheme,
  type ThemeColorPalette,
} from "@/shared/styles/theme";
import { useColorScheme } from "@/shared/styles/use-color-scheme";
/** Явная схема вызова имеет приоритет над системной; результатом остаётся готовая палитра, а не изменение темы документа. */
export function useColors(
  colorSchemeOverride?: ColorScheme,
): ThemeColorPalette {
  const colorSchema = useColorScheme();
  const scheme = (colorSchemeOverride ?? colorSchema ?? "light") as ColorScheme;
  return Colors[scheme];
}
