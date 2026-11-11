/** Значение Retry-After приводим к целой задержке для интерфейса, учитывая обе формы HTTP-заголовка. Не принимаем сокращённые форматы даты JavaScript. */
/** Принимаем целые секунды или HTTP-date GMT и возвращаем положительную задержку без переполнения вычисляемого timestamp. */
export function parseRetryAfter(
  value: string | null,
  now = Date.now(),
): number | undefined {
  if (!value) return undefined;
  const text = value.trim();
  const seconds = /^\d+$/.test(text)
    ? Number(text)
    : /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), .+ GMT$/.test(text)
      ? Math.ceil((Date.parse(text) - now) / 1000)
      : NaN;
  return Number.isSafeInteger(seconds) &&
    seconds > 0 &&
    Number.isSafeInteger(now + seconds * 1000)
    ? seconds
    : undefined;
}
