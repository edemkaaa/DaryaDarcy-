/** Чистая подготовка settlement фиксирует денежные minor units и неизменяемую идентичность квитанции до SQL. */
import { expect, it } from "vitest";
import {
  prepareClubSettlement,
  type ClubSettlementInput,
} from "../apps/backend/src/billing/settlement-request";
import type { PaymentProof } from "../apps/backend/src/billing/protocol";

const proof: PaymentProof = {
  paymentId: "pay-42",
  domain: "fixture.payform.ru",
  email: "member@example.invalid",
  currency: "rub",
  subscriptionId: "99",
  profileId: "144",
};
const input: ClubSettlementInput = {
  orderId: "club-42",
  periodMs: 2592000000,
  sum: "790.00",
  proof,
};
// Independent SHA-256 fixtures over hand-defined JSON arrays, not billingKey.
const paymentKey =
  "8abbdcc740edfd09d8689073d1b8289eb439a5e1dce52f684268f7ffc1068695";
const payloadHash =
  "69348c0c23cb2291116762df710e5a520a77370e8e3f0ee9d517fb1945f3fd0a";
/** Эквивалентные RUB-строки дают тот же независимо заданный paymentKey/payloadHash. */
it.each(["790", "790.0", "790.00"])(
  "retains the live receipt fingerprint for amount %s",
  (sum) => {
    expect(prepareClubSettlement({ ...input, sum })).toEqual({
      proof,
      amount: 79000,
      paymentKey,
      orderId: "club-42",
      payloadHash,
    });
  },
);
/** Нормализация fingerprint не переписывает исходный frozen proof. */
it("preserves RUB case normalization without changing the supplied proof", () => {
  const frozen = Object.freeze({
    ...input,
    proof: Object.freeze({ ...proof, currency: "RUB" }),
  });
  expect(prepareClubSettlement(frozen)).toEqual({
    proof: { ...proof, currency: "RUB" },
    amount: 79000,
    paymentKey,
    orderId: "club-42",
    payloadHash,
  });
  expect(frozen.proof.currency).toBe("RUB");
});
/** Recurring order выводится из идентичности списания, не произвольного caller hint. */
it("derives renewal order and receipt from the charge, not the caller's order hint", () => {
  expect(
    prepareClubSettlement({
      ...input,
      orderId: "ignored-hint",
      recurring: true,
    }),
  ).toEqual({
    proof,
    amount: 79000,
    paymentKey,
    orderId: "club-renew-8abbdcc740edfd09d8689073d1b8289eb439a5e1",
    payloadHash:
      "2324d33e65c66c0db36aafeeb72a44628d6fc7d38d1f8eb4274b2b248f35e2b7",
  });
});
/** Один provider payment key с другим profile меняет payloadHash и не теряет свидетельство привязки. */
it("binds the initial receipt to the profile independently of the provider charge key", () => {
  expect(
    prepareClubSettlement({ ...input, proof: { ...proof, profileId: "145" } }),
  ).toMatchObject({
    paymentKey,
    payloadHash:
      "d3ff9df21aade62d154b9ba03cd55c71a30fa0f51897dec6aa8c7bef345ee855",
  });
});
/** Неполный proof, неверная сумма/валюта/период не достигают транзакции. */
it.each<Partial<ClubSettlementInput>>([
  { proof: undefined },
  { proof: { ...proof, paymentId: "" } },
  { proof: { ...proof, paymentId: "p".repeat(65) } },
  { proof: { ...proof, domain: "" } },
  { proof: { ...proof, currency: "eur" } },
  { sum: undefined },
  { sum: null },
  { sum: "" },
  { sum: "0" },
  { sum: "-1" },
  { sum: " 790" },
  { sum: "790,00" },
  { sum: "790.001" },
  { sum: "1e2" },
  { sum: "10000000" },
  { periodMs: 0 },
  { periodMs: -1 },
  { periodMs: 1.5 },
  { periodMs: Number.MAX_SAFE_INTEGER + 1 },
  { periodMs: Infinity },
])("refuses invalid pre-SQL settlement fields %j", (patch) => {
  expect(prepareClubSettlement({ ...input, ...patch })).toBeUndefined();
});

const foreignProof: PaymentProof = {
  paymentId: "test-pay",
  domain: "testpage1.payform.ru",
  email: "member@example.invalid",
  currency: "rub",
  testForeignPayment: { currency: "eur", amountMinor: 1234 },
};
const foreignInput: ClubSettlementInput = {
  ...input,
  orderId: "club-test-42",
  proof: foreignProof,
};
/** FX currency/amount включаются в TEST fingerprint; ожидаемые SHA-256 заданы независимо. */
it.each([
  {
    currency: "eur" as const,
    amountMinor: 1234,
    hash: "59b60dabaef33e623c71b2ff3ac23fa18d00820ad7b60fc507ee70eaeca6ac9e",
  },
  {
    currency: "usd" as const,
    amountMinor: 1234,
    hash: "66fb7acc5fbc1f9f458f4922fbea5c7f712f53011ecb475b69cd3bd0637a14c5",
  },
  {
    currency: "eur" as const,
    amountMinor: 1235,
    hash: "ba868b08a3c1798b11d35f1378a9e519a53d10cc0eab205d2d0aa95dcb8d0f55",
  },
])(
  "binds TEST receipt to foreign evidence $currency/$amountMinor",
  ({ currency, amountMinor, hash }) => {
    const evidence = Object.freeze({ currency, amountMinor });
    const frozen = Object.freeze({
      ...foreignInput,
      proof: Object.freeze({ ...foreignProof, testForeignPayment: evidence }),
    });
    expect(prepareClubSettlement(frozen)).toEqual({
      proof: frozen.proof,
      amount: 79000,
      orderId: "club-test-42",
      paymentKey:
        "39b962b3750e6e81f43828b4bdf9b9e4661e13149e5909558b4403ea1af622ab",
      payloadHash: hash,
    });
  },
);
/** Добавление FX evidence не меняет прежние RUB receipt identities. */
it("keeps ordinary TEST RUB receipts on their historical hash without an FX suffix", () => {
  const { testForeignPayment: _foreign, ...rubProof } = foreignProof;
  expect(
    prepareClubSettlement({ ...foreignInput, proof: rubProof }),
  ).toMatchObject({
    payloadHash:
      "3130c33096fd2502d2d326bcd2054ce6ed148067f3289769210e958bed6c004b",
  });
});
/** FX proof допустим только у конкретного TEST one-off, без recurring и subscription/profile полей. */
it.each<Partial<ClubSettlementInput>>([
  { orderId: "club-42" },
  { recurring: true },
  { proof: { ...foreignProof, domain: "fixture.payform.ru" } },
  { proof: { ...foreignProof, subscriptionId: "99" } },
  { proof: { ...foreignProof, profileId: "144" } },
  ...[0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1].map((amountMinor) => ({
    proof: {
      ...foreignProof,
      testForeignPayment: { currency: "eur" as const, amountMinor },
    },
  })),
])(
  "refuses TEST foreign evidence outside its existing boundary %j",
  (patch) => {
    expect(
      prepareClubSettlement({ ...foreignInput, ...patch }),
    ).toBeUndefined();
  },
);
