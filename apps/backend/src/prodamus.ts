import { randomUUID, timingSafeEqual } from "node:crypto";
import { TRPCError } from "@trpc/server";
import type { Express, Request, Response } from "express";
import { publicAccessUrl } from "./identity/urls";
import { getCapabilities } from "./launch/capabilities";
import * as db from "./db";
import { moneyMinor, type PaymentProof } from "./billing/protocol";
import { confirmProviderCancellation, type Profile } from "./billing/cancellation";
import { createProdamusSign } from "./billing/prodamus-signature";
import { buildProdamusQuery as buildQuery } from "./billing/prodamus-query";
import { asProdamusRecord as asRecord, parseProdamusPayload } from "./billing/prodamus-payload";
import { isPaidStatus, pickOrderId, pickString, subscriptionAction } from "./billing/prodamus-fields";
import { readProdamusPayment } from "./billing/prodamus-payment";

export { createProdamusSign } from "./billing/prodamus-signature";

const PRODUCT_NAME = "Подписка Клуб Darcy";
export const CLUB_PRICE = (process.env.CLUB_PRICE || "790").trim() || "790";
export const CLUB_SEMIANNUAL_PRICE = (process.env.CLUB_SEMIANNUAL_PRICE || "4740").trim() || "4740";
const ACCESS_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
const SEMIANNUAL_ACCESS_MS = 180 * 24 * 60 * 60 * 1000;

export function clubAccessMsForOrder(orderId: string): number {
  if (orderId.startsWith("club6m-")) return SEMIANNUAL_ACCESS_MS;
  return ACCESS_PERIOD_MS;
}

const SHOP_PRODUCTS: Record<string, { name: string; price: string }> = {
  "digital-1": { name: "Пособие по атмосферной фотографии", price: (process.env.SHOP_DIGITAL_1_PRICE || "50").trim() || "50" },
  "digital-2": { name: "Винтажные книги и открытки", price: (process.env.SHOP_DIGITAL_2_PRICE || "50").trim() || "50" },
};

export function clubAccessMs(): number {
  return ACCESS_PERIOD_MS;
}

export function getShopProduct(productId: string) {
  return Object.hasOwn(SHOP_PRODUCTS, productId) ? SHOP_PRODUCTS[productId] : null;
}

export function parseShopProductId(orderId: string): string | null {
  if (orderId.startsWith("shop-digital-1-")) return "digital-1";
  if (orderId.startsWith("shop-digital-2-")) return "digital-2";
  return null;
}

function publicSiteUrl(): string {
  return publicAccessUrl().origin;
}

function getPayformUrl(): string {
  return (process.env.PRODAMUS_PAYFORM_URL || "https://daryadarcy-club.payform.ru")
    .trim()
    .replace(/\/$/, "");
}

function getShopPayformUrl(): string {
  return (process.env.PRODAMUS_SHOP_PAYFORM_URL || "https://daryadarcy.payform.ru").replace(/\/$/, "");
}

function getSecret(): string {
  return (process.env.PRODAMUS_SECRET || "").trim();
}

function getShopSecret(): string {
  return (process.env.PRODAMUS_SHOP_SECRET || "").trim();
}

function shopUsesDemoSign(): boolean {
  const raw = (process.env.PRODAMUS_SHOP_DEMO || "0").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "on";
}

function subscriptionId(): string {
  return (process.env.PRODAMUS_SUBSCRIPTION_ID || "").trim();
}

/** Checkout must fail before creating a billing recipient or pending order. */
export function assertClubCheckoutConfigured(
  plan: "monthly" | "semiannual",
): void {
  try {
    // No implicit live merchant, unsigned link, or injected payform parameters.
    const form = new URL((process.env.PRODAMUS_PAYFORM_URL || "").trim());
    if (
      form.protocol !== "https:" ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.payform\.ru$/.test(form.hostname) ||
      form.username ||
      form.password ||
      form.port ||
      form.pathname !== "/" ||
      form.search ||
      form.hash ||
      !getSecret() ||
      moneyMinor(plan === "semiannual" ? CLUB_SEMIANNUAL_PRICE : CLUB_PRICE) ===
        null ||
      (plan === "monthly" && !/^[1-9]\d*$/.test(subscriptionId()))
    ) {
      throw new Error();
    }
    publicSiteUrl();
  } catch {
    // Configuration may contain secrets: never expose the rejected value or cause.
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Оплата временно недоступна. Попробуйте позже.",
    });
  }
}

