import type { Profile } from "./cancellation";
import { createProdamusSign } from "./prodamus-signature";
import { buildProdamusQuery } from "./prodamus-query";

export type ProdamusCancellationConfig = Readonly<{
  payformUrl: string;
  subscriptionId: string;
  secret: string;
  production: boolean;
}>;
export type ProdamusCancellationTarget = Pick<
  Profile,
  "domain" | "subscriptionId" | "profileId" | "manager"
>;

export async function cancelProdamusProfile(
  profile: ProdamusCancellationTarget,
  config: ProdamusCancellationConfig,
  send: typeof fetch,
): Promise<boolean> {
  const subId = profile.subscriptionId;
  const configured = new URL(config.payformUrl);
  if (
    !subId ||
    subId !== config.subscriptionId ||
    !config.secret ||
    !profile.profileId ||
    profile.domain !== configured.hostname
  )
    return false;
  if (
    configured.protocol !== "https:" &&
    !(
      !config.production &&
      ["127.0.0.1", "localhost"].includes(configured.hostname)
    )
  )
    return false;
  const data: Record<string, unknown> = {
    subscription: subId,
    profile: profile.profileId,
    [profile.manager ? "active_manager" : "active_user"]: "0",
  };
  data.signature = createProdamusSign(data, config.secret);
  const url = `${config.payformUrl}/rest/setActivity/`;
  try {
    const response = await send(url, {
      method: "POST",
      // Only the configured endpoint may receive or confirm this signed request.
      redirect: "error",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: buildProdamusQuery(data),
      signal: AbortSignal.timeout(10000),
    });
    const text = await response.text();
    return response.ok && text.trim() === "success";
  } catch {
    console.warn("[prodamus] setActivity failed");
    return false;
  }
}
