import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Request, Response } from "express";
import {
  users,
  clubPayments,
  normalCheckoutRequests,
  type User,
} from "../../../../packages/database/src/schema";
import { getDb, ensureUserByEmail } from "../db";
import { normalizeEmail, isValidEmail } from "../_core/password";
import { checkRequestRateLimit } from "../_core/request-rate-limit";
import { clientIp } from "../sms-auth";
import {
  assertClubCheckoutConfigured,
  buildCheckoutUrl,
  CLUB_PRICE,
  CLUB_SEMIANNUAL_PRICE,
} from "../prodamus";
import { billingKey, moneyMinor } from "./protocol";
import {
  normalCheckoutKey,
  requireNormalCheckoutSchema,
  readNormalCheckoutOrderState,
} from "./normal-checkout";
import type { MySql2Database } from "drizzle-orm/mysql2";

import { contactPhoneSchema } from "../../../../packages/shared/src/checkout-contact";
import {
  checkoutRequestHash,
  requireCheckoutContact,
} from "./checkout-contact";

const secret = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/)
  .refine(
    (value) => Buffer.from(value, "base64url").toString("base64url") === value,
    "Некорректный ключ восстановления",
  );
export const guestCheckoutProof = z
  .object({ idempotencyKey: normalCheckoutKey, recoveryToken: secret })
  .strict();
export const guestCheckoutInput = guestCheckoutProof
  .extend({
    email: z
      .string()
      .trim()
      .max(320)
      .transform(normalizeEmail)
      .refine(isValidEmail, "Укажите почту для оплаты"),
    plan: z.enum(["monthly", "semiannual"]).default("monthly"),
    contactPhone: contactPhoneSchema.optional(),
  })
  .strict();
type Proof = z.infer<typeof guestCheckoutProof>;
type Input = z.infer<typeof guestCheckoutInput>;
type Ledger = typeof normalCheckoutRequests.$inferSelect;
type Tx = Parameters<Parameters<MySql2Database["transaction"]>[0]>[0];
const requestKey = (input: Proof) =>
  billingKey([
    "club.guestCheckout:v1",
    input.recoveryToken,
    input.idempotencyKey,
  ]);
const payloadHash = (input: Input) =>
  checkoutRequestHash(input.plan, input.email, input.contactPhone);
const unavailable = () =>
  new TRPCError({
    code: "PRECONDITION_FAILED",
    message: "Оплата временно недоступна",
  });
const conflict = () =>
  new TRPCError({ code: "CONFLICT", message: "Параметры оплаты изменились" });
function enabled() {
  if (process.env.GUEST_CHECKOUT_RECOVERY_ENABLED !== "true")
    throw unavailable();
}

/** Bounded existing counters; neither raw proof nor email enters keys or URLs. */
export async function enforceGuestCheckoutLimit(
  req: Request,
  res: Response,
  proof: Proof,
) {
  res.setHeader("Cache-Control", "no-store");
  enabled();
  if (req.query?.batch !== undefined)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Проверяйте одну заявку за запрос",
    });
  for (const [key, max] of [
    [`guest-checkout-ip:${clientIp(req)}`, 60],
    [`guest-checkout-intent:${requestKey(proof)}`, 12],
  ] as const) {
    const result = await checkRequestRateLimit(key, max, 60_000);
    if (!result.ok) {
      res.setHeader("Retry-After", result.retryAfterSec);
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Слишком много запросов оплаты. Попробуйте позже",
      });
    }
  }
}
async function recipient(tx: Tx, id: number, actor: User | null = null) {
  const [row] = await tx
    .select()
    .from(users)
    .where(eq(users.id, id))
    .for("update");
  if (!row || row.blockedAt || row.accountDeletionRequestedAt)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Оплата временно недоступна",
    });
  if (actor && row.id !== actor.id)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Недоступная заявка оплаты",
    });
  if (actor && row.sessionVersion !== actor.sessionVersion)
    throw new TRPCError({ code: "UNAUTHORIZED" });
  return row;
}
async function read(tx: Tx, key: string) {
  const [row] = await tx
    .select()
    .from(normalCheckoutRequests)
    .where(eq(normalCheckoutRequests.requestKey, key));
  return row;
}
async function replay(
  tx: Tx,
  previous: Ledger,
  input: Input,
  actor: User | null = null,
) {
  const current = await recipient(tx, previous.actorUserId, actor);
  if (
    previous.requestHash !== payloadHash(input) ||
    normalizeEmail(current.email || "") !== input.email
  )
    throw conflict();
  const state = await readNormalCheckoutOrderState(tx, previous);
  if (state.state !== "pending") return state;
  assertClubCheckoutConfigured(input.plan);
  const sum = input.plan === "semiannual" ? CLUB_SEMIANNUAL_PRICE : CLUB_PRICE;
  const url = buildCheckoutUrl({
    orderId: previous.orderId,
    userId: current.id,
    email: input.email,
    plan: input.plan,
  });
  if (
    previous.amountMinor !== moneyMinor(sum) ||
    previous.merchantDomain !== new URL(url).hostname ||
    previous.checkoutUrlHash !== billingKeyForUrl(url)
  )
    throw unavailable();
  return { state: "pending" as const, orderId: previous.orderId, url };
}
// Match the existing ledger's SHA-256 URL format, not billingKey's array encoding.
const billingKeyForUrl = (url: string) =>
  createHash("sha256").update(url).digest("hex");

