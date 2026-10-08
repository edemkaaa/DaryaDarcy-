import type { PaymentProof } from "./protocol";
import { pickOrderId, pickString, pickUserId } from "./prodamus-fields";
import { asProdamusRecord } from "./prodamus-payload";

export type ProdamusPaymentFields = {
  orderId: string;
  email: string;
  userId: number | null;
  sum: string | null;
  proof: PaymentProof;
};

/** Decodes fields only; signature, merchant binding and settlement must still pass. */
export function readProdamusPayment(
  body: Record<string, unknown>,
): ProdamusPaymentFields {
  const email = pickString(body, [
    "customer_email",
    "customerEmail",
  ]).toLowerCase();
  const subscription = asProdamusRecord(body.subscription);
  return {
    orderId: pickOrderId(body),
    email,
    userId: pickUserId(body),
    sum: pickString(body, ["sum"]) || null,
    proof: {
      domain: pickString(body, ["domain"]).toLowerCase(),
      paymentId: pickString(body, ["order_id"]),
      email,
      currency: pickString(body, ["currency"]),
      subscriptionId: pickString(subscription, ["id"]),
      profileId: pickString(subscription, ["profile_id"]),
    },
  };
}
