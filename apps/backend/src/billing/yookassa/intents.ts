/** SQL-журнал TEST-намерений YooKassa для восстановления результата без слепого создания нового заказа. */
import type { MySql2Database } from "drizzle-orm/mysql2";
import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import {
  billingCheckoutIntents,
  clubPayments,
  users,
  type BillingCheckoutIntent,
} from "../../../../../packages/database/src/schema";
import type { YookassaCreateRequest, YookassaPayment } from "./client";
import { billingKey, moneyMinor } from "../protocol";
export type IntentInput = {
  intentKey: string;
  userId: number;
  email: string;
  shopId: string;
  plan: "monthly" | "semiannual";
  amountMinor: number;
  accessDays: number;
  request: YookassaCreateRequest;
};
export class YookassaIntentRepository {
  constructor(private readonly database: MySql2Database) {}
  async findIntent(intentKey: string, shopId: string) {
    const [bound] = await this.database
      .select({
        intent: billingCheckoutIntents,
        order: clubPayments,
        user: { id: users.id, email: users.email, blockedAt: users.blockedAt },
      })
      .from(billingCheckoutIntents)
      .innerJoin(
        clubPayments,
        and(
          eq(clubPayments.orderId, billingCheckoutIntents.orderId),
          eq(clubPayments.userId, billingCheckoutIntents.userId),
        ),
      )
      .innerJoin(users, eq(users.id, billingCheckoutIntents.userId))
      .where(
        and(
          eq(
            billingCheckoutIntents.intentKeyHash,
            billingKey(["yookassa-test", intentKey]),
          ),
          eq(billingCheckoutIntents.shopId, shopId),
        ),
      )
      .limit(1);
    return bound;
  }

  async findPayment(id: string, shopId: string) {
    const [bound] = await this.database
      .select({ intent: billingCheckoutIntents, order: clubPayments })
      .from(billingCheckoutIntents)
      .innerJoin(
        clubPayments,
        and(
          eq(clubPayments.orderId, billingCheckoutIntents.orderId),
          eq(clubPayments.userId, billingCheckoutIntents.userId),
        ),
      )
      .where(
        and(
          eq(billingCheckoutIntents.shopId, shopId),
          eq(billingCheckoutIntents.providerPaymentId, id),
        ),
      )
      .limit(1);
    return bound;
  }

