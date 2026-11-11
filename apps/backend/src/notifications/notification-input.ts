/** Валидирует поддерживаемые Expo-токены и версии согласий, не принимая произвольные адреса доставки. */
import { z } from "zod";

// Expo поддерживает обёрнутые opaque-токены и старую UUID-форму.
// Предположение об алфавите payload не заменяет контракт формата провайдера.
const framedExpoToken =
  /^(?:ExpoPushToken|ExponentPushToken)\[[^\s[\]\u0000-\u001f\u007f]+\]$/;
const legacyExpoToken =
  /^[a-z\d]{8}-[a-z\d]{4}-[a-z\d]{4}-[a-z\d]{4}-[a-z\d]{12}$/i;

// Транспорт работает с Expo-токенами, а не произвольными URL или browser endpoints.
export const registerTokenInput = z.object({
  token: z
    .string()
    .max(256)
    .refine(
      (value) =>
        value === value.trim() &&
        (framedExpoToken.test(value) || legacyExpoToken.test(value)),
      "Некорректный push-токен",
    ),
  platform: z
    .string()
    .max(16)
    .refine(
      (value) => ["ios", "android", "web"].includes(value),
      "Неизвестная платформа",
    )
    .optional(),
});

export const setMarketingConsentInput = z.object({
  enabled: z.boolean(),
  platform: z.string().optional(),
});

export type RegisterTokenInput = z.output<typeof registerTokenInput>;
export type SetMarketingConsentInput = z.output<
  typeof setMarketingConsentInput
>;
