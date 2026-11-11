/** Создаёт обычный заказ один раз и восстанавливает его результат по журналу подтверждённых данных. */
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  users,
  clubPayments,
  normalCheckoutRequests,
  billingReceipts,
  type User,
} from "../../../../packages/database/src/schema";
import { getDb } from "../db";
import { normalizeEmail, isValidEmail } from "../_core/password";
import {
  assertClubCheckoutConfigured,
  buildCheckoutUrl,
  CLUB_PRICE,
  CLUB_SEMIANNUAL_PRICE,
} from "../prodamus";
import { moneyMinor } from "./protocol";

import { contactPhoneSchema } from "../../../../packages/shared/src/checkout-contact";
import {
  checkoutRequestHash,
  requireCheckoutContact,
} from "./checkout-contact";

export const normalCheckoutKey = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
export const normalCheckoutInput = z
  .object({
    idempotencyKey: normalCheckoutKey,
    contactPhone: contactPhoneSchema.optional(),
    plan: z.enum(["monthly", "semiannual"]).default("monthly"),
  })
  .strict();
const succeeded = z
  .object({
    state: z.literal("succeeded"),
    orderId: z.string(),
    expiresAt: z.date(),
  })
  .strict();
const failed = z
  .object({ state: z.literal("failed"), orderId: z.string() })
  .strict();
export const normalCheckoutResult = z.discriminatedUnion("state", [
  z
    .object({
      state: z.literal("pending"),
      orderId: z.string(),
      url: z.string().url(),
    })
    .strict(),
  succeeded,
  failed,
]);
export const normalCheckoutStatusResult = z.discriminatedUnion("state", [
  z.object({ state: z.literal("notRecorded") }).strict(),
  z.object({ state: z.literal("pending"), orderId: z.string() }).strict(),
  succeeded,
  failed,
]);
/** Считает SHA-256 отпечаток journal-key или полной checkout-ссылки без сохранения исходного значения в ключе. */
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
/** Возвращает безопасный PRECONDITION_FAILED до новых платёжных эффектов, если конфигурация не позволяет повтор. */
const unavailable = () =>
  new TRPCError({
    code: "PRECONDITION_FAILED",
    message: "Оплата временно недоступна",
  });
/** Разделяет intent по actor.id и клиентскому ключу в namespace обычного checkout. */
const requestKeyFor = (actor: User, key: string) =>
  hash(JSON.stringify(["club.normalCheckout:v1", actor.id, key]));
