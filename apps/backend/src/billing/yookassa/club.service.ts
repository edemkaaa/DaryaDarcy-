import { Injectable } from "@nestjs/common";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { User } from "../../../../../packages/database/src/schema";
import * as db from "../../db";
import { CLUB_PRICE, CLUB_SEMIANNUAL_PRICE } from "../../prodamus";
import { moneyMinor } from "../protocol";
import { settleClubOrder } from "../settlement";
import {
  YookassaTestClient,
  confirmationUrl,
  readYookassaTestConfig,
  type YookassaPayment,
} from "./client";
import { YookassaIntentRepository } from "./intents";

@Injectable()
export class YookassaClubService {
  private client?: YookassaTestClient;
  private clientIdentity?: string;

  private context() {
    let config;
    try {
      config = readYookassaTestConfig();
    } catch {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Тестовая оплата не настроена",
      });
    }
    const identity = JSON.stringify(config);
    if (!this.client || identity !== this.clientIdentity) {
      this.client = new YookassaTestClient(config);
      this.clientIdentity = identity;
    }
    return { config, client: this.client };
  }

  async createCheckout(
    recipient: User | null,
    email: string,
    plan: "monthly" | "semiannual",
    rawKey: unknown,
  ) {
    if (!z.uuid().safeParse(rawKey).success)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Нужен ключ платёжной заявки",
      });
    const intentKey = String(rawKey).toLowerCase();
    const { config, client } = this.context();
    const amountMinor = moneyMinor(
      plan === "semiannual" ? CLUB_SEMIANNUAL_PRICE : CLUB_PRICE,
    );
    if (amountMinor === null)
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Стоимость оплаты не настроена",
      });
    const database = await db.getDb();
    if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    try {
      await client.verifyAccount();
    } catch {
      throw new TRPCError({
        code: "SERVICE_UNAVAILABLE",
        message: "Платёжная система временно недоступна",
      });
    }
    const user = recipient || (await db.ensureUserByEmail(email));
    const repo = new YookassaIntentRepository(database);
    const { intent, leaseId } = await repo.claim({
      intentKey,
      userId: user.id,
      email,
      plan,
      shopId: config.shopId,
      amountMinor,
      accessDays: plan === "semiannual" ? 180 : 30,
      request: client.paymentRequest(`yk-club-${randomUUID()}`, amountMinor),
    });
    let payment;
    try {
      if (intent.providerPaymentId)
        payment = await client.getPayment(intent.providerPaymentId);
      else {
        payment = await client.createPayment(
          intent.requestBody,
          intent.orderId.slice("yk-club-".length),
        );
        await repo.bindPayment(intent.intentKeyHash, payment);
      }
    } catch {
      if (leaseId) await repo.markUnknown(intent.intentKeyHash, leaseId);
      throw new TRPCError({
        code: "SERVICE_UNAVAILABLE",
        message: "Результат пока неизвестен. Повторите запрос с тем же ключом",
      });
    }
    try {
      await this.reconcile(repo, payment, config.shopId);
    } catch {
      throw new TRPCError({
        code: "SERVICE_UNAVAILABLE",
        message:
          "Результат оплаты пока не подтверждён. Повторите тот же запрос позже",
      });
    }
    if (payment.status === "canceled")
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Платёж отменён. Для новой оплаты нужна новая заявка",
      });
    const url = confirmationUrl(payment);
    if (payment.status !== "succeeded" && !url)
      throw new TRPCError({
        code: "SERVICE_UNAVAILABLE",
        message: "Оплата ещё обрабатывается",
      });
    return {
      url:
        payment.status === "succeeded"
          ? `${config.returnUrl}?payment=returned&order=${intent.orderId}`
          : url!,
      user: null,
    };
  }

  async handleNotification(id: string): Promise<void> {
    const { config, client } = this.context();
    const database = await db.getDb();
    if (!database) throw new Error("Payment storage unavailable");
    const repo = new YookassaIntentRepository(database);
    // Never let notification metadata bind an unknown payment to an order.
    if (!(await repo.findPayment(id, config.shopId)))
      throw new Error("Payment binding unavailable");
    const payment = await client.getPayment(id);
    if (payment.status !== "succeeded" && payment.status !== "canceled")
      throw new Error("Payment outcome not confirmed");
    await this.reconcile(repo, payment, config.shopId);
  }

  private async reconcile(
    repo: YookassaIntentRepository,
    payment: YookassaPayment,
    shopId: string,
  ): Promise<void> {
    const bound = await repo.findPayment(payment.id, shopId);
    if (
      !bound ||
      payment.test !== true ||
      payment.recipient.account_id !== shopId ||
      payment.metadata.order_id !== bound.intent.orderId ||
      payment.amount.currency !== "RUB" ||
      moneyMinor(payment.amount.value) !== bound.intent.amountMinor ||
      moneyMinor(bound.order.sum) !== bound.intent.amountMinor ||
      ![30, 180].includes(bound.intent.accessDays)
    )
      throw new Error("Payment proof mismatch");
    if (payment.status === "succeeded") {
      if (!payment.paid) throw new Error("Payment not paid");
      const database = await db.getDb();
      if (
        !database ||
        !(await settleClubOrder(database, {
          orderId: bound.intent.orderId,
          periodMs: bound.intent.accessDays * 86400000,
          sum: payment.amount.value,
          proof: {
            domain: `yookassa:test:${shopId}`,
            paymentId: payment.id,
            email: (bound.order.email || "").trim().toLowerCase(),
            currency: "RUB",
          },
        }))
      )
        throw new Error("Payment settlement unavailable");
      // Receipt/access/outbox commit together; this recoverable marker is not
      // used as proof of payment or as the deduplication boundary.
      await repo.recordOutcome(bound.intent.intentKeyHash, "succeeded");
    } else if (payment.status === "canceled") {
      if (payment.paid || bound.order.status === "paid")
        throw new Error("Contradictory payment outcome");
      await repo.recordOutcome(bound.intent.intentKeyHash, "canceled");
    }
  }
}
