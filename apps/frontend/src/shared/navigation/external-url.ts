/** Адреса действий проверяем перед открытием: строка ссылки не должна становиться исполняемой браузерной схемой. */
import { safeNextPath } from "./paths";

/** Link destinations are data, never executable browser URLs. */
export function safeExternalUrl(value: unknown): string | null {
  if (typeof value !== "string" || /[\u0000-\u001f\u007f]/.test(value))
    return null;
  const internal = safeNextPath(value.trim());
  if (internal) return internal;
  try {
    const url = new URL(value.trim());
    if (
      !["https:", "http:", "mailto:", "tel:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

export function requirePaymentUrl(value: unknown): string {
  const url = safeExternalUrl(value);
  if (!url || !url.startsWith("https://"))
    throw new Error("Не удалось открыть оплату: получен некорректный адрес.");
  return url;
}
