/** Проверяет capability результата TEST-заказа без раскрытия identity и секретов восстановления. */
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  accessEmailOutbox,
  billingReceipts,
  clubPayments,
  users,
} from "../../../../packages/database/src/schema";
import { getDb } from "../db";
import { normalizeEmail } from "../_core/password";
import { moneyMinor, prodamusTestOrderPattern } from "./protocol";

export { prodamusTestOrderPattern } from "./protocol";
const purpose = "prodamus-test-return:v1:";
const lifetimeSeconds = 86400;
export type ProdamusTestResult =
  | { state: "unknown" | "pending"; nextAction: null; emailStatus: null }
  | {
      state: "succeeded";
      nextAction: "setup" | "login";
      emailStatus: "pending" | "sent" | "unavailable";
    };
const unknown: ProdamusTestResult = {
  state: "unknown",
  nextAction: null,
  emailStatus: null,
};

export function createProdamusTestReturnProof(
  orderId: string,
  key: string,
): string {
  const payload = `${orderId}.${Math.floor(Date.now() / 1000) + lifetimeSeconds}`;
  return `${payload}.${createHmac("sha256", key).update(`${purpose}${payload}`).digest("hex")}`;
}

/** Capability только чтения заказа, не учётные данные identity, сессии или пароля. */
function readProof(token: string, key: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [orderId, expires, signature] = parts;
  const now = Math.floor(Date.now() / 1000);
  if (
    orderId.length > 64 ||
    prodamusTestOrderPattern.exec(orderId)?.[0] !== orderId ||
    !/^[1-9]\d{9}$/.test(expires) ||
    !/^[a-f0-9]{64}$/.test(signature) ||
    Number(expires) <= now ||
    Number(expires) > now + lifetimeSeconds
  )
    return null;
  const expected = createHmac("sha256", key)
    .update(`${purpose}${orderId}.${expires}`)
    .digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"))
    ? orderId
    : null;
}

/** Для succeeded нужны согласованные заказ, receipt и письмо, а не один браузерный возврат. */
export async function readProdamusTestResult(
  token: string,
  key: string,
): Promise<ProdamusTestResult> {
  const orderId = readProof(token, key);
  if (!orderId) return unknown;
  const database = await getDb();
  if (!database) throw new Error("Test result database unavailable");
  const [row] = await database
    .select({
      userId: clubPayments.userId,
      userEmail: users.email,
      paymentEmail: clubPayments.email,
      blockedAt: users.blockedAt,
      hasPassword: sql<number>`CASE WHEN ${users.passwordHash} IS NOT NULL AND ${users.passwordHash} <> '' THEN 1 ELSE 0 END`,
      sum: clubPayments.sum,
      status: clubPayments.status,
      paidAt: clubPayments.paidAt,
      expiresAt: clubPayments.expiresAt,
    })
    .from(clubPayments)
    .innerJoin(users, eq(users.id, clubPayments.userId))
    .where(eq(clubPayments.orderId, orderId))
    .limit(1);
  if (
    !row ||
    row.blockedAt ||
    !row.userEmail ||
    !row.paymentEmail ||
    row.userId !== Number(orderId.split("-")[2]) ||
    normalizeEmail(row.userEmail) !== normalizeEmail(row.paymentEmail) ||
    moneyMinor(row.sum) !== 79000
  )
    return unknown;
  if (row.status === "pending")
    return { state: "pending", nextAction: null, emailStatus: null };
  if (row.status !== "paid" || !row.paidAt || !row.expiresAt) return unknown;
  // Settlement атомарно создаёт письмо и receipt именно этого заказа.
  // По уникальному event key читаем receipt через PK, не сканируя все квитанции.
  const [mail] = await database
    .select({
      eventKey: accessEmailOutbox.eventKey,
      email: accessEmailOutbox.email,
      sentAt: accessEmailOutbox.sentAt,
      discardedAt: accessEmailOutbox.discardedAt,
    })
    .from(accessEmailOutbox)
    .where(
      and(
        eq(accessEmailOutbox.userId, row.userId),
        eq(accessEmailOutbox.kind, "club-access"),
        sql`JSON_UNQUOTE(JSON_EXTRACT(${accessEmailOutbox.payload}, '$.orderId')) = ${orderId}`,
      ),
    )
    .orderBy(desc(accessEmailOutbox.id))
    .limit(1);
  const receiptKey =
    mail && /^club-access:([a-f0-9]{64})$/.exec(mail.eventKey)?.[1];
  if (!receiptKey || mail.email !== normalizeEmail(row.userEmail))
    return unknown;
  const [receipt] = await database
    .select({
      userId: billingReceipts.userId,
      orderId: billingReceipts.orderId,
      amountMinor: billingReceipts.amountMinor,
    })
    .from(billingReceipts)
    .where(eq(billingReceipts.paymentKey, receiptKey))
    .limit(1);
  if (
    !receipt ||
    receipt.userId !== row.userId ||
    receipt.orderId !== orderId ||
    receipt.amountMinor !== 79000
  )
    return unknown;
  return {
    state: "succeeded",
    nextAction: row.hasPassword ? "login" : "setup",
    emailStatus: mail.discardedAt
      ? "unavailable"
      : mail.sentAt
        ? "sent"
        : "pending",
  };
}
