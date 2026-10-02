import { createHmac, timingSafeEqual } from "node:crypto";
import type { Express, Request, Response } from "express";
import { ENV } from "./_core/env";
import * as db from "./db";

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
  return SHOP_PRODUCTS[productId] ?? null;
}

export function parseShopProductId(orderId: string): string | null {
  if (orderId.startsWith("shop-digital-1-")) return "digital-1";
  if (orderId.startsWith("shop-digital-2-")) return "digital-2";
  return null;
}

function publicSiteUrl(): string {
  const fromEnv = (ENV.publicAppUrl || "").replace(/\/$/, "");
  if (fromEnv.includes("daryadarcy.com")) return fromEnv;
  return "https://daryadarcy.com";
}

function getPayformUrl(): string {
  return (process.env.PRODAMUS_PAYFORM_URL || "https://daryadarcy-club.payform.ru").replace(/\/$/, "");
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

function stringifyValues(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stringifyValues);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = stringifyValues(nested);
    }
    return out;
  }
  if (value === null || value === undefined) return "";
  return String(value);
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as object).sort()) {
      out[key] = sortDeep((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

function toProdamusJson(value: unknown): string {
  return JSON.stringify(value).replace(/\//g, "\\/");
}

export function createProdamusSign(data: unknown, secret: string): string {
  const prepared = sortDeep(stringifyValues(data));
  return createHmac("sha256", secret).update(toProdamusJson(prepared), "utf8").digest("hex");
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
  const keys = [...new Set(secrets.flatMap((secret) => [secret, `${secret}demo`]))];
  return keys.some((key) => signsMatch(createProdamusSign(data, key), signature));
}

function encodeKey(key: string): string {
  return encodeURIComponent(key).replace(/%5B/gi, "[").replace(/%5D/gi, "]");
}

function buildQuery(data: Record<string, unknown>): string {
  const parts: string[] = [];
  const append = (key: string, value: unknown) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => append(`${key}[${index}]`, item));
      return;
    }
    if (typeof value === "object") {
      for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
        append(`${key}[${nestedKey}]`, nestedValue);
      }
      return;
    }
    parts.push(`${encodeKey(key)}=${encodeURIComponent(String(value))}`);
  };
  for (const [key, value] of Object.entries(data)) append(key, value);
  return parts.join("&");
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
  const appUrl = publicSiteUrl();
  const semiannual = input.plan === "semiannual" || input.orderId.startsWith("club6m-");
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
  // Price comes from products[].price (CLUB_PRICE); semiannual is a one-off, no subscription.
  if (subId && !semiannual) {
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
  // Prefer SBP in the payform when the method is enabled in the Prodamus cabinet.
  payload.payment_method = "sbp";
  return signedPayUrl(getPayformUrl(), payload);
}

export function buildShopCheckoutUrl(input: { productId: string; orderId: string; email?: string; userId?: number }): string | null {
  const product = SHOP_PRODUCTS[input.productId];
  if (!product) return null;
  const appUrl = publicSiteUrl();
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
  // Shop form is often left in Prodamus demo; the club form already takes live payments.
  const shopSecret = getShopSecret() || getSecret();
  const payform = getShopSecret() ? getShopPayformUrl() : getPayformUrl();
  const signKey = shopSecret ? (shopUsesDemoSign() ? `${shopSecret}demo` : shopSecret) : "";
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

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function nestPhpParams(flat: Record<string, string>): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const [rawKey, value] of Object.entries(flat)) {
    const keys = rawKey.replace(/\]/g, "").split("[");
    let current: Record<string, unknown> = root;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (i === keys.length - 1) {
        current[key] = value;
        break;
      }
      const next = current[key];
      if (!next || typeof next !== "object" || Array.isArray(next)) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }
  }
  return root;
}

function flattenQuery(query: Request["query"]): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") flat[key] = value;
    else if (Array.isArray(value) && typeof value[0] === "string") flat[key] = value[0];
  }
  return flat;
}

