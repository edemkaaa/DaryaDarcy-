import { expect, it, vi } from "vitest";
import {
  ClubSettlementService,
  type ClubSettlementInput,
} from "../apps/backend/src/billing/club-settlement.service";
import type { PaymentProof } from "../apps/backend/src/billing/protocol";
import { fulfillPaidOrder } from "../apps/backend/src/prodamus";
import * as db from "../apps/backend/src/db";

const proof: PaymentProof = Object.freeze({
  domain: "fixture.payform.ru",
  paymentId: "300156",
  email: "member@example.test",
  currency: "rub",
  subscriptionId: "7",
  profileId: "23",
});

it.each([
  ["club-7-monthly", 2_592_000_000, undefined],
  ["club6m-7-semiannual", 15_552_000_000, undefined],
  ["club-renew", 2_592_000_000, true],
] as const)(
  "%s preserves the complete durable settlement input",
  async (orderId, periodMs, recurring) => {
    // Replace only the external SQL effect, not field mapping or orchestration.
    const settlePayment = vi.fn(async (input: ClubSettlementInput) => {
      expect(input).toEqual({
        orderId,
        periodMs,
        sum: "000790.0",
        proof: {
          domain: "fixture.payform.ru",
          paymentId: "300156",
          email: "member@example.test",
          currency: "rub",
          subscriptionId: "7",
          profileId: "23",
        },
        recurring,
      });
      return true;
    });
    const service = new ClubSettlementService(settlePayment);
    expect(
      await service.settle(
        orderId,
        Object.freeze({ sum: "000790.0", proof, recurring }),
      ),
    ).toBe(true);
    expect(settlePayment).toHaveBeenCalledTimes(1);
  },
);

it("does not turn a rejected durable settlement into success", async () => {
  const service = new ClubSettlementService(async () => false);
  expect(await service.settle("club-7-rejected", { sum: "790", proof })).toBe(
    false,
  );
});

it("leaves absent amount/proof for the existing durable validator instead of inventing defaults", async () => {
  let received = false;
  const service = new ClubSettlementService(async (input) => {
    expect(input).toEqual({
      orderId: "club-7-empty",
      periodMs: 2_592_000_000,
      sum: undefined,
      proof: undefined,
      recurring: undefined,
    });
    received = true;
    return false;
  });
  expect(await service.settle("club-7-empty")).toBe(false);
  expect(received).toBe(true);
});

it("propagates SQL failure rather than acknowledging or retrying it", async () => {
  const failure = new Error("synthetic settlement failure");
  const settlePayment = vi.fn(async () => {
    throw failure;
  });
  const service = new ClubSettlementService(settlePayment);
  await expect(service.settle("club-7-failed", { proof })).rejects.toBe(
    failure,
  );
  expect(settlePayment).toHaveBeenCalledTimes(1);
});

it("awaits settlement completion before reporting success", async () => {
  let complete!: (granted: boolean) => void;
  const pending = new Promise<boolean>((resolve) => {
    complete = resolve;
  });
  const service = new ClubSettlementService(async () => pending);
  let reported = false;
  const result = service.settle("club-7-pending", { proof }).then((granted) => {
    reported = true;
    return granted;
  });
  try {
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(reported).toBe(false);
  } finally {
    complete(true);
  }
  expect(await result).toBe(true);
});

it.each([true, false])(
  "standalone fulfillment retains its durable decision: %s",
  async (granted) => {
    const effect = vi
      .spyOn(db, "settleClubPayment")
      .mockImplementation(async (input) => {
        expect(input).toEqual({
          orderId: "club6m-7-legacy",
          periodMs: 15_552_000_000,
          sum: "4740.00",
          proof: {
            domain: "fixture.payform.ru",
            paymentId: "300156",
            email: "member@example.test",
            currency: "rub",
            subscriptionId: "7",
            profileId: "23",
          },
          recurring: undefined,
        });
        return granted;
      });
    try {
      expect(
        await fulfillPaidOrder("club6m-7-legacy", { sum: "4740.00", proof }),
      ).toBe(granted ? "club" : null);
      expect(effect).toHaveBeenCalledTimes(1);
    } finally {
      effect.mockRestore();
    }
  },
);
