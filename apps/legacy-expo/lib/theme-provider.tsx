// Архив Expo. Согласует RN Appearance, NativeWind и DOM-переменные старой темы.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, View, useColorScheme as useSystemColorScheme } from "react-native";
import { colorScheme as nativewindColorScheme, vars } from "nativewind";

import { SchemeColors, type ColorScheme } from "@/constants/theme";

type ThemeContextValue = {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Согласует RN Appearance, NativeWind и DOM-переменные старой темы.

  const systemScheme = useSystemColorScheme() ?? "light";
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(systemScheme);

  const applyScheme = useCallback((scheme: ColorScheme) => {
    // Применяет одну схему одновременно к native теме и web root/CSS-токенам.

    nativewindColorScheme.set(scheme);
    Appearance.setColorScheme?.(scheme);
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

  const setColorScheme = useCallback((scheme: ColorScheme) => {
    // Меняет состояние и немедленно применяет выбранную схему.

    setColorSchemeState(scheme);
    applyScheme(scheme);
  }, [applyScheme]);

  useEffect(() => {
    // Повторно применяет схему при изменении состояния или обработчика применения.

    applyScheme(colorScheme);
  }, [applyScheme, colorScheme]);

  const themeVariables = useMemo(
    () =>
      /* Строит NativeWind vars для текущей палитры контейнера. */ vars({
        "color-primary": SchemeColors[colorScheme].primary,
        "color-background": SchemeColors[colorScheme].background,
        "color-surface": SchemeColors[colorScheme].surface,
        "color-foreground": SchemeColors[colorScheme].foreground,
        "color-muted": SchemeColors[colorScheme].muted,
        "color-border": SchemeColors[colorScheme].border,
        "color-success": SchemeColors[colorScheme].success,
        "color-warning": SchemeColors[colorScheme].warning,
        "color-error": SchemeColors[colorScheme].error,
      }),
    [colorScheme],
  );

  const value = useMemo(
    () => /* Мемоизирует схему и setter для потребителей контекста. */ ({
      colorScheme,
      setColorScheme,
    }),
    [colorScheme, setColorScheme],
  );
  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1 }, themeVariables]}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  // Требует ThemeProvider и возвращает его схему без отдельного системного listener.

  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeContext must be used within ThemeProvider");
  }
  return ctx;
}
