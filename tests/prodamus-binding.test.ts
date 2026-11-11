/** Field binding дополняет HMAC и settlement, но отдельно не является доказательством оплаты. */
import { describe, expect, it } from "vitest";
import { hasClubPaymentBinding } from "../apps/backend/src/billing/prodamus-binding";
import type { PaymentProof } from "../apps/backend/src/billing/protocol";

const monthly: PaymentProof = Object.freeze({
  domain: "fixture.payform.ru",
  paymentId: "300156",
  email: "member@example.test",
  currency: "rub",
  subscriptionId: "7",
  profileId: "23",
});
const configured = Object.freeze({
  domain: "fixture.payform.ru",
  subscriptionId: "7",
});

/** Фиксируем правила merchant/currency/subscription/profile, сохраняя явно проверенную legacy-совместимость. */
describe("Prodamus club field binding (not signature or settlement authorization)", () => {
  /** Monthly-матрица проверяет exact merchant/tariff, RUB и ограниченный числовой profile, включая старый zero/leading zeros. */
  it.each<[string, Partial<PaymentProof>, boolean]>([
    ["complete monthly binding", {}, true],
    ["another merchant", { domain: "another.payform.ru" }, false],
    ["absent domain", { domain: "" }, false],
    [
      "domain normalization belongs to decoding",
      { domain: "FIXTURE.PAYFORM.RU" },
      false,
    ],
    ["absent provider payment ID", { paymentId: "" }, false],
    ["uppercase RUB", { currency: "RUB" }, true],
    ["mixed-case RUB", { currency: "RuB" }, true],
    ["other currency", { currency: "USD" }, false],
    ["absent currency", { currency: "" }, false],
    ["currency trimming belongs to decoding", { currency: " rub " }, false],
    ["another subscription", { subscriptionId: "8" }, false],
    ["subscription is an exact identifier", { subscriptionId: "007" }, false],
    ["missing monthly subscription", { subscriptionId: undefined }, false],
    ["empty monthly subscription", { subscriptionId: "" }, false],
    ["missing profile", { profileId: undefined }, false],
    ["empty profile", { profileId: "" }, false],
    ["non-numeric profile", { profileId: "profile" }, false],
    ["negative profile", { profileId: "-23" }, false],
    ["fractional profile", { profileId: "23.5" }, false],
    ["profile whitespace is not repaired", { profileId: " 23 " }, false],
    ["legacy zero profile remains accepted", { profileId: "0" }, true],
    ["legacy leading zeros remain accepted", { profileId: "0023" }, true],
    ["64-digit profile boundary", { profileId: "1".repeat(64) }, true],
    ["65-digit profile", { profileId: "1".repeat(65) }, false],
  ])("%s", (_name, fields, expected) => {
    expect(
      hasClubPaymentBinding(
        { ...monthly, ...fields },
        "club-7-fixture",
        configured,
      ),
    ).toBe(expected);
  });

  /** Semiannual/recurring матрица различает обязательные и optional поля, не расширяя exemption на похожий prefix. */
  it.each<
    [string, string, string | undefined, string | undefined, string, boolean]
  >([
    [
      "semiannual without a subscription",
      "club6m-7-fixture",
      "",
      "",
      "7",
      true,
    ],
    [
      "semiannual without optional fields",
      "club6m-7-fixture",
      undefined,
      undefined,
      "7",
      true,
    ],
    [
      "semiannual still checks a supplied subscription",
      "club6m-7-fixture",
      "8",
      "23",
      "7",
      false,
    ],
    [
      "semiannual still checks a supplied profile",
      "club6m-7-fixture",
      "7",
      "wrong",
      "7",
      false,
    ],
    [
      "monthly without configured subscription",
      "club-7-fixture",
      "",
      "",
      "",
      true,
    ],
    [
      "no configured subscription cannot match incoming ID",
      "club-7-fixture",
      "7",
      "23",
      "",
      false,
    ],
    [
      "unrelated profile without subscription is not a new validation rule",
      "club6m-7-fixture",
      "",
      "wrong",
      "7",
      true,
    ],
    [
      "recurring event without order still needs subscription",
      "",
      "",
      "",
      "7",
      false,
    ],
    ["recurring event with full binding", "", "7", "23", "7", true],
    ["only exact semiannual prefix is exempt", "club6m", "", "", "7", false],
  ])(
    "%s",
    (_name, orderId, subscriptionId, profileId, configuredId, expected) => {
      expect(
        hasClubPaymentBinding(
          { ...monthly, subscriptionId, profileId },
          orderId,
          { ...configured, subscriptionId: configuredId },
        ),
      ).toBe(expected);
    },
  );

  /** Binding только читает proof/configuration и не нормализует их на месте. */
  it("reads frozen inputs without changing the payment proof or configuration", () => {
    expect(hasClubPaymentBinding(monthly, "club-7-fixture", configured)).toBe(
      true,
    );
    expect(monthly).toEqual({
      domain: "fixture.payform.ru",
      paymentId: "300156",
      email: "member@example.test",
      currency: "rub",
      subscriptionId: "7",
      profileId: "23",
    });
    expect(configured).toEqual({
      domain: "fixture.payform.ru",
      subscriptionId: "7",
    });
  });
});
