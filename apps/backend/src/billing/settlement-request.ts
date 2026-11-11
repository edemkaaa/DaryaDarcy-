import { billingKey, moneyMinor, type PaymentProof } from "./protocol";

export type ClubSettlementInput = {
  orderId: string;
  periodMs: number;
  sum?: string | null;
  proof?: PaymentProof;
  recurring?: boolean;
};
export type PreparedClubSettlement = {
  proof: PaymentProof;
  amount: number;
  paymentKey: string;
  orderId: string;
  payloadHash: string;
};

/** Preparation is not authentication: signature and durable ownership checks remain separate. */
export function prepareClubSettlement(
  input: ClubSettlementInput,
): PreparedClubSettlement | undefined {
  const proof = input.proof;
  const foreign = proof?.testForeignPayment;
  const amount = moneyMinor(input.sum);
  if (
    !proof ||
    !proof.paymentId ||
    proof.paymentId.length > 64 ||
    !proof.domain ||
    proof.currency.toLowerCase() !== "rub" ||
    amount === null ||
    !Number.isSafeInteger(input.periodMs) ||
    input.periodMs <= 0 ||
    (foreign &&
      (proof.domain !== "testpage1.payform.ru" ||
        !input.orderId.startsWith("club-test-") ||
        input.recurring ||
        proof.subscriptionId ||
        proof.profileId ||
        !["eur", "usd", "kzt", "byn"].includes(foreign.currency) ||
        !Number.isSafeInteger(foreign.amountMinor) ||
        foreign.amountMinor <= 0))
  )
    return undefined;
  const paymentKey = billingKey([proof.domain, proof.paymentId]);
  const orderId = input.recurring
    ? `club-renew-${paymentKey.slice(0, 40)}`
    : input.orderId;
  const payloadHash = clubSettlementPayloadHash(orderId, amount, proof);
  return { proof, amount, paymentKey, orderId, payloadHash };
}

export function clubSettlementPayloadHash(
  orderId: string,
  amount: number,
  proof: Pick<
    PaymentProof,
    "email" | "currency" | "subscriptionId" | "profileId" | "testForeignPayment"
  >,
): string {
  return billingKey([
    orderId,
    String(amount),
    proof.email,
    proof.currency.toLowerCase(),
    proof.subscriptionId || "",
    proof.profileId || "",
    // Conditional extension preserves every existing live/RUB receipt hash.
    ...(proof.testForeignPayment
      ? [
          "test-fx-v1",
          proof.testForeignPayment.currency,
          String(proof.testForeignPayment.amountMinor),
        ]
      : []),
  ]);
}
