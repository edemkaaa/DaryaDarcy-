import { asProdamusRecord } from "./prodamus-payload";
import { pickString } from "./prodamus-fields";

export type ProdamusCancellationProfile = Readonly<{
  domain: string;
  subscriptionId: string;
  profileId: string;
}>;

/** Field matching only; caller must authenticate the original notification. */
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
