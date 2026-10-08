/** PHP-style query encoding shared by signed links and cancellation requests. */
export function buildProdamusQuery(data: Record<string, unknown>): string {
  const parts: string[] = [];
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

function encodeKey(key: string): string {
  return encodeURIComponent(key).replace(/%5B/gi, "[").replace(/%5D/gi, "]");
}
