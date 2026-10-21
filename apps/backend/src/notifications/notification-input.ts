import { z } from "zod";

// Expo supports framed opaque tokens and legacy UUID-shaped tokens. Do not
// mistake an assumed payload alphabet for the provider's format contract.
const framedExpoToken =
  /^(?:ExpoPushToken|ExponentPushToken)\[[^\s[\]\u0000-\u001f\u007f]+\]$/;
const legacyExpoToken =
  /^[a-z\d]{8}-[a-z\d]{4}-[a-z\d]{4}-[a-z\d]{4}-[a-z\d]{12}$/i;

// The existing transport sends Expo tokens, not arbitrary URLs/browser endpoints.
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
