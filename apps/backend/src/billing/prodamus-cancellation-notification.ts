/** После проверки входа ждёт долговечной записи подтверждения отмены перед успешным ответом. */
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

/** После аутентификации ingress ждёт долговечного подтверждения выбранной операции отмены. */
/** Сначала проверяет подпись обычным cancellation-key, затем точную merchant/profile-привязку и ждёт durable confirm; только подтверждённый профиль даёт 200. */
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
