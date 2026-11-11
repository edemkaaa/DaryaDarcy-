/** Форматирование российского номера отделено от проверки владения телефоном. */
/** Russian mobile numbers as 11 digits: 79XXXXXXXXX */

/** Удаляем символы форматирования, возвращая только десятичные цифры без проверки допустимости номера. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Приводим российский номер к принятому формату; владение телефоном здесь не подтверждается. */
export function normalizeRuPhone(input: string): string | null {
  let digits = digitsOnly(input);
  if (digits.startsWith("8") && digits.length === 11) {
    digits = `7${digits.slice(1)}`;
  }
  if (digits.length === 10 && digits.startsWith("9")) {
    digits = `7${digits}`;
  }
  if (/^79\d{9}$/.test(digits)) return digits;
  return null;
}

/** Форматируем уже переданный номер для отображения. */
export function formatRuPhone(phone: string): string {
  const digits = digitsOnly(phone);
  if (digits.length === 11 && digits.startsWith("7")) {
    return `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  }
  return phone;
}

/** Поддерживаем ввод номера, сохраняя принятую нормализацию интерфейса. */
export function formatPhoneInput(input: string): string {
  const digits = digitsOnly(input);
  let rest = digits;
  if (rest.startsWith("8") && rest.length >= 1) rest = `7${rest.slice(1)}`;
  if (rest.startsWith("7")) rest = rest.slice(1);
  rest = rest.slice(0, 10);
  if (rest.length <= 3) return rest;
  if (rest.length <= 6) return `${rest.slice(0, 3)} ${rest.slice(3)}`;
  if (rest.length <= 8) return `${rest.slice(0, 3)} ${rest.slice(3, 6)}-${rest.slice(6)}`;
  return `${rest.slice(0, 3)} ${rest.slice(3, 6)}-${rest.slice(6, 8)}-${rest.slice(8)}`;
}
