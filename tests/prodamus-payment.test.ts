import { describe, expect, it } from "vitest";
import { readProdamusPayment } from "../apps/backend/src/billing/prodamus-payment";

describe("Prodamus payment field decoding (not payment authorization)", () => {
  it("preserves the complete order, amount, recipient and nested profile binding", () => {
    expect(
      readProdamusPayment({
        order_num: "club-7-fixture",
        order_id: "300156",
        customer_email: " MEMBER+CLUB@EXAMPLE.TEST ",
        domain: " FIXTURE.PAYFORM.RU ",
        currency: "RUB",
        sum: "790.00",
        _param_userId: "7",
        subscription: { id: "7", profile_id: "23" },
      }),
    ).toEqual({
      orderId: "club-7-fixture",
      email: "member+club@example.test",
      userId: 7,
      sum: "790.00",
      proof: {
        domain: "fixture.payform.ru",
        paymentId: "300156",
        email: "member+club@example.test",
        currency: "RUB",
        subscriptionId: "7",
        profileId: "23",
      },
    });
  });

  it.each([
    {
      name: "uses legacy case aliases without lowercasing currency",
      input: {
        Order_Num: "club6m-7-alias",
        Order_ID: "300155",
        CustomerEmail: " A@B.TEST ",
        Domain: "FIXTURE.PAYFORM.RU",
        Currency: "RUB",
        Sum: "4740.00",
      },
      want: {
        orderId: "club6m-7-alias",
        email: "a@b.test",
        sum: "4740.00",
        proof: {
          paymentId: "300155",
          domain: "fixture.payform.ru",
          currency: "RUB",
        },
      },
    },
    {
      name: "retains exact secondary email precedence over a case-insensitive primary alias",
      input: {
        Customer_Email: "other@b.test",
        customerEmail: " chosen@b.test ",
      },
      want: { email: "chosen@b.test", proof: { email: "chosen@b.test" } },
    },
    {
      name: "keeps the provider payment ID distinct from the internal order",
      input: {
        order: "club6m-7-original",
        order_id: "300157",
        order_num: "club-7-other",
      },
      want: { orderId: "club6m-7-original", proof: { paymentId: "300157" } },
    },
    {
      name: "does not infer nested subscription fields from unrelated top-level hints or arrays",
      input: {
        subscription: [{ id: "7", profile_id: "23" }],
        subscription_id: "8",
        profile_id: "24",
        sum: 0,
      },
      want: { sum: "0", proof: { subscriptionId: "", profileId: "" } },
    },
    {
      name: "preserves amount precision and nested string identifiers",
      input: {
        sum: " 000790.0 ",
        subscription: { ID: " 007 ", PROFILE_ID: " 0023 " },
      },
      want: {
        sum: "000790.0",
        proof: { subscriptionId: "007", profileId: "0023" },
      },
    },
    {
      name: "does not authenticate or repair invalid amount, currency or profile values",
      input: {
        sum: "not-money",
        currency: "USD",
        domain: "OTHER.PAYFORM.RU",
        subscription: { id: "wrong", profile_id: "not-numeric" },
      },
      want: {
        sum: "not-money",
        proof: {
          currency: "USD",
          domain: "other.payform.ru",
          subscriptionId: "wrong",
          profileId: "not-numeric",
        },
      },
    },
    {
      name: "keeps the existing finite-positive user hint coercion",
      input: { _param: { userId: "7.5" } },
      want: { userId: 7.5 },
    },
  ])("$name", ({ input, want }) => {
    expect(readProdamusPayment(input)).toMatchObject(want);
  });

  it("leaves absent values empty rather than inventing a price or profile", () => {
    expect(
      readProdamusPayment({ sum: "", _param_userId: "invalid", userId: "7" }),
    ).toEqual({
      orderId: "",
      email: "",
      userId: null,
      sum: null,
      proof: {
        domain: "",
        paymentId: "",
        email: "",
        currency: "",
        subscriptionId: "",
        profileId: "",
      },
    });
  });

  it("does not mutate a frozen subscription or request record", () => {
    const subscription = Object.freeze({ id: "7", profile_id: "23" });
    const input = Object.freeze({ subscription, customer_email: " A@B.TEST " });
    expect(readProdamusPayment(input)).toMatchObject({
      email: "a@b.test",
      proof: { subscriptionId: "7", profileId: "23" },
    });
    expect(input.subscription).toBe(subscription);
    expect(input.customer_email).toBe(" A@B.TEST ");
  });
});
