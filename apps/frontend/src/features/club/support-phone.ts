/** Подпись контактного телефона поддержки формируется отдельно от номера, который покупатель вводит при оплате. */
import { z } from "zod";

/** Форматируем введённые цифры под российский номер, ограничивая видимую часть десятью цифрами после кода страны. */
export function formatSupportPhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (/^[78]/.test(digits)) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  let formatted = "+7";
  if (digits.length) formatted += ` (${digits.slice(0, 3)}`;
  if (digits.length >= 3) formatted += ")";
  if (digits.length > 3) formatted += ` ${digits.slice(3, 6)}`;
  if (digits.length > 6) formatted += `-${digits.slice(6, 8)}`;
  if (digits.length > 8) formatted += `-${digits.slice(8, 10)}`;
  return formatted;
}

/** Пустое значение остаётся отсутствующим; непустое принимаем только в российском формате и приводим к +7 без разделителей. Обязательность контакта новой покупки проверяется отдельным purchase-контрактом. */
export const supportPhoneInput = z
  .string()
  .trim()
  .max(40, "Укажите корректный номер телефона.")
  .refine(
    (value) =>
      !value ||
      (/^\+?[\d\s().-]+$/.test(value) &&
        /^7\d{10}$/.test(value.replace(/\D/g, ""))),
    "Укажите корректный номер телефона.",
  )
  .transform((value) => (value ? `+${value.replace(/\D/g, "")}` : undefined))
  .optional();
