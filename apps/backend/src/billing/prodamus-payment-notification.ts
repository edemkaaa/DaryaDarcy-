import type { PaymentProof } from "./protocol";
import { isPaidStatus } from "./prodamus-fields";
import { readProdamusPayment } from "./prodamus-payment";
import { hasClubPaymentBinding } from "./prodamus-binding";
import { verifyProdamusSignature } from "./prodamus-signature";

export type ProdamusPaymentAcknowledgement =
  | { status: 200; body: "ignored" | "success" }
  | { status: 422; body: "payment binding invalid" };
export type ProdamusPaymentFulfilment = (
  orderId: string,
  details: {
    email: string | null;
    sum: string | null;
    userId?: number | null;
    proof: PaymentProof;
    recurring?: boolean;
  },
) => Promise<"club" | "shop" | null>;
export type ProdamusPaymentNotificationPorts = {
  clubConfiguration: (recurring: boolean) => {
    domain: string;
    subscriptionId: string;
    secret: string;
  };
  fulfil: ProdamusPaymentFulfilment;
};

/** Runs after ingress authentication/demo rejection; acknowledgement waits for settlement. */
export async function processProdamusPaymentNotification(
  body: Record<string, unknown>,
  signature: string,
  action: string,
  ports: ProdamusPaymentNotificationPorts,
): Promise<ProdamusPaymentAcknowledgement> {
  if (!isPaidStatus(body)) return { status: 200, body: "ignored" };
  const { email, userId, sum, orderId, proof } = readProdamusPayment(body);
  const recurring = action === "auto_payment";
  const isClub =
    recurring || orderId.startsWith("club-") || orderId.startsWith("club6m-");
  if (isClub) {
    const configured = ports.clubConfiguration(recurring);
    if (
      !hasClubPaymentBinding(proof, orderId, configured) ||
      !configured.secret ||
      !verifyProdamusSignature(body, signature, [configured.secret])
    )
      return { status: 422, body: "payment binding invalid" };
  }
  if (!recurring && !orderId) return { status: 200, body: "ignored" };
  const granted = recurring
    ? await ports.fulfil("club-renew", { email, sum, proof, recurring: true })
    : await ports.fulfil(orderId, { email: email || null, sum, userId, proof });
  return granted
    ? { status: 200, body: "success" }
    : { status: 422, body: "payment binding invalid" };
}