function signsMatch(expected: string, received: string): boolean {
  const a = Buffer.from(expected.toLowerCase());
  const b = Buffer.from(received.toLowerCase());
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function getSubscriptionSecret(): string {
  return (process.env.PRODAMUS_SUBSCRIPTION_SECRET || "").trim();
}

export function verifyProdamusSign(data: unknown, signature: string): boolean {
  if (!signature) return false;
  const secrets = [getSecret(), getShopSecret(), getSubscriptionSecret()].filter(Boolean);
  // Demo notifications must never create production entitlements.
  const keys = [...new Set(secrets)];
  return keys.some((key) => signsMatch(createProdamusSign(data, key), signature));
}

function paidContent(text: string): string {
  return text.slice(0, 4096);
}

export function buildCheckoutUrl(input: {
  orderId: string;
  email: string;
  userId: number;
  plan?: "monthly" | "semiannual";
}): string {
  const semiannual = input.plan === "semiannual" || input.orderId.startsWith("club6m-");
  assertClubCheckoutConfigured(semiannual ? "semiannual" : "monthly");
  const appUrl = publicSiteUrl();
  const price = semiannual ? CLUB_SEMIANNUAL_PRICE : CLUB_PRICE;
  const productLabel = semiannual
    ? `${PRODUCT_NAME} — 6 месяцев (зарубежные карты)`
    : PRODUCT_NAME;
  const payload: Record<string, unknown> = {
    do: "pay",
    order_id: input.orderId,
    customer_email: input.email,
    urlSuccess: `${appUrl}/api/prodamus/return?order=${encodeURIComponent(input.orderId)}`,
    urlReturn: `${appUrl}/club`,
    urlNotification: `${appUrl}/api/prodamus/webhook`,
    callbackType: "json",
    sys: process.env.PRODAMUS_SYS || "daryadarcy",
    _param_userId: String(input.userId),
    customer_extra: "Клуб Darcy",
    sum: price,
    currency: "rub",
    paid_content: paidContent(
      semiannual
        ? `Спасибо за оплату «${productLabel}» за ${price} рублей. ` +
            `Доступ к материалам клуба откроется на 6 месяцев на ${appUrl}/club. ` +
            `Войдите с той же почтой: ${input.email}. Страница входа: ${appUrl}/login`
        : `Спасибо за оплату «${PRODUCT_NAME}» за ${CLUB_PRICE} рублей. ` +
            `Доступ к материалам клуба откроется автоматически на сайте ${appUrl}/club сразу после оплаты. ` +
            `Войдите с той же почтой, с которой оплачивали: ${input.email}. ` +
            `Страница входа: ${appUrl}/login`,
    ),
  };
  const subId = subscriptionId();
  // Monthly club checkout must include subscription id so Prodamus creates autopayments.
  // Prodamus ignores products for subscriptions: the cabinet price must match CLUB_PRICE.
  // Semiannual is a one-off payment priced by products[].price.
  if (!semiannual) {
    payload.subscription = subId;
  }
  payload.products = [
    {
      name: productLabel,
      price,
      quantity: "1",
      type: "service",
    },
  ];
  // SBP is Russian-only; let the foreign-card plan offer the merchant's available methods.
  if (!semiannual) payload.payment_method = "SBP";
  return signedPayUrl(getPayformUrl(), payload);
}

function shopCheckoutConfiguration(price: string) {
  try {
    const dedicatedSecret = getShopSecret();
    const secret = dedicatedSecret || getSecret();
    const explicitForm = dedicatedSecret
      ? process.env.PRODAMUS_SHOP_PAYFORM_URL
      : process.env.PRODAMUS_PAYFORM_URL;
    const form = new URL(dedicatedSecret ? getShopPayformUrl() : getPayformUrl());
    // Preserve the existing merchant selection, but never its implicit live defaults.
    if (
      !explicitForm?.trim() ||
      !secret ||
      form.protocol !== "https:" ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.payform\.ru$/.test(form.hostname) ||
      form.username ||
      form.password ||
      form.port ||
      form.pathname !== "/" ||
      form.search ||
      form.hash ||
      moneyMinor(price) === null
    ) {
      throw new Error();
    }
    return {
      payform: form.origin,
      signKey: shopUsesDemoSign() ? `${secret}demo` : secret,
      appUrl: publicSiteUrl(),
    };
  } catch {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Оплата временно недоступна. Попробуйте позже.",
    });
  }
}

