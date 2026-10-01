/** Current version of marketing push consent text (bump when legal copy changes). */
export const MARKETING_PUSH_CONSENT_VERSION = "2026-08-1";

export const MARKETING_PUSH_CONSENT_LABEL =
  "Получать новости, новые публикации, акции и предложения DARYADARCY";

export type PushConsentType = "service" | "marketing";
export type PushConsentStatus = "granted" | "revoked";
