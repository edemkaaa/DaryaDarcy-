import { TRPCError } from "@trpc/server";
import { randomUUID } from "node:crypto";
import type { User } from "../../../../packages/database/src/schema";
import * as db from "../db";
import {
  createProdamusSign,
  verifyProdamusSignature,
} from "./prodamus-signature";
import { parseProdamusPayload } from "./prodamus-payload";
import { buildProdamusQuery } from "./prodamus-query";
import { readProdamusPayment } from "./prodamus-payment";
import { moneyMinor, type PaymentProof } from "./protocol";
import { clubAccessMs } from "./club-settlement.service";
import {
  createProdamusTestReturnProof,
  prodamusTestOrderPattern,
  readProdamusTestResult,
} from "./prodamus-test-result";

const merchant = "https://testpage1.payform.ru";
const application = "https://daryadarcy.dev.reeskeen.ru";
const unavailable = "Тестовая оплата Prodamus не настроена";
const productName = "Клуб Darcy — ТЕСТ, 30 дней без автосписаний";

const notificationMinor = (value: unknown) =>
  typeof value === "string" || typeof value === "number"
    ? moneyMinor(String(value))
    : null;

/** Original signed sum/products bind the RUB order; no guessed FX conversion. */
function testAccountingProof(
  body: Record<string, unknown>,
  proof: PaymentProof,
): PaymentProof | null {
  const currency = proof.currency.toLowerCase();
  if (currency === "rub") return proof;
  if (
    currency !== "eur" &&
    currency !== "usd" &&
    currency !== "kzt" &&
    currency !== "byn"
  )
    return null;
  const amount = notificationMinor(body.currency_sum);
  const products = body.products;
  if (amount === null || !Array.isArray(products) || products.length !== 1)
    return null;
  const product = products[0];
  if (
    !product ||
    typeof product !== "object" ||
    Array.isArray(product) ||
    product.name !== productName ||
    notificationMinor(product.price) !== 79000 ||
    notificationMinor(product.sum) !== 79000 ||
    (product.quantity !== "1" && product.quantity !== 1)
  )
    return null;
  return {
    ...proof,
    currency: "rub",
    testForeignPayment: { currency, amountMinor: amount },
  };
}

/** Exclusive dev binding; never falls back to a live key/merchant or YooKassa. */
export function requireProdamusTestConfiguration() {
  const key = process.env.PRODAMUS_TEST_SECRET || "";
  const demoSign = process.env.PRODAMUS_TEST_DEMO_SIGN;
  if (
    process.env.PRODAMUS_TEST_ENABLED !== "true" ||
    process.env.PRODAMUS_TEST_PAYFORM_URL !== merchant ||
    process.env.PUBLIC_APP_URL !== application ||
    ![undefined, "", "false"].includes(process.env.YOOKASSA_TEST_ENABLED) ||
    !/^[a-f0-9]{64}$/i.test(key) ||
    (demoSign !== undefined && demoSign !== "false" && demoSign !== "true")
  )
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: unavailable });
  return { key, signingKey: demoSign === "true" ? `${key}demo` : key };
}

/** Dev-only one-off access; diagnostic and live receivers remain unchanged. */
export class ProdamusTestClubService {
  async result(token: string) {
    const configured = requireProdamusTestConfiguration();
    return readProdamusTestResult(token, configured.key);
  }
  async createCheckout(
    email: string,
    existing: User | null | undefined,
    plan: "monthly" | "semiannual",
    intentKey?: unknown,
    contactPhone?: string,
    contactActor?: User | null,
  ) {
    const configured = requireProdamusTestConfiguration();
    if (plan !== "monthly" || intentKey !== undefined)
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: unavailable,
      });
    const user = existing || (await db.ensureUserByEmail(email));
    const orderId = `club-test-${user.id}-${randomUUID()}`;
    const payload = {
      do: "pay",
      demo_mode: "1",
      order_id: orderId,
      customer_email: email,
      currency: "rub",
      sum: "790.00",
      products: [
        {
          name: productName,
          price: "790.00",
          quantity: "1",
          type: "service",
        },
      ],
      payments_limit: "1",
      callbackType: "json",
      urlReturn: `${application}/club`,
      urlSuccess: `${application}/club?paid=1#paymentReturn=${createProdamusTestReturnProof(orderId, configured.key)}`,
      // Cabinet-level notification URL: no invented SYS/per-link routing.
    };
    const url = `${merchant}/?${buildProdamusQuery({ ...payload, signature: createProdamusSign(payload, configured.signingKey) })}`;
    await db.createClubPayment({
      userId: user.id,
      orderId,
      email,
      contactPhone,
      contactActor: contactActor ?? undefined,
      sum: "790.00",
    });
    return { url, user: null } as const;
  }

  async notification(
    raw: unknown,
    signature: unknown,
  ): Promise<{ status: number; body: string }> {
    let configured: ReturnType<typeof requireProdamusTestConfiguration>;
    try {
      configured = requireProdamusTestConfiguration();
    } catch {
      return { status: 503, body: "test payment unavailable" };
    }
    const invalid = { status: 400, body: "invalid test notification" };
    if (
      (!Buffer.isBuffer(raw) && typeof raw !== "string") ||
      typeof signature !== "string"
    )
      return invalid;
    let body: Record<string, unknown>;
    try {
      body = parseProdamusPayload({}, raw);
      if (
        !verifyProdamusSignature(body, signature, [
          configured.key,
          `${configured.key}demo`,
        ])
      )
        return invalid;
    } catch {
      return invalid;
    }
    const payment = readProdamusPayment(body);
    const proof = testAccountingProof(body, payment.proof);
    if (
      (body.demo_mode !== "1" && body.demo_mode !== 1) ||
      Object.keys(body).some(
        (name) =>
          /^(demo_?mode|subscription)$/i.test(name) && name !== "demo_mode",
      ) ||
      payment.proof.domain !== "testpage1.payform.ru" ||
      !prodamusTestOrderPattern.test(payment.orderId) ||
      !/^[1-9]\d{0,31}$/.test(payment.proof.paymentId) ||
      !proof ||
      moneyMinor(payment.sum) !== 79000 ||
      (body.payment_init !== undefined && body.payment_init !== "manual") ||
      (body.subscription_action !== undefined &&
        body.subscription_action !== "") ||
      !["success", "pending", "order_canceled", "order_denied"].includes(
        String(body.payment_status),
      )
    )
      return invalid;
    if (body.payment_status !== "success")
      return { status: 200, body: "ignored" };
    try {
      const granted = await db.settleClubPayment({
        orderId: payment.orderId,
        periodMs: clubAccessMs(),
        sum: payment.sum,
        proof,
      });
      return granted ? { status: 200, body: "success" } : invalid;
    } catch {
      console.warn("[ProdamusTest] Settlement failed");
      return { status: 500, body: "test settlement failed" };
    }
  }
}
