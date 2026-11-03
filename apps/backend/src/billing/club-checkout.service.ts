import { Injectable } from "@nestjs/common";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "node:crypto";
import type { User } from "../../../../packages/database/src/schema";
import { isValidEmail, normalizeEmail } from "../_core/password";
import * as db from "../db";
import { YookassaClubService } from "./yookassa/club.service";
import { ProdamusTestClubService } from "./prodamus-test-club.service";
import {
  assertClubCheckoutConfigured,
  buildCheckoutUrl,
  CLUB_PRICE,
  CLUB_SEMIANNUAL_PRICE,
} from "../prodamus";

import { contactPhoneSchema } from "../../../../packages/shared/src/checkout-contact";

export type ClubCheckoutInput = {
  contactPhone?: string;
  email?: string;
  plan?: "monthly" | "semiannual";
};

/** Starts/reconciles billing without issuing a session; access requires provider proof. */
@Injectable()
export class ClubCheckoutService {
  constructor(
    private readonly yookassa = new YookassaClubService(),
    private readonly prodamusTest = new ProdamusTestClubService(),
  ) {}
  reconcileCheckout(actor: User | null, intentKey: unknown) {
    // Return checking is test-only and can never fall back to payment creation.
    return this.yookassa.reconcileCheckout(actor, intentKey);
  }
  async createCheckout(
    actor: User | null,
    input?: ClubCheckoutInput,
    intentKey?: unknown,
  ): Promise<{ url: string; user: null }> {
    const email = normalizeEmail(input?.email || actor?.email || "");
    if (!isValidEmail(email)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Укажите почту для оплаты",
      });
    }
    if (actor && email !== normalizeEmail(actor.email || "")) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Используйте почту своего аккаунта",
      });
    }
    if (actor?.blockedAt) throw new TRPCError({ code: "FORBIDDEN" });
    const selected = process.env.YOOKASSA_TEST_ENABLED;
    const contact = contactPhoneSchema.safeParse(input?.contactPhone);
    if (selected !== "true" && !contact.success)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Укажите корректный номер телефона с кодом страны",
      });
    const contactPhone = contact.success ? contact.data : undefined;
    const existing = await db.getUserByEmail(email);
    if (actor?.blockedAt || existing?.blockedAt) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Не удалось создать платёж. Обратитесь в поддержку.",
      });
    }
    const plan = input?.plan ?? "monthly";
    const prodamusTest = process.env.PRODAMUS_TEST_ENABLED;
    if (prodamusTest && prodamusTest !== "false")
      return this.prodamusTest.createCheckout(
        email,
        actor || existing,
        plan,
        intentKey,
        contactPhone,
        actor,
      );
    if (selected && selected !== "false" && selected !== "true")
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Оплата не настроена",
      });
    if (selected === "true")
      return this.yookassa.createCheckout(
        actor || existing || null,
        email,
        plan,
        intentKey,
      );
    // A durable test caller must not silently switch provider (or recurrence)
    // when its deployment flag is missing/disabled.
    if (intentKey !== undefined)
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Тестовая оплата временно недоступна. Попробуйте позже.",
      });
    const guestRecovery = process.env.GUEST_CHECKOUT_RECOVERY_ENABLED;
    if (!actor && guestRecovery !== undefined && guestRecovery !== "false")
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Обновите страницу оплаты и повторите прежнюю заявку",
      });
    assertClubCheckoutConfigured(plan);
    // An email names the billing recipient, not a proven authenticated identity.
    const user =
      actor || existing || (await db.ensureUserByEmail(email, contactPhone));
    const orderId =
      plan === "semiannual"
        ? `club6m-${user.id}-${randomUUID()}`
        : `club-${user.id}-${randomUUID()}`;
    const url = buildCheckoutUrl({ orderId, email, userId: user.id, plan });
    await db.createClubPayment({
      userId: user.id,
      orderId,
      email,
      contactPhone,
      contactActor: actor ?? undefined,
      sum: plan === "semiannual" ? CLUB_SEMIANNUAL_PRICE : CLUB_PRICE,
    });
    return { url, user: null };
  }
}