export function buildShopCheckoutUrl(input: { productId: string; orderId: string; email?: string; userId?: number }): string | null {
  const product = getShopProduct(input.productId);
  if (!product) return null;
  const { appUrl, payform, signKey } = shopCheckoutConfiguration(product.price);
  const payload: Record<string, unknown> = {
    do: "pay",
    order_id: input.orderId,
    products: [
      {
        name: product.name,
        price: product.price,
        quantity: "1",
        type: "goods",
      },
    ],
    urlSuccess: `${appUrl}/api/prodamus/return?order=${encodeURIComponent(input.orderId)}`,
    urlReturn: `${appUrl}/shop/${input.productId}`,
    urlNotification: `${appUrl}/api/prodamus/webhook`,
    callbackType: "json",
    customer_extra: product.name,
    paid_content: paidContent(
      `Спасибо за покупку «${product.name}» за ${product.price} рублей. ` +
        `Материал доступен на сайте ${appUrl}/shop/${input.productId} сразу после оплаты. ` +
        (input.email
          ? `Войдите с почтой ${input.email}: ${appUrl}/login`
          : `Войдите или зарегистрируйтесь: ${appUrl}/login`),
    ),
  };
  if (input.email) payload.customer_email = input.email;
  if (input.userId) payload._param_userId = String(input.userId);
  return signedPayUrl(payform, payload, signKey);
}

function signedPayUrl(payformUrl: string, payload: Record<string, unknown>, secret = getSecret()): string {
  const data = { ...payload };
  if (secret) {
    data.signature = createProdamusSign(data, secret);
  }
  return `${payformUrl}/?${buildQuery(data)}`;
}

function headerSign(req: Request): string {
  const raw = req.headers.sign || req.headers.Sign || req.headers["x-sign"];
  if (Array.isArray(raw)) return String(raw[0] || "");
  return String(raw || "");
}

export async function fulfillPaidOrder(orderId: string, extra?: { email?: string | null; sum?: string | null; userId?: number | null; proof?:PaymentProof;recurring?:boolean }): Promise<"club" | "shop" | null> {
  if (orderId.startsWith("club-") || orderId.startsWith("club6m-")) {
    const granted = await db.settleClubPayment({ orderId,
      periodMs: clubAccessMsForOrder(orderId), sum: extra?.sum,proof:extra?.proof,recurring:extra?.recurring });
    return granted ? "club" : null;
  }

  const productId = parseShopProductId(orderId);
  if (productId) {
    if (!getCapabilities().shopOnlinePayment) return null;
    let userId = extra?.userId ?? null;
    const existing = await db.getShopPurchaseByOrderId(orderId);
    if (!userId && existing?.userId) userId = existing.userId;
    if (!userId && extra?.email) {
      const user = await db.getUserByEmail(extra.email);
      if (user) userId = user.id;
    }
    await db.markShopPurchasePaid({
      userId,
      productId,
      orderId,
      email: extra?.email ?? existing?.email ?? null,
      sum: extra?.sum ?? getShopProduct(productId)?.price ?? null,
    });
    const buyerEmail = (extra?.email ?? existing?.email ?? "").trim();
    if (buyerEmail) {
      const { deliverShopPurchase } = await import("./shop-delivery");
      await deliverShopPurchase({ orderId, productId, email: buyerEmail, userId: userId ?? null });
    } else {
      console.warn("[prodamus] shop purchase paid but no buyer email", orderId, productId);
    }
    console.log("[prodamus] shop purchase granted", productId, orderId);
    return "shop";
  }
  return null;
}

export async function cancelProdamusSubscription(profile:Profile): Promise<boolean> {
  const subId = profile.subscriptionId;
  const secret = getSecret();
  const configured=new URL(getPayformUrl());
  if (!subId || subId!==subscriptionId() || !secret || !profile.profileId || profile.domain!==configured.hostname) return false;
  if(configured.protocol!=="https:" && !(process.env.NODE_ENV!=="production" && ["127.0.0.1","localhost"].includes(configured.hostname))) return false;
  const data: Record<string, unknown> = {
    subscription: subId,
    profile: profile.profileId,
    [profile.manager?"active_manager":"active_user"]: "0",
  };
  data.signature = createProdamusSign(data, secret);
  const url = `${getPayformUrl()}/rest/setActivity/`;
  try {
    const response = await fetch(url, {
      method: "POST",
      // Only the configured endpoint may receive or confirm this signed request.
      redirect: "error",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: buildQuery(data),
      signal: AbortSignal.timeout(10000),
    });
    const text = await response.text();
    return response.ok && text.trim()==="success";
  } catch (error) {
    console.warn("[prodamus] setActivity failed");
    return false;
  }
}

export async function handleProdamusReturn(req: Request, res: Response) {
  const body = parseProdamusPayload(req.query, req.body);
  const orderId = pickOrderId({ ...asRecord(req.query), ...body }) || pickString(asRecord(req.query), ["order"]);
  // Browser navigation is not proof of payment. paid=1 only triggers UI polling.
  let appUrl: string;
  try {
    appUrl = publicSiteUrl();
  } catch {
    res.status(503).send("payment return unavailable");
    return;
  }
  const productId = parseShopProductId(orderId);
  const dest = productId ? `${appUrl}/shop/${productId}?paid=1` : `${appUrl}/club?paid=1`;
  res.redirect(302, dest);
}

