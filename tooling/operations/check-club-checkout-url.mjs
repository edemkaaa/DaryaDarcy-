// Собирает диагностический подписанный payload из настроек Prodamus, не выполняя оплату. Пример ссылки не подтверждает боевой тариф или автопродление.
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const env = {};
for (const line of readFileSync(resolve(root, ".env"), "utf8").split("\n")) {
  if (line && !line.startsWith("#") && line.includes("=")) {
    const [k, ...rest] = line.split("=");
    env[k.trim()] = rest.join("=").trim();
  }
}

const CLUB_PRICE = (env.CLUB_PRICE || "790").trim();
const subId = (env.PRODAMUS_SUBSCRIPTION_ID || "").trim();
const secret = (env.PRODAMUS_SECRET || "").trim();
const payform = (env.PRODAMUS_PAYFORM_URL || "https://daryadarcy-club.payform.ru").replace(/\/$/, "");

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = sortDeep(value[key]);
    return out;
  }
  return value;
}
function stringifyValues(value) {
  if (Array.isArray(value)) return value.map(stringifyValues);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = stringifyValues(v);
    return out;
  }
  if (value === null || value === undefined) return "";
  return String(value);
}
function sign(data) {
  const prepared = sortDeep(stringifyValues(data));
  const json = JSON.stringify(prepared).replace(/\//g, "\\/");
  return createHmac("sha256", secret).update(json, "utf8").digest("hex");
}

const payload = {
  do: "pay",
  order_id: "club-test-123",
  customer_email: "test@example.com",
  sum: CLUB_PRICE,
  currency: "rub",
  products: [{ name: "Подписка Клуб Darcy", price: CLUB_PRICE, quantity: "1", type: "service" }],
};
if (subId) payload.subscription = subId;

const signature = sign(payload);
const params = new URLSearchParams();
for (const [k, v] of Object.entries(payload)) {
  if (typeof v === "object") params.set(k, JSON.stringify(v));
  else params.set(k, String(v));
}
params.set("signature", signature);

console.log("CLUB_PRICE:", CLUB_PRICE);
console.log("PRODAMUS_SUBSCRIPTION_ID:", subId || "(empty)");
console.log("subscription in checkout payload:", "subscription" in payload ? payload.subscription : "NO — not attached");
console.log("payform URL sample:", `${payform}/?${params.toString().slice(0, 120)}...`);