function parseWebhookPayload(req: Request): Record<string, unknown> {
  const fromQuery = nestPhpParams(flattenQuery(req.query));
  let raw = "";
  if (Buffer.isBuffer(req.body)) raw = req.body.toString("utf8");
  else if (typeof req.body === "string") raw = req.body;
  else if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
    return { ...fromQuery, ...asRecord(req.body) };
  }
  if (!raw.trim()) return fromQuery;
  try {
    return { ...fromQuery, ...asRecord(JSON.parse(raw)) };
  } catch {
    return { ...fromQuery, ...nestPhpParams(Object.fromEntries(new URLSearchParams(raw))) };
  }
}

function pickString(body: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = body[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  const lower = new Map(Object.keys(body).map((key) => [key.toLowerCase(), body[key]]));
  for (const key of keys) {
    const value = lower.get(key.toLowerCase());
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function pickUserId(body: Record<string, unknown>): number | null {
  const direct = body._param_userId ?? body.userId ?? asRecord(body._param).userId;
  const parsed = Number(direct);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isPaidStatus(body: Record<string, unknown>): boolean {
  const status = pickString(body, ["payment_status", "paymentStatus", "status"]).toLowerCase();
  return !status || status === "success" || status === "ok" || status === "paid";
}

function pickOrderId(body: Record<string, unknown>): string {
  for (const value of [
    pickString(body, ["order", "order_num", "orderNum", "order_id", "orderId"]),
  ]) {
    if (value.startsWith("club-") || value.startsWith("club6m-") || value.startsWith("shop-")) return value;
  }
  return "";
}

function subscriptionAction(body: Record<string, unknown>): string {
  const nested = asRecord(body.subscription);
  return pickString({ ...body, ...nested }, ["action_code", "actionCode", "action"]).toLowerCase();
}

export async function fulfillPaidOrder(orderId: string, extra?: { email?: string | null; sum?: string | null; userId?: number | null }): Promise<"club" | "shop" | null> {
  if (orderId.startsWith("club-") || orderId.startsWith("club6m-")) {
    let userId = extra?.userId ?? null;
    if (!userId) {
      const fromOrder = Number(orderId.split("-")[1]);
      if (Number.isFinite(fromOrder) && fromOrder > 0) userId = fromOrder;
    }
    const existing = await db.getClubPaymentByOrderId(orderId);
    if (!userId && existing) userId = existing.userId;
    if (!userId && extra?.email) {
      const user = await db.getUserByEmail(extra.email);
      if (user) userId = user.id;
    }
    if (!userId) return null;
    const expiresAt = await db.nextClubExpiry(userId, clubAccessMsForOrder(orderId));
    await db.markClubPaymentPaid({
      userId,
      orderId,
      email: extra?.email ?? existing?.email ?? null,
      sum: extra?.sum ?? CLUB_PRICE,
      expiresAt,
    });
    console.log("[prodamus] club access granted", userId, orderId);
    return "club";
  }

  const productId = parseShopProductId(orderId);
  if (productId) {
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

export async function deactivateClubByEmail(email: string): Promise<void> {
  const user = await db.getUserByEmail(email);
  if (!user) return;
  await db.cancelClubSubscription(user.id);
}

export async function cancelProdamusSubscription(email: string): Promise<boolean> {
  const subId = subscriptionId();
  const secret = getSecret();
  if (!subId || !secret || !email) return false;
  const data: Record<string, unknown> = {
    subscription: subId,
    customer_email: email,
    active_user: "0",
  };
  data.signature = createProdamusSign(data, secret);
  const url = `${getPayformUrl()}/rest/setActivity/`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: buildQuery(data),
    });
    const text = await response.text();
    console.log("[prodamus] setActivity", response.status, text.slice(0, 200));
    return response.ok;
  } catch (error) {
    console.warn("[prodamus] setActivity failed", error);
    return false;
  }
}

export async function handleProdamusReturn(req: Request, res: Response) {
  const body = parseWebhookPayload(req);
  const orderId = pickOrderId({ ...asRecord(req.query), ...body }) || pickString(asRecord(req.query), ["order"]);
  try {
    if (orderId) {
      await fulfillPaidOrder(orderId, {
        email: pickString(body, ["customer_email", "customerEmail"]).toLowerCase() || null,
        sum: pickString(body, ["sum"]) || null,
      });
    }
  } catch (error) {
    console.error("[prodamus] return fulfill failed", error);
  }
  const appUrl = publicSiteUrl();
  const productId = parseShopProductId(orderId);
  const dest = productId ? `${appUrl}/shop/${productId}?paid=1` : `${appUrl}/club?paid=1`;
  res.redirect(302, dest);
}

export async function handleProdamusWebhook(req: Request, res: Response) {
  try {
    const body = parseWebhookPayload(req);
    const signature = headerSign(req) || pickString(body, ["signature", "sign"]);
    const signed = signature ? verifyProdamusSign(body, signature) : false;
    const action = subscriptionAction(body);
    console.log("[prodamus] webhook", req.method, {
      keys: Object.keys(body).slice(0, 20),
      orderId: pickOrderId(body),
      signed,
      action,
      status: pickString(body, ["payment_status", "paymentStatus", "status"]) || "(empty)",
    });

    if (action === "deactivation" || action === "finish") {
      const email = pickString(body, ["customer_email", "customerEmail"]).toLowerCase();
      if (email) await deactivateClubByEmail(email);
      res.status(200).send("cancelled");
      return;
    }

    const email = pickString(body, ["customer_email", "customerEmail"]).toLowerCase();
    const userId = pickUserId(body);
    const sum = pickString(body, ["sum"]) || null;
    let orderId = pickOrderId(body);

    if (action === "auto_payment") {
      let uid = userId;
      if (!uid && email) {
        const user = await db.getUserByEmail(email);
        if (user) uid = user.id;
      }
      if (uid) {
        if (!signed) {
          const existing = await db.getActiveClubSubscription(uid);
          if (!existing) {
            console.warn("[prodamus] unsigned auto_payment for unknown subscriber", uid);
            res.status(400).send("signature incorrect");
            return;
          }
        }
        const stamp = pickString(body, ["order_id", "orderId"]) || String(Date.now());
        orderId = `club-${uid}-renew-${stamp}`;
        const granted = await fulfillPaidOrder(orderId, { email: email || null, sum, userId: uid });
        res.status(200).send(granted ? "success" : "ignored");
        return;
      }
      console.warn("[prodamus] auto_payment without user", { email, userId });
      res.status(200).send("ignored");
      return;
    }

    if (!isPaidStatus(body)) {
      res.status(200).send("ignored");
      return;
    }

    if (!orderId) {
      res.status(200).send("ignored");
      return;
    }

    if (!signed) {
      const pendingClub = orderId.startsWith("club-") ? await db.getClubPaymentByOrderId(orderId) : null;
      const pendingShop = orderId.startsWith("shop-") ? await db.getShopPurchaseByOrderId(orderId) : null;
      const pending = pendingClub || pendingShop;
      if (!pending || pending.status !== "pending") {
        console.warn("[prodamus] bad signature and unknown order", orderId);
        res.status(400).send("signature incorrect");
        return;
      }
      console.warn("[prodamus] unsigned webhook for known pending order", orderId);
    }

    const granted = await fulfillPaidOrder(orderId, {
      email: email || null,
      sum,
      userId,
    });
    res.status(200).send(granted ? "success" : "ignored");
  } catch (error) {
    console.error("[prodamus] webhook failed", error);
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
    void (async () => {
      const productId = String(req.params.productId || "");
      const product = getShopProduct(productId);
      if (!product) {
        res.status(404).send("unknown product");
        return;
      }
      const orderId = `shop-${productId}-${Date.now()}`;
      await db.createShopPurchase({ productId, orderId });
      const url = buildShopCheckoutUrl({ productId, orderId });
      if (!url) {
        res.status(404).send("unknown product");
        return;
      }
      res.redirect(302, url);
    })().catch((error) => {
      console.error("[prodamus] shop pay redirect failed", error);
      res.status(500).send("error");
    });
  });
}