export async function handleProdamusWebhook(req: Request, res: Response) {
  try {
    const body = parseProdamusPayload(req.query, req.body);
    const signature = headerSign(req) || pickString(body, ["signature", "sign"]);
    const signed = signature ? verifyProdamusSign(body, signature) : false;
    if (!signed) {
      res.status(400).send("signature incorrect");
      return;
    }
    const action = subscriptionAction(body);
    console.log("[prodamus] webhook", req.method, {
      keys: Object.keys(body).slice(0, 20),
      orderId: pickOrderId(body),
      signed,
      action,
      status: pickString(body, ["payment_status", "paymentStatus", "status"]) || "(empty)",
    });

    if (action === "deactivation" || action === "finish") {
      const subscription=asRecord(body.subscription);
      const domain=pickString(body,["domain"]).toLowerCase();
      const key=getSubscriptionSecret()||getSecret();
      if(!key || !signsMatch(createProdamusSign(body,key),signature) || domain!==new URL(getPayformUrl()).hostname || pickString(subscription,["id"])!==subscriptionId() || !pickString(subscription,["profile_id"])) {res.status(422).send("profile binding invalid");return;}
      const database=await db.getDb();if(!database) throw new Error("Database unavailable");
      const confirmed=await confirmProviderCancellation(database,{domain,subscriptionId:pickString(subscription,["id"]),profileId:pickString(subscription,["profile_id"])});
      res.status(confirmed?200:422).send(confirmed?"cancelled":"profile binding invalid");
      return;
    }

    if (!isPaidStatus(body)) {
      res.status(200).send("ignored");
      return;
    }

    const { email, userId, sum, orderId, proof } = readProdamusPayment(body);
    const { domain } = proof;
    const isClub=action==="auto_payment" || orderId.startsWith("club-") || orderId.startsWith("club6m-");
    if(isClub) {
      const allowedDomain=new URL(getPayformUrl()).hostname;
      const key=action==="auto_payment"?(getSubscriptionSecret()||getSecret()):getSecret();
      if(domain!==allowedDomain || !key || !signsMatch(createProdamusSign(body,key),signature) || !proof.paymentId || proof.currency.toLowerCase()!=="rub" || (proof.subscriptionId && proof.subscriptionId!==subscriptionId()) || (proof.subscriptionId && !/^\d{1,64}$/.test(proof.profileId||"")) || (subscriptionId() && !orderId.startsWith("club6m-") && !proof.subscriptionId)) {
        res.status(422).send("payment binding invalid");return;
      }
    }

    if (action === "auto_payment") {
      const granted=await fulfillPaidOrder("club-renew",{email,sum,proof,recurring:true});
      res.status(granted?200:422).send(granted?"success":"payment binding invalid");
      return;
    }

    if (!orderId) {
      res.status(200).send("ignored");
      return;
    }

    const granted = await fulfillPaidOrder(orderId, {
      email: email || null,
      sum,
      userId,
      proof,
    });
    res.status(granted?200:422).send(granted ? "success" : "payment binding invalid");
  } catch (error) {
    // Drizzle errors can embed parameterized mail payloads and recipient data.
    console.error("[prodamus] webhook failed");
    res.status(500).send("error");
  }
}

export function registerProdamusRoutes(app: Express) {
  app.get("/api/prodamus/return", (req, res) => {
    void handleProdamusReturn(req, res);
  });
  app.post("/api/prodamus/return", (req, res) => {
    void handleProdamusReturn(req, res);
  });
  app.get("/api/pay/:productId", (req, res) => {
    if (!getCapabilities().shopOnlinePayment) { res.status(503).json({ code: "FEATURE_DISABLED", error: "Онлайн-оплата магазина пока недоступна" }); return; }
    void (async () => {
      const productId = String(req.params.productId || "");
      const product = getShopProduct(productId);
      if (!product) {
        res.status(404).send("unknown product");
        return;
      }
      const orderId = `shop-${productId}-${randomUUID()}`;
      const url = buildShopCheckoutUrl({ productId, orderId });
      if (!url) {
        res.status(404).send("unknown product");
        return;
      }
      await db.createShopPurchase({ productId, orderId });
      res.redirect(302, url);
    })().catch(() => {
      // Database errors can include recipient data and payment parameters.
      console.error("[prodamus] shop pay redirect failed");
      res.status(500).send("error");
    });
  });
}
