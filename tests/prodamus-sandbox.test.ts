import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ProdamusSandboxService } from "../apps/backend/src/billing/prodamus-sandbox.service";

const secret = "a".repeat(64); // Synthetic fixture, not a provider key.
const linkCanonical =
  '{"callbackType":"json","currency":"rub","customer_email":"prodamus-demo@example.test","demo_mode":"1","do":"pay","installments_disabled":"1","order_id":"dd-demo-83be933e-a277-41f3-801d-45771c12b051","payment_method":"AC","payments_limit":"1","products":[{"name":"DaryaDarcy demo diagnostic (no access)","price":"790.00","quantity":"1","type":"service"}],"sum":"790.00","sys":"daryadarcy","urlNotification":"https:\\/\\/daryadarcy.dev.reeskeen.ru\\/api\\/prodamus\\/sandbox\\/webhook","urlReturn":"https:\\/\\/daryadarcy.dev.reeskeen.ru\\/club","urlSuccess":"https:\\/\\/daryadarcy.dev.reeskeen.ru\\/club"}';
const config = {
  PRODAMUS_SANDBOX_ENABLED: "true",
  PRODAMUS_SANDBOX_PAYFORM_URL: "https://testpage1.payform.ru",
  PRODAMUS_SANDBOX_SECRET: secret,
  PRODAMUS_SANDBOX_ORDER_ID: "dd-demo-83be933e-a277-41f3-801d-45771c12b051",
  PRODAMUS_SANDBOX_SYS: "daryadarcy",
  PRODAMUS_SANDBOX_DEMO_SIGN: "false",
  PUBLIC_APP_URL: "https://daryadarcy.dev.reeskeen.ru",
};
// Sorted fixture is hand-derived; no production parser/signing helper.
const payment = {
  currency: "rub",
  customer_email: "prodamus-demo@example.test",
  demo_mode: "1",
  domain: "testpage1.payform.ru",
  order_id: "300155",
  order_num: "dd-demo-83be933e-a277-41f3-801d-45771c12b051",
  payment_status: "success",
  sum: "790.00",
};
/** Независимо подписывает синтетическое уведомление по зафиксированному wire-контракту, не вызывая production signer. */
function signed(changes: Record<string, unknown> = {}, key = secret) {
  const data = { ...payment, ...changes };
  // Independent fixture encoding of the documented wire contract; expected
  // acknowledgements and URLs below are literals, not production-derived.
  /** Рекурсивно сортирует ключи и приводит значения к строковому представлению для независимого fixture HMAC. */
  const wire = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(wire);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value)
          .filter(([, v]) => v !== undefined)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, v]) => [k, wire(v)]),
      );
    return value == null ? "" : String(value);
  };
  const raw = JSON.stringify(data);
  const signature = createHmac("sha256", key)
    .update(JSON.stringify(wire(data)).replace(/\//g, "\\/"))
    .digest("hex");
  return { raw, signature };
}

/** Проверяет выделенную demo-диагностику без выдачи доступа и без настоящих платежей. */
describe("synthetic-only Prodamus diagnostics", () => {
  /** Разрешает sandbox только по точному явному флагу true. */
  it.each([undefined, "false", "1", "TRUE", " true "])(
    "does not opt in with %j",
    (enabled) => {
      const service = new ProdamusSandboxService({
        ...config,
        PRODAMUS_SANDBOX_ENABLED: enabled,
      });
      expect(() => service.buildLink()).toThrow(
        "Prodamus sandbox is not configured",
      );
      const { raw, signature } = signed();
      expect(service.acceptNotification(raw, signature).status).toBe(503);
    },
  );
  /** Некорректная выделенная конфигурация не создаёт ссылку и не принимает уведомление. */
  it.each([
    { PRODAMUS_SANDBOX_PAYFORM_URL: "https://other.payform.ru" },
    { PRODAMUS_SANDBOX_PAYFORM_URL: "http://testpage1.payform.ru" },
    {
      PRODAMUS_SANDBOX_PAYFORM_URL: "https://testpage1.payform.ru/?demo_mode=0",
    },
    { PUBLIC_APP_URL: "https://daryadarcy.com" },
    { PUBLIC_APP_URL: "https://daryadarcy.dev.reeskeen.ru.evil.test" },
    { PUBLIC_APP_URL: "https://daryadarcy.dev.reeskeen.ru/path" },
    { PRODAMUS_SANDBOX_SECRET: "" },
    { PRODAMUS_SANDBOX_SECRET: "bad-secret" },
    { PRODAMUS_SANDBOX_ORDER_ID: "club-7-real" },
    { PRODAMUS_SANDBOX_ORDER_ID: "dd-demo-injected&amount=1" },
    { PRODAMUS_SANDBOX_SYS: "" },
    { PRODAMUS_SANDBOX_SYS: "x&urlNotification=https://evil.test" },
    { PRODAMUS_SANDBOX_DEMO_SIGN: "yes" },
  ])("fails closed on an invalid dedicated configuration %j", (changes) => {
    const service = new ProdamusSandboxService({ ...config, ...changes });
    expect(() => service.buildLink()).toThrow(
      "Prodamus sandbox is not configured",
    );
    const { raw, signature } = signed();
    expect(service.acceptNotification(raw, signature).status).toBe(503);
  });
  /** Формирует стабильный одноразовый demo-заказ с синтетическим контактом и без обещания доступа. */
  it("generates an explicitly demo one-off link with synthetic contact and no access-return flag", () => {
    const service = new ProdamusSandboxService(config);
    const url = new URL(service.buildLink());
    expect(url.origin).toBe("https://testpage1.payform.ru");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      do: "pay",
      demo_mode: "1",
      currency: "rub",
      sum: "790.00",
      order_id: "dd-demo-83be933e-a277-41f3-801d-45771c12b051",
      customer_email: "prodamus-demo@example.test",
      sys: "daryadarcy",
      callbackType: "json",
      urlNotification:
        "https://daryadarcy.dev.reeskeen.ru/api/prodamus/sandbox/webhook",
      urlReturn: "https://daryadarcy.dev.reeskeen.ru/club",
      urlSuccess: "https://daryadarcy.dev.reeskeen.ru/club",
      "products[0][price]": "790.00",
      "products[0][quantity]": "1",
      payment_method: "AC",
      installments_disabled: "1",
      payments_limit: "1",
    });
    for (const name of [
      "subscription",
      "customer_phone",
      "_param_userId",
      "paid_content",
    ]) {
      expect(url.searchParams.has(name)).toBe(false);
    }
    expect(url.searchParams.get("signature")).toMatch(/^[a-f0-9]{64}$/);
    expect(url.searchParams.get("signature")).toBe(
      createHmac("sha256", secret).update(linkCanonical).digest("hex"),
    );
    expect(url.href).not.toContain(secret);
    const same = service.buildLink();
    expect(same).toBe(url.href); // Retry does not silently mint a new order.
  });
  /** Добавляет demo-суффикс к ключу подписи только при отдельной настройке sandbox. */
  it("uses the demo-suffixed key only when explicitly configured for this sandbox", () => {
    const ordinary = new URL(new ProdamusSandboxService(config).buildLink());
    const demo = new URL(
      new ProdamusSandboxService({
        ...config,
        PRODAMUS_SANDBOX_DEMO_SIGN: "true",
      }).buildLink(),
    );
    expect(demo.searchParams.get("signature")).toBe(
      createHmac("sha256", `${secret}demo`).update(linkCanonical).digest("hex"),
    );
    demo.searchParams.delete("signature");
    ordinary.searchParams.delete("signature");
    expect(demo.href).toBe(ordinary.href);
  });
  /** Фиксирует конфигурацию в экземпляре, не следуя последующему изменению исходного объекта. */
  it("snapshots dedicated configuration per instance", () => {
    const mutable = { ...config };
    const service = new ProdamusSandboxService(mutable);
    mutable.PRODAMUS_SANDBOX_PAYFORM_URL = "https://other.payform.ru";
    expect(new URL(service.buildLink()).origin).toBe(
      "https://testpage1.payform.ru",
    );
  });
  /** Подтверждает валидную диагностическую подпись без предоставления клубного доступа. */
  it.each([secret, `${secret}demo`])(
    "acknowledges a signed diagnostic without claiming access",
    (key) => {
      const service = new ProdamusSandboxService(config);
      const { raw, signature } = signed({}, key);
      expect(service.acceptNotification(Buffer.from(raw), signature)).toEqual({
        status: 200,
        body: {
          mode: "demo",
          accessGranted: false,
          notificationVerified: true,
          paymentStatus: "success",
        },
      });
      expect(service.acceptNotification(raw, signature).status).toBe(200);
    },
  );
  /** Принимает только проверенные поддерживаемые статусы диагностической оплаты. */
  it.each(["pending", "order_canceled", "order_denied"])(
    "accepts a verified diagnostic status %s",
    (payment_status) => {
      const { raw, signature } = signed({ payment_status });
      expect(
        new ProdamusSandboxService(config).acceptNotification(raw, signature),
      ).toMatchObject({
        status: 200,
        body: { accessGranted: false, paymentStatus: payment_status },
      });
    },
  );
  /** Разбирает PHP form callback с тем же независимым HMAC fixture. */
  it("decodes a PHP-style form callback", () => {
    const { signature } = signed();
    const raw = new URLSearchParams(payment).toString();
    expect(
      new ProdamusSandboxService(config).acceptNotification(raw, signature)
        .status,
    ).toBe(200);
  });
  /** Допускает документированные числовые provider ID и целый demo flag в JSON. */
  it("accepts documented numeric provider ID and integer demo flag in JSON", () => {
    const { raw, signature } = signed({
      order_id: 300155,
      demo_mode: 1,
      payment_init: "manual",
    });
    expect(
      new ProdamusSandboxService(config).acceptNotification(raw, signature)
        .status,
    ).toBe(200);
  });
  /** Отклоняет чрезмерную вложенность без необработанного исключения сериализации. */
  it("rejects excessive nesting without an uncaught serialization error", () => {
    const raw = '{"n":'.repeat(8000) + '"x"' + "}".repeat(8000);
    expect(
      new ProdamusSandboxService(config).acceptNotification(raw, "f".repeat(64))
        .status,
    ).toBe(400);
  });
  /** Даже валидная подпись не допускает неверные привязки суммы, контакта, домена, заказа и режима. */
  it.each([
    { demo_mode: "0" },
    { demo_mode: undefined },
    { demo_mode: true },
    { demo_mode: ["1"] },
    { domain: "other.payform.ru" },
    { domain: "testpage1.payform.ru.evil.test" },
    { order_num: "club-7-real" },
    { order_num: "dd-demo-83be933e-a277-41f3-801d-45771c12b052" },
    { order_id: "" },
    { order_id: "not-a-provider-id" },
    { order_id: 300155.5 },
    { order_id: Number.MAX_SAFE_INTEGER + 1 },
    { sum: "0.00" },
    { sum: "789.00" },
    { sum: "790e0" },
    { currency: "usd" },
    { customer_email: "real@gmail.com" },
    { customer_phone: "+79991234567" },
    { subscription: { id: "7", demo: "1" } },
    { payment_status: "unknown" },
    { demoMode: "0" },
    { DEMO_MODE: "0" },
    { payment_init: "auto" },
    { payment_init: "api" },
  ])("rejects a signed wrong binding %j", (changes) => {
    const { raw, signature } = signed(changes);
    expect(
      new ProdamusSandboxService(config).acceptNotification(raw, signature)
        .status,
    ).toBe(400);
  });
  /** Отклоняет отсутствующую, повреждённую или несовпадающую подпись. */
  it.each(["", "not-hex", "f".repeat(64), ["f".repeat(64)], undefined])(
    "rejects invalid signature %j",
    (signature) => {
      const { raw } = signed();
      expect(
        new ProdamusSandboxService(config).acceptNotification(raw, signature)
          .status,
      ).toBe(400);
    },
  );
  /** Проверяет подпись всех собственных JSON-полей, включая добавленный __proto__, до подтверждения. */
  it("verifies all own JSON fields, including __proto__, before acknowledgement", () => {
    const { raw, signature } = signed();
    const injected = raw.slice(0, -1) + ',"__proto__":{"note":"unsigned"}}';
    expect(
      new ProdamusSandboxService(config).acceptNotification(injected, signature)
        .status,
    ).toBe(400);
  });
  /** Отклоняет повреждённое raw body вместо попытки подтвердить diagnostic webhook. */
  it.each([null, {}, "broken-json", "[]"])(
    "rejects malformed raw input %j",
    (raw) => {
      expect(
        new ProdamusSandboxService(config).acceptNotification(
          raw,
          "f".repeat(64),
        ).status,
      ).toBe(400);
    },
  );
});
