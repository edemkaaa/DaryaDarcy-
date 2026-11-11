/** Общие ключи платёжного журнала и точное представление денежных сумм в минимальных единицах. */
import { createHash } from "node:crypto";
export const prodamusTestOrderPattern =
  /^club-test-[1-9]\d*-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

export type PaymentProof = {
  paymentId: string;
  domain: string;
  email: string;
  currency: string;
  subscriptionId?: string;
  profileId?: string;
  /** Исходное доказательство только TEST-оплаты; учётная валюта остаётся RUB. */
  testForeignPayment?: {
    currency: "eur" | "usd" | "kzt" | "byn";
    amountMinor: number;
  };
};
export const billingKey = (parts: string[]) =>
  createHash("sha256").update(JSON.stringify(parts)).digest("hex");
export const profileKey = (
  proof: Pick<PaymentProof, "domain" | "subscriptionId" | "profileId">,
) =>
  billingKey([proof.domain, proof.subscriptionId || "", proof.profileId || ""]);
/** Денежная строка разбирается целочисленно: двоичная арифметика дробей не участвует в сверке суммы. */
export function moneyMinor(value: string | null | undefined): number | null {
  if (!value || !/^\d{1,7}(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return amount > 0 && amount <= 2147483647 ? amount : null;
}
