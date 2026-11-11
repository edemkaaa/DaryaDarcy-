/** Читает совместимые варианты полей Prodamus и различает paid, demo и действия подписки. */
import { asProdamusRecord as asRecord } from "./prodamus-payload";

export function pickString(
  body: Record<string, unknown>,
  keys: string[],
): string {
  for (const key of keys) {
    const value = body[key];
    if (value !== undefined && value !== null && String(value).trim())
      return String(value).trim();
  }
  const lower = new Map(
    Object.keys(body).map((key) => [key.toLowerCase(), body[key]]),
  );
  for (const key of keys) {
    const value = lower.get(key.toLowerCase());
    if (value !== undefined && value !== null && String(value).trim())
      return String(value).trim();
  }
  return "";
}

export function pickUserId(body: Record<string, unknown>): number | null {
  const direct =
    body._param_userId ?? body.userId ?? asRecord(body._param).userId;
  const parsed = Number(direct);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function isPaidStatus(body: Record<string, unknown>): boolean {
  const status = pickString(body, [
    "payment_status",
    "paymentStatus",
    "status",
  ]).toLowerCase();
  return status === "success";
}

/** Правильная подпись обычным ключом не превращает demo-платёж в реальную оплату. */
export function hasProdamusDemoMarker(body: Record<string, unknown>): boolean {
  const enabled = (record: Record<string, unknown>, names: string[]) =>
    Object.entries(record).some(
      ([name, value]) =>
        names.includes(name.toLowerCase()) &&
        value !== undefined &&
        value !== null &&
        value !== "" &&
        value !== 0 &&
        value !== "0" &&
        value !== false,
    );
  return (
    enabled(body, ["demo_mode", "demomode"]) ||
    enabled(asRecord(body.subscription), ["demo"])
  );
}

export function pickOrderId(body: Record<string, unknown>): string {
  const value = pickString(body, [
    "order",
    "order_num",
    "orderNum",
    "order_id",
    "orderId",
  ]);
  if (
    value.startsWith("club-") ||
    value.startsWith("club6m-") ||
    value.startsWith("shop-")
  )
    return value;
  return "";
}

export function subscriptionAction(body: Record<string, unknown>): string {
  const nested = asRecord(body.subscription);
  return pickString({ ...body, ...nested }, [
    "action_code",
    "actionCode",
    "action",
  ]).toLowerCase();
}
