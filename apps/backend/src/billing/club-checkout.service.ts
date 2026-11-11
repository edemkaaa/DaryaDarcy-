/** Оркестрация запуска и проверки оплаты; создание заказа само по себе не выдаёт сессию или доступ. */
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

/** Запускает и согласует оплату без выдачи сессии; доступ требует доказательства провайдера. */
@Injectable()
export class ClubCheckoutService {
  /** Связывает два независимых TEST-провайдера с оркестратором без автоматического переключения при отказе. */
  constructor(
    private readonly yookassa = new YookassaClubService(),
    private readonly prodamusTest = new ProdamusTestClubService(),
  ) {}
  /** Только проверяет существующий TEST-intent YooKassa; не создаёт оплату и не подменяет неизвестный результат новым заказом. */
  reconcileCheckout(actor: User | null, intentKey: unknown) {
    // Проверка return относится только к TEST и не может незаметно создать новую оплату.
    return this.yookassa.reconcileCheckout(actor, intentKey);
  }
  /** Валидирует email/контакт/actor и выбирает точный TEST или обычный режим; создаёт pending-заказ и ссылку без выдачи сессии или доступа. */
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
    // При отсутствии TEST-флага долговечный клиент не должен незаметно
    // переключаться на другого провайдера или другой режим повторных списаний.
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
    // Email определяет получателя оплаты, но не доказывает аутентифицированную личность.
    const user =
      actor || existing || (await db.ensureUserByEmail(email));
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
