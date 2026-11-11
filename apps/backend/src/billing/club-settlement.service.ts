/** Выбирает период доступа и передаёт подтверждённую оплату атомарному обработчику settlement. */
import { Injectable } from "@nestjs/common";
import type { settleClubOrder } from "./settlement";

export type ClubSettlementInput = Parameters<typeof settleClubOrder>[1];
export type ClubSettlementDetails = Pick<
  ClubSettlementInput,
  "sum" | "proof" | "recurring"
>;
export type ClubSettlementPort = (
  input: ClubSettlementInput,
) => Promise<boolean>;

const ACCESS_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
const SEMIANNUAL_ACCESS_MS = 180 * 24 * 60 * 60 * 1000;

export function clubAccessMsForOrder(orderId: string): number {
  return orderId.startsWith("club6m-")
    ? SEMIANNUAL_ACCESS_MS
    : ACCESS_PERIOD_MS;
}

export function clubAccessMs(): number {
  return ACCESS_PERIOD_MS;
}

/** Оркестрация после проверки уведомления; повтор и выдачу доступа решает долговечный settlement. */
@Injectable()
export class ClubSettlementService {
  constructor(private readonly settlePayment: ClubSettlementPort) {}

  async settle(
    orderId: string,
    details?: ClubSettlementDetails,
  ): Promise<boolean> {
    return this.settlePayment({
      orderId,
      periodMs: clubAccessMsForOrder(orderId),
      sum: details?.sum,
      proof: details?.proof,
      recurring: details?.recurring,
    });
  }
}
