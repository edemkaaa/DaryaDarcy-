/** Ограничение текста применяется к содержимому редактора, чтобы счётчик и проверка перед сохранением считали одинаково. */
export const POST_TEXT_MAX_BYTES = 65_535;

export function assertPostTextSize(text: string): void {
  if (new TextEncoder().encode(text).byteLength > POST_TEXT_MAX_BYTES)
    throw new Error(
      "Текст поста превышает 65 535 байт UTF-8. Сократите текст; ваш ввод сохранён в черновике.",
    );
}