export async function guestNormalCheckoutStatus(
  input: Proof,
  actor: User | null,
) {
  enabled();
  const database = await getDb();
  if (!database) throw new Error("Database unavailable");
  return database.transaction(
    async (tx) => {
      await requireNormalCheckoutSchema(tx);
      const previous = await read(tx, requestKey(input));
      if (!previous) return { state: "notRecorded" as const };
      await recipient(tx, previous.actorUserId, actor);
      return readNormalCheckoutOrderState(tx, previous);
    },
    { isolationLevel: "read committed" },
  );
}
function duplicate(error: unknown): boolean {
  for (let i = 0; i < 4 && error && typeof error === "object"; i++) {
    if ("code" in error && error.code === "ER_DUP_ENTRY") return true;
    error = "cause" in error ? error.cause : null;
  }
  return false;
}
export async function createGuestNormalCheckout(
  input: Input,
  testHeader: unknown,
  actor: User | null,
) {
  enabled();
  if (
    testHeader !== undefined ||
    [process.env.PRODAMUS_TEST_ENABLED, process.env.YOOKASSA_TEST_ENABLED].some(
      (v) => v && v !== "false",
    )
  )
    throw unavailable();
  const database = await getDb();
  if (!database) throw new Error("Database unavailable");
  const key = requestKey(input);
  const recover = () =>
    database.transaction(
      async (tx) => {
        await requireNormalCheckoutSchema(tx);
        const previous = await read(tx, key);
        return previous ? replay(tx, previous, input, actor) : null;
      },
      { isolationLevel: "read committed" },
    );
  const previous = await recover();
  if (previous) return previous;
  // A login may follow a lost guest response. Permit only recovery of that
  // existing owned intent; a fresh authenticated purchase uses normal checkout.
  if (actor)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Используйте оплату своего аккаунта",
    });
  const contactPhone = requireCheckoutContact(input.contactPhone);
  assertClubCheckoutConfigured(input.plan);
  // Preserve existing guest registration policy. No session, credentials or grant.
  const user = await ensureUserByEmail(input.email);
  try {
    return await database.transaction(
      async (tx) => {
        const current = await recipient(tx, user.id);
        if (normalizeEmail(current.email || "") !== input.email)
          throw conflict();
        await requireNormalCheckoutSchema(tx);
        const existing = await read(tx, key);
        if (existing) {
          // A different payload may win while email resolution is in progress.
          // Reject it before taking a second recipient lock.
          if (existing.actorUserId !== current.id) throw conflict();
          return replay(tx, existing, input);
        }
        const sum =
          input.plan === "semiannual" ? CLUB_SEMIANNUAL_PRICE : CLUB_PRICE;
        const amountMinor = moneyMinor(sum);
        if (!amountMinor) throw unavailable();
        const orderId = `${input.plan === "semiannual" ? "club6m" : "club"}-${current.id}-${randomUUID()}`;
        const url = buildCheckoutUrl({
          orderId,
          userId: current.id,
          email: input.email,
          plan: input.plan,
        });
        await tx
          .insert(clubPayments)
          .values({
            userId: current.id,
            orderId,
            email: input.email,
            sum,
            contactPhone,
          });
        await tx.insert(normalCheckoutRequests).values({
          requestKey: key,
          actorUserId: current.id,
          requestHash: payloadHash(input),
          orderId,
          amountMinor,
          merchantDomain: new URL(url).hostname,
          checkoutUrlHash: billingKeyForUrl(url),
        });
        return { state: "pending" as const, orderId, url };
      },
      { isolationLevel: "read committed" },
    );
  } catch (error) {
    // Different recipients can race on one pair: the unique ledger wins, the
    // losing order rolls back. Reconcile that winner without creating another.
    if (duplicate(error)) {
      const winner = await recover();
      if (winner) return winner;
    }
    throw error;
  }
}
