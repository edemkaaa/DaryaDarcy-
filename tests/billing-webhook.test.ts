import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

// Only persistence is replaced: the real parser, signature check and HTTP handlers run.
const state = vi.hoisted(() => ({
  paid: false,
  cancelled: false,
  failDatabase: false,
}));
vi.mock("../apps/backend/src/db", () => ({
  /** Подменяет lookup ожидающего клубного заказа фиксированным synthetic-получателем. */
  getClubPaymentByOrderId: async () => ({
    userId: 7,
    email: "member@example.test",
    status: "pending",
  }),
  /** Подменяет lookup заказа магазина отсутствующим результатом, исключая shop-ветку сценария. */
  getShopPurchaseByOrderId: async () => undefined,
  /** Возвращает synthetic-пользователя привязанной почты без реальной базы. */
  getUserByEmail: async () => ({ id: 7 }),
  /** Подменяет lookup оплаченного периода только для изолированной проверки ingress-политики. */
  getActiveClubSubscription: async () => ({ userId: 7, status: "paid" }),
  /** Возвращает известную дату продления без SQL-записи. */
  nextClubExpiry: async () => new Date("2026-11-01T00:00:00Z"),
  /** Фиксирует legacy-отметку оплаты в памяти для обнаружения недопустимого побочного эффекта. */
  markClubPaymentPaid: async () => {
    state.paid = true;
  },
  /** Фиксирует settlement либо бросает чувствительную synthetic-ошибку для проверки безопасного логирования. */
  settleClubPayment: async () => {
    if (state.failDatabase) throw new Error("test-only-sensitive-sql-value");
    state.paid = true;
    return true;
  },
  /** Фиксирует попытку отмены в памяти без реального провайдера. */
  cancelClubSubscription: async () => {
    state.cancelled = true;
  },
}));
import {
  createProdamusSign,
  handleProdamusReturn,
  handleProdamusWebhook,
} from "../apps/backend/src/prodamus";