type Reader = Pick<MySql2Database, "select">;
/** Удерживает metadata lock и проверяет InnoDB/уникальность requestKey и orderId без runtime-миграций. */
async function requireSchema(tx: Reader & Pick<MySql2Database, "execute">) {
  // До проверки ограничений берём metadata lock; рабочий запрос схему не исправляет.
  await tx.select().from(normalCheckoutRequests).limit(0);
  const [result] = await tx.execute(sql`
    SELECT s.INDEX_NAME AS name, s.COLUMN_NAME AS columnName, s.SEQ_IN_INDEX AS position, t.ENGINE AS engine
    FROM information_schema.STATISTICS s JOIN information_schema.TABLES t
      ON t.TABLE_SCHEMA=s.TABLE_SCHEMA AND t.TABLE_NAME=s.TABLE_NAME
    WHERE s.TABLE_SCHEMA=DATABASE() AND s.TABLE_NAME='normal_checkout_requests' AND s.NON_UNIQUE=0`);
  const rows: unknown = result;
  if (!Array.isArray(rows)) throw new Error("Checkout schema unavailable");
  const primary = rows.filter((row) => row.name === "PRIMARY");
  const order = rows.filter(
    (row) => row.columnName === "orderId" && row.name !== "PRIMARY",
  );
  if (
    primary.length !== 1 ||
    primary[0].columnName !== "requestKey" ||
    primary[0].position !== 1 ||
    primary[0].engine !== "InnoDB" ||
    !order.some(
      (row) =>
        row.position === 1 &&
        rows.filter((other) => other.name === row.name).length === 1,
    )
  )
    throw new Error("Checkout schema unavailable");
}
/** Под UPDATE-блокировкой сверяет текущий epoch и отклоняет заблокированный или удаляемый аккаунт. */
async function lockActor(tx: Reader, actor: User) {
  const [current] = await tx
    .select()
    .from(users)
    .where(eq(users.id, actor.id))
    .for("update");
  if (!current || current.sessionVersion !== actor.sessionVersion)
    throw new TRPCError({ code: "UNAUTHORIZED" });
  if (current.blockedAt || current.accountDeletionRequestedAt)
    throw new TRPCError({ code: "FORBIDDEN" });
  return current;
}
/** Сверяет формат журнала, владельца/сумму/contact-hash заказа и receipt; только согласованный paid даёт succeeded. */
async function orderState(
  tx: Reader,
  request: typeof normalCheckoutRequests.$inferSelect,
) {
  const digest = /^[0-9a-f]{64}$/;
  const prefix = request.orderId.startsWith(`club6m-${request.actorUserId}-`)
    ? `club6m-${request.actorUserId}-`
    : `club-${request.actorUserId}-`;
  if (
    !request.orderId.startsWith(prefix) ||
    !normalCheckoutKey.safeParse(request.orderId.slice(prefix.length))
      .success ||
    !digest.test(request.requestHash) ||
    !digest.test(request.checkoutUrlHash) ||
    !Number.isSafeInteger(request.amountMinor) ||
    request.amountMinor <= 0 ||
    !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.payform\.ru$/.test(
      request.merchantDomain,
    )
  )
    throw new Error("Invalid checkout evidence");
  const [payment] = await tx
    .select()
    .from(clubPayments)
    .where(eq(clubPayments.orderId, request.orderId));
  const plan = prefix.startsWith("club6m-") ? "semiannual" : "monthly";
  const email = normalizeEmail(payment?.email || "");
  if (
    !payment ||
    payment.userId !== request.actorUserId ||
    moneyMinor(payment.sum || "") !== request.amountMinor ||
    !isValidEmail(email) ||
    checkoutRequestHash(plan, email, payment.contactPhone) !==
      request.requestHash
  )
    throw new Error("Invalid checkout result");
  if (payment.status === "failed")
    return { state: "failed" as const, orderId: payment.orderId };
  if (payment.status === "paid") {
    const receipts = await tx
      .select()
      .from(billingReceipts)
      .where(eq(billingReceipts.orderId, payment.orderId));
    if (
      !payment.paidAt ||
      !payment.expiresAt ||
      !receipts.length ||
      receipts.some(
        (receipt) =>
          receipt.userId !== request.actorUserId ||
          receipt.amountMinor !== request.amountMinor ||
          !digest.test(receipt.paymentKey) ||
          !digest.test(receipt.payloadHash),
      )
    )
      throw new Error("Invalid checkout receipt");
    return {
      state: "succeeded" as const,
      orderId: payment.orderId,
      expiresAt: payment.expiresAt,
    };
  }
  if (payment.status !== "pending" || payment.paidAt || payment.expiresAt)
    throw new Error("Invalid pending checkout");
  return { state: "pending" as const, orderId: payment.orderId };
}

/** Только восстанавливает записанный результат: новый заказ и ссылка оплаты здесь не создаются. */
export async function normalCheckoutStatus(actor: User, key: string) {
  if (process.env.NORMAL_CHECKOUT_RECOVERY_ENABLED !== "true")
    throw unavailable();
  const database = await getDb();
  if (!database) throw new Error("Database unavailable");
  return database.transaction(async (tx) => {
    await lockActor(tx, actor);
    await requireSchema(tx);
    const [request] = await tx
      .select()
      .from(normalCheckoutRequests)
      .where(eq(normalCheckoutRequests.requestKey, requestKeyFor(actor, key)));
    if (!request) return { state: "notRecorded" as const };
    if (request.actorUserId !== actor.id)
      throw new Error("Invalid checkout actor");
    return orderState(tx, request);
  });
}

