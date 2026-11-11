/** История уже показанных изображений управляет повторным появлением в интерфейсе; это не HTTP-кеш содержимого файла. */
// Only successful display identities, never image bytes or access decisions.
// Windowed rows can remount after scrolling: replaying their fade is distracting
// even when the browser already has the photo. Bound this memory on long feeds.
const displayed = new Set<string>();
const DISPLAY_HISTORY_LIMIT = 256;

/** Проверяем успешный показ и освежаем LRU-порядок; отсутствие ключа не означает отсутствие файла в HTTP-кеше. */
export function wasImageDisplayed(key: string): boolean {
  if (!displayed.has(key)) return false;
  displayed.delete(key);
  displayed.add(key);
  return true;
}

/** Запоминаем только идентичность успешно показанного изображения и вытесняем самый старый ключ сверх лимита. */
export function rememberImageDisplay(key: string) {
  displayed.delete(key);
  displayed.add(key);
  if (displayed.size > DISPLAY_HISTORY_LIMIT)
    displayed.delete(displayed.values().next().value!);
}
