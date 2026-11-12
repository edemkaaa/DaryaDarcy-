"use client";
/** Приложение использует светлое оформление независимо от настроек ОС. */
/** Одинаковая схема до и после hydration доступна также экранам вне ThemeProvider. */
export function useColorScheme() {
  return "light" as const;
}