  async recordOutcome(
    hash: string,
    state: "succeeded" | "canceled",
  ): Promise<void> {
    await this.database.transaction(async (tx) => {
      const [intent] = await tx
        .select()
        .from(billingCheckoutIntents)
        .where(eq(billingCheckoutIntents.intentKeyHash, hash))
        .for("update");
      if (!intent) throw new Error("Payment intent unavailable");
      if (state === "canceled")
        await tx
          .update(clubPayments)
          .set({ status: "failed" })
          .where(
            and(
              eq(clubPayments.orderId, intent.orderId),
              eq(clubPayments.status, "pending"),
            ),
          );
      await tx
        .update(billingCheckoutIntents)
        .set({ state })
        .where(eq(billingCheckoutIntents.intentKeyHash, hash));
    });
  }
  async claim(
    input: IntentInput,
  ): Promise<{ intent: BillingCheckoutIntent; leaseId: string | null }> {
    const intentKeyHash = billingKey(["yookassa-test", input.intentKey]);
    const requestHash = billingKey([
      String(input.userId),
      input.email,
      input.plan,
    ]);
    return this.database.transaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, input.userId))
        .for("update");
      if (
        !user ||
        user.blockedAt ||
        user.email?.trim().toLowerCase() !== input.email
      )
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Не удалось создать платёж",
        });
      await tx
        .insert(billingCheckoutIntents)
        .values({
          intentKeyHash,
          requestHash,
          userId: input.userId,
          shopId: input.shopId,
          plan: input.plan,
          orderId: input.request.metadata.order_id,
          requestBody: input.request,
          amountMinor: input.amountMinor,
          accessDays: input.accessDays,
          state: "unknown",
        })
        .onDuplicateKeyUpdate({
          set: { intentKeyHash: sql`${billingCheckoutIntents.intentKeyHash}` },
        });
      const [intent] = await tx
        .select()
        .from(billingCheckoutIntents)
        .where(eq(billingCheckoutIntents.intentKeyHash, intentKeyHash))
        .for("update");
      if (
        !intent ||
        intent.requestHash !== requestHash ||
        intent.shopId !== input.shopId
      )
        throw new TRPCError({
          code: "CONFLICT",
          message: "Платёжная заявка не соответствует запросу",
        });
      const [order] = await tx
        .select()
        .from(clubPayments)
        .where(eq(clubPayments.orderId, intent.orderId));
      if (!order && !intent.firstSentAt)
        await tx.insert(clubPayments).values({
          userId: input.userId,
          orderId: intent.orderId,
          email: input.email,
          sum: String(intent.amountMinor / 100),
          status: "pending",
        });
      else if (!order)
        throw new TRPCError({
          code: "CONFLICT",
          message: "Платёжная заявка недоступна",
        });
      else if (order.userId !== intent.userId || order.email !== input.email)
        throw new TRPCError({
          code: "CONFLICT",
          message: "Платёжная заявка недоступна",
        });
      if (intent.providerPaymentId) return { intent, leaseId: null };
      const now = new Date();
      const elapsed =
        now.getTime() - (intent.firstSentAt?.getTime() ?? now.getTime());
      // Останавливаемся за час до истечения идемпотентности провайдера: поздний
      // повтор неизвестного результата может создать НОВУЮ оплату даже с прежним ключом.
      if (elapsed < 0 || elapsed >= 23 * 60 * 60 * 1000)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Нужна проверка статуса платежа поддержкой",
        });
      if (intent.leaseUntil && intent.leaseUntil > now)
        throw new TRPCError({
          code: "CONFLICT",
          message: "Платёж уже обрабатывается. Повторите тот же запрос позже",
        });
      const leaseId = randomUUID();
      const claimed = {
        ...intent,
        state: "creating" as const,
        leaseId,
        leaseUntil: new Date(now.getTime() + 60_000),
        firstSentAt: intent.firstSentAt ?? now,
      };
      await tx
        .update(billingCheckoutIntents)
        .set({
          state: claimed.state,
          leaseId,
          leaseUntil: claimed.leaseUntil,
          firstSentAt: claimed.firstSentAt,
        })
        .where(eq(billingCheckoutIntents.intentKeyHash, intentKeyHash));
      return { intent: claimed, leaseId };
    });
  }
  async markUnknown(hash: string, lease: string): Promise<void> {
    await this.database
      .update(billingCheckoutIntents)
      .set({ state: "unknown", leaseId: null, leaseUntil: null })
      .where(
        and(
          eq(billingCheckoutIntents.intentKeyHash, hash),
          eq(billingCheckoutIntents.leaseId, lease),
        ),
      );
  }
  async bindPayment(
    hash: string,
    payment: YookassaPayment,
  ): Promise<BillingCheckoutIntent> {
    return this.database.transaction(async (tx) => {
      const [intent] = await tx
        .select()
        .from(billingCheckoutIntents)
        .where(eq(billingCheckoutIntents.intentKeyHash, hash))
        .for("update");
      if (
        !intent ||
        !intent.firstSentAt ||
        intent.shopId !== payment.recipient.account_id ||
        intent.orderId !== payment.metadata.order_id ||
        intent.amountMinor !== moneyMinor(payment.amount.value) ||
        (intent.providerPaymentId && intent.providerPaymentId !== payment.id)
      )
        throw new TRPCError({
          code: "CONFLICT",
          message: "Платёж не соответствует заявке",
        });
      const bound = {
        ...intent,
        providerPaymentId: payment.id,
        state: "ready" as const,
        leaseId: null,
        leaseUntil: null,
      };
      await tx
        .update(billingCheckoutIntents)
        .set({
          providerPaymentId: bound.providerPaymentId,
          state: bound.state,
          leaseId: null,
          leaseUntil: null,
        })
        .where(eq(billingCheckoutIntents.intentKeyHash, hash));
      return bound;
    });
  }
}
