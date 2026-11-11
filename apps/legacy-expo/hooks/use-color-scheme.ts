// Архив Expo. Читает выбранную схему из контекста темы старого приложения.
import { useThemeContext } from "@/lib/theme-provider";

export function useColorScheme() {
  // Читает выбранную схему из контекста темы старого приложения.

  return useThemeContext().colorScheme;
}