const payment = {
  order_id: "300155",
  order_num: "club-7-100",
  domain: "daryadarcy-club.payform.ru",
  sum: "790.00",
  currency: "rub",
  customer_email: "member@example.test",
  payment_status: "success",
  products: [{ name: "Клуб", price: "790.00", quantity: "1", sum: "790.00" }],
};
/** Создаёт минимальный Express-response double с наблюдаемыми status, body и redirect. */
function response() {
  const result = { status: 200, body: "", location: "" };
  const res = {
    /** Запоминает HTTP-статус и сохраняет chainable-контракт response double. */
    status(code: number) {
      result.status = code;
      return this;
    },
    /** Запоминает тело ответа и сохраняет chainable-контракт response double. */
    send(body: string) {
      result.body = body;
      return this;
    },
    /** Запоминает HTTP-redirect без открытия внешнего адреса. */
    redirect(code: number, url: string) {
      result.status = code;
      result.location = url;
    },
  } as Response;
  return { result, res };
}
/** Вызывает настоящий webhook-handler с raw JSON и опциональной синтетической подписью при подменённой persistence-границе. */
async function notify(body: Record<string, unknown>, secret?: string) {
  const { result, res } = response();
  const req = {
    method: "POST",
    query: {},
    headers: secret ? { sign: createProdamusSign(body, secret) } : {},
    body: Buffer.from(JSON.stringify(body)),
  } as Request;
  await handleProdamusWebhook(req, res);
  return result;
}
/** Возвращает исходное состояние и раздельные synthetic merchant-ключи перед сценарием. */
beforeEach(() => {
  vi.stubEnv("PUBLIC_APP_URL", "https://club.example.test");
  state.paid = false;
  state.cancelled = false;
  state.failDatabase = false;
  vi.stubEnv("PRODAMUS_SECRET", "test-only-secret");
  vi.stubEnv("PRODAMUS_SHOP_SECRET", "");
  vi.stubEnv("PRODAMUS_SUBSCRIPTION_SECRET", "");
});
/** Возвращает окружение после проверки подписи и ingress-политики. */
afterEach(() => vi.unstubAllEnvs());
/** Проверяет границу доверия платёжного уведомления: браузерный возврат, demo и неверный ключ не являются оплатой. */
describe("billing notification trust boundary", () => {
  /** Проверяет отсутствие SQL/error-объекта с токенами и персональными данными в логах. */
  it("does not log database error objects that can contain mail tokens and personal data", async () => {
    state.failDatabase = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await notify(payment, "test-only-secret")).status).toBe(500);
      expect(
        log.mock.calls.map((args) => args.map(String).join(" ")).join(" "),
      ).not.toContain("test-only-sensitive-sql-value");
    } finally {
      log.mockRestore();
    }
  });
  /** Проверяет отсутствие prototype pollution при разборе неподписанной PHP-формы. */
  it("does not allow unsigned form parsing to mutate Object.prototype", async () => {
    const { res } = response();
    const req: Partial<Request> = {
      method: "POST",
      query: {},
      headers: {},
      body: Buffer.from("__proto__[billingAuditPolluted]=yes"),
    };
    try {
      await handleProdamusWebhook(req as Request, res);
      expect(
        ({} as Record<string, unknown>).billingAuditPolluted,
      ).toBeUndefined();
    } finally {
      delete (Object.prototype as Record<string, unknown>).billingAuditPolluted;
    }
  });
  /** Проверяет, что браузерный возврат только перенаправляет и не активирует заказ. */
  it("browser return never activates an order", async () => {
    const { result, res } = response();
    const req: Partial<Request> = {
      query: { order: "club-7-100" },
      body: {},
      headers: {},
    };
    await handleProdamusReturn(req as Request, res);
    expect(state.paid).toBe(false);
    expect(result.status).toBe(302);
  });
  /** Проверяет отказ неподписанного, неправильно подписанного и demo-suffixed уведомления до settlement. */
  it.each([undefined, "wrong-secret", "test-only-secretdemo"])(
    "rejects unauthenticated notification signed with %s",
    async (secret) => {
      const result = await notify(payment, secret);
      expect(state.paid).toBe(false);
      expect(result.status).toBe(400);
    },
  );
  /** Проверяет отказ неподписанной отмены до изменения состояния. */
  it("rejects unsigned cancellation before any state change", async () => {
    const result = await notify({
      ...payment,
      subscription: { action_code: "deactivation" },
    });
    expect(state.cancelled).toBe(false);
    expect(result.status).toBe(400);
  });
  /** Проверяет, что неуспешный payment_status не выполняет recurrence-settlement. */
  it.each(["failed", "", "order_canceled"])(
    "cannot fulfil recurrence with status %s",
    async (status) => {
      await notify(
        {
          ...payment,
          payment_status: status,
          subscription: { action_code: "auto_payment" },
        },
        "test-only-secret",
      );
      expect(state.paid).toBe(false);
    },
  );
  /** Проверяет допуск корректно подписанной успешной оплаты к persistence-границе. */
  it("accepts a valid signed successful payment", async () => {
    const result = await notify(payment, "test-only-secret");
    expect(result.body).toBe("success");
    expect(state.paid).toBe(true);
  });
  /** Проверяет запрет всех поддержанных demo-маркеров даже с обычным валидным ключом. */
  it.each([
    { demo_mode: "1" },
    { demo_mode: 1 },
    { demoMode: true },
    { DEMO_MODE: "1" },
    { demo_mode: ["0", "1"] },
    { subscription: { demo: "1" } },
    { subscription: { Demo: 1 } },
  ])(
    "rejects a demo marker even with the ordinary valid key: %j",
    async (marker) => {
      const result = await notify(
        { ...payment, ...marker },
        "test-only-secret",
      );
      expect(result.status).toBe(400);
      expect(state.paid).toBe(false);
      expect(state.cancelled).toBe(false);
    },
  );
  /** Проверяет сохранение LIVE-обработки при явно выключенном demo-флаге. */
  it.each(["0", 0, false, ""])(
    "preserves live processing for a disabled demo flag %j",
    async (demo) => {
      const result = await notify(
        { ...payment, demo_mode: demo, subscription: { demo } },
        "test-only-secret",
      );
      expect(result.status).toBe(200);
      expect(state.paid).toBe(true);
    },
  );
  /** Проверяет запрет demo-отмены до profile-binding и persistence. */
  it("rejects a demo cancellation before profile binding or persistence", async () => {
    const result = await notify(
      {
        ...payment,
        subscription: { demo: "1", action_code: "deactivation" },
      },
      "test-only-secret",
    );
    expect(result.status).toBe(400);
    expect(state.cancelled).toBe(false);
    expect(state.paid).toBe(false);
  });
  /** Проверяет отказ подписанной отмены без доказанной recurring-привязки. */
  it("rejects signed cancellation without a bound subscription profile", async () => {
    const result = await notify(
      { ...payment, subscription: { action_code: "deactivation" } },
      "test-only-secret",
    );
    expect(result.status).toBe(422);
    expect(state.cancelled).toBe(false);
    expect(state.paid).toBe(false);
  });
  /** Проверяет запрет повторного использования shop-подписи для клубного платежа. */
  it("rejects a shop signature reused for a club payment", async () => {
    vi.stubEnv("PRODAMUS_SHOP_SECRET", "shop-only-key");
    expect((await notify(payment, "shop-only-key")).status).toBe(422);
    expect(state.paid).toBe(false);
  });
  /** Проверяет обязательные идентификаторы, merchant и валюту до settlement. */
  it.each([
    { order_id: "" },
    { domain: "another.payform.ru" },
    { currency: "usd" },
  ])("rejects missing or foreign payment identifiers: %j", async (extra) => {
    expect(
      (await notify({ ...payment, ...extra }, "test-only-secret")).status,
    ).toBe(422);
    expect(state.paid).toBe(false);
  });
});
