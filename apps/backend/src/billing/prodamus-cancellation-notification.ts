import {
  readProdamusCancellationProfile,
  type ProdamusCancellationProfile,
} from "./prodamus-cancellation";
import { verifyProdamusSignature } from "./prodamus-signature";

export type ProdamusCancellationAcknowledgement =
  | { status: 200; body: "cancelled" }
  | { status: 422; body: "profile binding invalid" };
export type ProdamusCancellationNotificationPorts = {
  secret: () => string;
  binding: () => { domain: string; subscriptionId: string };
  confirm: (profile: ProdamusCancellationProfile) => Promise<boolean>;
};

/** Runs after authenticated ingress selects a cancellation action; waits for durable confirmation. */
export async function processProdamusCancellationNotification(
  body: Record<string, unknown>,
  signature: string,
  ports: ProdamusCancellationNotificationPorts,
): Promise<ProdamusCancellationAcknowledgement> {
  const key = ports.secret();
  // Preserve key rejection before evaluating potentially invalid merchant configuration.
  if (!key || !verifyProdamusSignature(body, signature, [key]))
    return { status: 422, body: "profile binding invalid" };
  const profile = readProdamusCancellationProfile(body, ports.binding());
  if (!profile) return { status: 422, body: "profile binding invalid" };
  const confirmed = await ports.confirm(profile);
  return confirmed
    ? { status: 200, body: "cancelled" }
    : { status: 422, body: "profile binding invalid" };
}
