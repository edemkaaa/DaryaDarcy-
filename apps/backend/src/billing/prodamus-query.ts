/** Единое PHP-совместимое кодирование параметров для подписанных ссылок и запросов отмены. */
/** PHP-совместимое кодирование общее для подписанных ссылок и запросов отмены. */
export function buildProdamusQuery(data: Record<string, unknown>): string {
  const parts: string[] = [];
  /** Рекурсивно кодирует непустые значения в PHP bracket-ключи для объектов и индексированных массивов, сохраняя общий порядок обхода. */
  const append = (key: string, value: unknown) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => append(`${key}[${index}]`, item));
      return;
    }
    if (typeof value === "object") {
      for (const [nestedKey, nestedValue] of Object.entries(
        value as Record<string, unknown>,
      )) {
        append(`${key}[${nestedKey}]`, nestedValue);
      }
      return;
    }
    parts.push(`${encodeKey(key)}=${encodeURIComponent(String(value))}`);
  };
  for (const [key, value] of Object.entries(data)) append(key, value);
  return parts.join("&");
}

/** URL-кодирует ключ, оставляя квадратные скобки видимыми для совместимого PHP-разбора. */
function encodeKey(key: string): string {
  return encodeURIComponent(key).replace(/%5B/gi, "[").replace(/%5D/gi, "]");
}
