// Архив Expo. Выбирает палитру по явному override либо текущей схеме с light fallback.
import { Colors, type ColorScheme, type ThemeColorPalette } from "@/constants/theme";
import { useColorScheme } from "./use-color-scheme";

/**
 * Returns the current theme's color palette.
 * Usage: const colors = useColors(); then colors.text, colors.background, etc.
 */
export function useColors(colorSchemeOverride?: ColorScheme): ThemeColorPalette {
  // Выбирает палитру по явному override либо текущей схеме с light fallback.

  const colorSchema = useColorScheme();
  const scheme = (colorSchemeOverride ?? colorSchema ?? "light") as ColorScheme;
  return Colors[scheme];
}
