/** Путь возврата ограничиваем внутренним адресом сайта, исключая сетевой URL и управляющие символы. */
export function safeNextPath(
  value: string | string[] | undefined,
): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (
    !raw ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    /[\\\u0000-\u001f]/.test(raw)
  )
    return null;
  return raw;
}
