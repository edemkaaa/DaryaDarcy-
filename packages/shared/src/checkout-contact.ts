/** Номер для связи нормализуется без подтверждения и не становится способом входа. */
import { z } from "zod";

/** Contact only: no ownership, login, SMS or provider side effects. */
/** Нормализуем контакт без доказательства владения: международный номер с плюсом либо российские 7/8 приводим к +digits; никаких SMS, входа или уникальности аккаунта это не создаёт. */
export function normalizeContactPhone(input: string): string | null {
  const value = input.trim();
  if (value.length > 40 || !/^\+?[\d ()-]+$/.test(value)) return null;
  let digits = value.replace(/\D/g, "");
  if (!value.startsWith("+")) {
    if (/^8\d{10}$/.test(digits)) digits = `7${digits.slice(1)}`;
    else if (!/^7\d{10}$/.test(digits)) return null;
  }
  return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
}
export const contactPhoneSchema = z
  .string()
  .max(40)
  .transform(normalizeContactPhone)
  .refine(
    (value): value is string => value !== null,
    "Укажите номер телефона с кодом страны, например +7 999 123-45-67.",
  );
