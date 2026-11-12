"use client";
/** Компонент получает цвета через текущую тему вместо самостоятельной проверки пользовательских настроек. */
import { Colors, type ThemeColorPalette } from "@/shared/styles/theme";
import { useColorScheme } from "@/shared/styles/use-color-scheme";
/** Возвращаем палитру единой схемы приложения без независимого выбора тёмных цветов. */
export function useColors(): ThemeColorPalette {
  return Colors[useColorScheme()];
}
