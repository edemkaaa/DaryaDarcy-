/** Проверяем происхождение старого объекта перед переносом в закрытое хранилище. */
const root = "https://s3.twcstorage.ru/daryadarcy-s3/";

/** Exact old bucket only. Retain the DB string; decode each key segment exactly once. */
/** Принимаем только исходный точный бакет и разрешённые старые каталоги, декодируем каждый сегмент один раз и исключаем traversal, приватные пути и параметры; строка БД остаётся исходной. */
export function legacySource(
  raw: string,
): { key: string; requestUrl: string } | undefined {
  try {
    if (!raw.startsWith(root) || raw.length > 8192) return;
    const url = new URL(raw);
    if (url.search || url.hash || url.username || url.password) return;
    const parts = raw.slice(root.length).split("/").map(decodeURIComponent);
    if (
      parts.some(
        (part) =>
          !part ||
          part === "." ||
          part === ".." ||
          /[\/\\\x00-\x1f\x7f]/.test(part),
      )
    )
      return;
    const key = parts.join("/");
    if (
      !/^(feed|articles|club\/tg)\//.test(key) ||
      key.includes("private-v1") ||
      Buffer.byteLength(key) > 1024 ||
      decodeURIComponent(url.pathname.slice("/daryadarcy-s3/".length)) !== key
    )
      return;
    return { key, requestUrl: url.href };
  } catch {
    return;
  }
}
