"use client";
/** Копию восстановительных данных скачиваем как текстовый файл по явному действию пользователя, не вставляя её в HTML. */
/** Временный текстовый Blob скачивается через скрытый anchor; URL отзывается с задержкой, чтобы браузер успел начать чтение. */
export function downloadText(text: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
