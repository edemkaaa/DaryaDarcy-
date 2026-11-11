/** Периодическое обновление относится к активным экранам контента; операции оплаты и получения закрытых файлов используют собственный жизненный цикл. */
export const CONTENT_REFRESH_INTERVAL_MS = 60_000;

/** Opt in only content reads; retained screens disable their observers on exit.
 * React Query pauses polling in hidden documents/offline and keeps confirmed
 * data while a background request runs. Payments/downloads/playback use their
 * own access and request lifecycles, never this periodic refresh.
 */
export function contentRefreshOptions(active: boolean) {
  return {
    enabled: active,
    refetchInterval: active ? CONTENT_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: active,
    refetchOnReconnect: active,
  } as const;
}
