import type { PaymentProof } from "./protocol";

export type ProdamusClubBinding = {
  domain: string;
  subscriptionId: string;
};

/** Field matching only; does not verify signatures or authorize settlement. */
export function hasClubPaymentBinding(
  proof: PaymentProof,
  orderId: string,
  configured: ProdamusClubBinding,
): boolean {
  if (
    proof.domain !== configured.domain ||
    !proof.paymentId ||
    proof.currency.toLowerCase() !== "rub"
  ) {
    return false;
  }
  if (proof.subscriptionId) {
    return (
      proof.subscriptionId === configured.subscriptionId &&
      /^\d{1,64}$/.test(proof.profileId || "")
    );
  }
  // The legacy semiannual path has no recurring profile; SQL still binds the order.
  return !configured.subscriptionId || orderId.startsWith("club6m-");
}