/** Один idempotencyKey принадлежит одному actor и неизменяемому intent; конфликт не создаёт второй заказ. */
export async function createNormalCheckout(
  actor: User,
  input: z.infer<typeof normalCheckoutInput>,
  testHeader: unknown,
) {
  if (
    process.env.NORMAL_CHECKOUT_RECOVERY_ENABLED !== "true" ||
    testHeader !== undefined ||
    [process.env.PRODAMUS_TEST_ENABLED, process.env.YOOKASSA_TEST_ENABLED].some(
      (value) => value && value !== "false",
    )
  )
    throw unavailable();
  const database = await getDb();
  if (!database) throw new Error("Database unavailable");
  return database.transaction(async (tx) => {
    const current = await lockActor(tx, actor);
    await requireSchema(tx);
    const email = normalizeEmail(current.email || "");
    if (!isValidEmail(email))
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Укажите почту аккаунта",
      });
    const requestKey = requestKeyFor(actor, input.idempotencyKey);
    const requestHash = checkoutRequestHash(
      input.plan,
      email,
      input.contactPhone,
    );
    const [previous] = await tx
      .select()
      .from(normalCheckoutRequests)
      .where(eq(normalCheckoutRequests.requestKey, requestKey));
    if (
      previous &&
      (previous.actorUserId !== actor.id ||
        previous.requestHash !== requestHash)
    )
      throw new TRPCError({
        code: "CONFLICT",
        message: "Параметры оплаты изменились",
      });
    if (previous) {
      const state = await orderState(tx, previous);
      if (state.state !== "pending") return state;
    }
    const contactPhone = previous
      ? input.contactPhone
      : requireCheckoutContact(input.contactPhone);
    assertClubCheckoutConfigured(input.plan);
    const sum =
      input.plan === "semiannual" ? CLUB_SEMIANNUAL_PRICE : CLUB_PRICE;
    const amountMinor = moneyMinor(sum);
    if (!amountMinor) throw unavailable();
    const orderId =
      previous?.orderId ??
      `${input.plan === "semiannual" ? "club6m" : "club"}-${actor.id}-${randomUUID()}`;
    const url = buildCheckoutUrl({
      orderId,
      email,
      userId: actor.id,
      plan: input.plan,
    });
    const merchantDomain = new URL(url).hostname;
    const checkoutUrlHash = hash(url);
    if (previous) {
      const [payment] = await tx
        .select()
        .from(clubPayments)
        .where(eq(clubPayments.orderId, orderId));
      if (!payment || payment.email !== email)
        throw new Error("Invalid checkout result");
      if (
        previous.amountMinor !== amountMinor ||
        previous.merchantDomain !== merchantDomain ||
        previous.checkoutUrlHash !== checkoutUrlHash
      )
        throw unavailable();
    } else {
      // Новый авторизованный intent атомарно обновляет контакт владельца.
      // Повтор старого intent не должен откатывать более новый номер.
      await tx.update(users).set({ contactPhone }).where(eq(users.id, current.id));
      await tx
        .insert(clubPayments)
        .values({ userId: actor.id, orderId, email, sum, contactPhone });
      await tx.insert(normalCheckoutRequests).values({
        requestKey,
        actorUserId: actor.id,
        requestHash,
        orderId,
        amountMinor,
        merchantDomain,
        checkoutUrlHash,
      });
    }
    return { state: "pending" as const, orderId, url };
  });
}

// Гостевое восстановление использует общие проверки доказательств, но отдельное пространство actor.
export {
  requireSchema as requireNormalCheckoutSchema,
  orderState as readNormalCheckoutOrderState,
};
