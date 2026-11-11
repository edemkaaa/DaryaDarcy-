/** Периодическое обновление относится к активным экранам контента; операции оплаты и получения закрытых файлов используют собственный жизненный цикл. */
export const CONTENT_REFRESH_INTERVAL_MS = 60_000;

/** Возвращаем opt-in настройки периодического чтения контента; активность управляет interval и возобновлением, без фонового опроса скрытого документа. Оплата, скачивание и воспроизведение используют собственные правила жизненного цикла. */
export function contentRefreshOptions(active: boolean) {
  return {
    enabled: active,
    refetchInterval: active ? CONTENT_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: active,
    refetchOnReconnect: active,
  } as const;
}
