/** Разбирает идентификаторы отменяемого профиля без самостоятельной аутентификации webhook. */
import { asProdamusRecord } from "./prodamus-payload";
import { pickString } from "./prodamus-fields";

export type ProdamusCancellationProfile = Readonly<{
  domain: string;
  subscriptionId: string;
  profileId: string;
}>;

/** Только сопоставление полей; исходное уведомление аутентифицирует вызывающая граница. */
/** Извлекает вложенные subscription/profile идентификаторы лишь при точном совпадении configured domain и subscription; подпись проверяет вызывающая граница. */
export function readProdamusCancellationProfile(
  body: Record<string, unknown>,
  configured: Readonly<{ domain: string; subscriptionId: string }>,
): ProdamusCancellationProfile | null {
  const subscription = asProdamusRecord(body.subscription);
  const domain = pickString(body, ["domain"]).toLowerCase();
  if (domain !== configured.domain) return null;
  const subscriptionId = pickString(subscription, ["id"]);
  if (subscriptionId !== configured.subscriptionId) return null;
  const profileId = pickString(subscription, ["profile_id"]);
  if (!profileId) return null;
  return { domain, subscriptionId, profileId };
}
