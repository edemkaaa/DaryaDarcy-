"use client";
/** Компонент получает цвета через текущую тему вместо самостоятельной проверки пользовательских настроек. */
import {
  Colors,
  type ColorScheme,
  type ThemeColorPalette,
} from "@/shared/styles/theme";
import { useColorScheme } from "@/shared/styles/use-color-scheme";
/**
 * Returns the current theme's color palette.
 * Usage: const colors = useColors(); then colors.text, colors.background, etc.
 */
export function useColors(
  colorSchemeOverride?: ColorScheme,
): ThemeColorPalette {
  const colorSchema = useColorScheme();
  const scheme = (colorSchemeOverride ?? colorSchema ?? "light") as ColorScheme;
  return Colors[scheme];
}
