import { createHmac } from "node:crypto";
import { expect, it, vi } from "vitest";
import {
  processProdamusPaymentNotification as processPayment,
  type ProdamusPaymentNotificationPorts,
} from "../apps/backend/src/billing/prodamus-payment-notification";

// Literal canonical payloads, independent of production signing/field helpers.
const initial =
  '{"currency":"rub","customer_email":"Member@Example.test","domain":"fixture.payform.ru","order_id":"123","order_num":"club-7-100","payment_status":"success","sum":"790.00"}';
const recurring =
  '{"currency":"rub","customer_email":"Member@Example.test","domain":"fixture.payform.ru","order_id":"124","payment_status":"success","subscription":{"id":"7","profile_id":"23"},"sum":"790.00"}';
/** Создаёт замороженный синтетический payload и независимую HMAC-подпись с наблюдаемыми fulfil/configuration портами. */
function fixture(raw = initial, key = "initial-fixture-key") {
  const body = JSON.parse(raw) as Record<string, unknown>;
  Object.freeze(body);
  const signature = createHmac("sha256", key).update(raw).digest("hex");
  const fulfil = vi
    .fn<ProdamusPaymentNotificationPorts["fulfil"]>()
    .mockResolvedValue("club");
  const clubConfiguration = vi.fn<
    ProdamusPaymentNotificationPorts["clubConfiguration"]
  >((renewal) => ({
    domain: "fixture.payform.ru",
    subscriptionId: "",
    secret: renewal ? "recurring-fixture-key" : "initial-fixture-key",
  }));
  const ports = { fulfil, clubConfiguration };
  return { body, signature, ports, fulfil, clubConfiguration };
}
/** Проверяет игнорирование неоплаченного уведомления до чтения merchant-конфигурации и dispatch. */
it("ignores unpaid notifications without reading merchant configuration or dispatching", async () => {
  const f = fixture(initial.replace('"success"', '"pending"'));
  expect(await processPayment(f.body, f.signature, "", f.ports)).toEqual({
    status: 200,
    body: "ignored",
  });
  expect(f.clubConfiguration).not.toHaveBeenCalled();
  expect(f.fulfil).not.toHaveBeenCalled();
});
/** Проверяет единственную передачу первоначального order-proof с нормализацией только предусмотренного email-hint. */
it("forwards initial order proof once and normalizes only the existing email hint", async () => {
  const f = fixture();
  expect(await processPayment(f.body, f.signature, "", f.ports)).toEqual({
    status: 200,
    body: "success",
  });
  expect(f.fulfil).toHaveBeenCalledExactlyOnceWith("club-7-100", {
    email: "member@example.test",
    sum: "790.00",
    userId: null,
    proof: {
      domain: "fixture.payform.ru",
      paymentId: "123",
      email: "member@example.test",
      currency: "rub",
      subscriptionId: "",
      profileId: "",
    },
  });
  expect(f.clubConfiguration).toHaveBeenCalledExactlyOnceWith(false);
});
/** Проверяет recurring-конфигурацию и renewal-intent без доверия клиентскому userId получателя. */
it("uses recurring configuration and the renewal intent, never a recipient user hint", async () => {
  const f = fixture(recurring, "recurring-fixture-key");
  f.clubConfiguration.mockReturnValue({
    domain: "fixture.payform.ru",
    subscriptionId: "7",
    secret: "recurring-fixture-key",
  });
  expect(
    await processPayment(f.body, f.signature, "auto_payment", f.ports),
  ).toEqual({ status: 200, body: "success" });
  expect(f.fulfil).toHaveBeenCalledExactlyOnceWith("club-renew", {
    email: "member@example.test",
    sum: "790.00",
    recurring: true,
    proof: {
      domain: "fixture.payform.ru",
      paymentId: "124",
      email: "member@example.test",
      currency: "rub",
      subscriptionId: "7",
      profileId: "23",
    },
  });
  expect(f.clubConfiguration).toHaveBeenCalledExactlyOnceWith(true);
});
/** Проверяет отказ чужого домена, валюты и ключа до любого fulfilment. */
it.each([
  [
    "foreign domain",
    initial.replace("fixture.payform.ru", "foreign.payform.ru"),
    "initial-fixture-key",
  ],
  [
    "foreign currency",
    initial.replace('"rub"', '"usd"'),
    "initial-fixture-key",
  ],
  ["foreign signing key", initial, "foreign-fixture-key"],
])("refuses %s before any fulfilment", async (_name, raw, key) => {
  const f = fixture(raw, key);
  expect(await processPayment(f.body, f.signature, "", f.ports)).toEqual({
    status: 422,
    body: "payment binding invalid",
  });
  expect(f.fulfil).not.toHaveBeenCalled();
});
/** Проверяет, что durable-отказ не подтверждается как успешный платёж. */
it("does not acknowledge a durable refusal as success", async () => {
  const f = fixture();
  f.fulfil.mockResolvedValue(null);
  expect(await processPayment(f.body, f.signature, "", f.ports)).toEqual({
    status: 422,
    body: "payment binding invalid",
  });
  expect(f.fulfil).toHaveBeenCalledTimes(1);
});
/** Проверяет распространение settlement-ошибки без подтверждения и автоматического повторного вызова. */
it("propagates a settlement failure without acknowledging or retrying", async () => {
  const f = fixture();
  const failure = new Error("synthetic private durable failure");
  f.fulfil.mockRejectedValue(failure);
  await expect(processPayment(f.body, f.signature, "", f.ports)).rejects.toBe(
    failure,
  );
  expect(f.fulfil).toHaveBeenCalledTimes(1);
});
/** Проверяет игнорирование success без order до чтения клубной конфигурации. */
it("ignores a paid notification with no order without reading club configuration", async () => {
  const f = fixture('{"payment_status":"success"}');
  expect(await processPayment(f.body, f.signature, "", f.ports)).toEqual({
    status: 200,
    body: "ignored",
  });
  expect(f.clubConfiguration).not.toHaveBeenCalled();
  expect(f.fulfil).not.toHaveBeenCalled();
});
/** Проверяет сохранение решений non-club capability и settlement за прежним fulfilment-портом. */
it("leaves non-club capability/settlement decisions to the existing fulfilment port", async () => {
  const f = fixture(initial.replace("club-7-100", "shop-digital-1-100"));
  f.fulfil.mockResolvedValue(null);
  expect(await processPayment(f.body, f.signature, "", f.ports)).toEqual({
    status: 422,
    body: "payment binding invalid",
  });
  expect(f.clubConfiguration).not.toHaveBeenCalled();
  expect(f.fulfil).toHaveBeenCalledTimes(1);
  expect(f.fulfil.mock.calls[0][0]).toBe("shop-digital-1-100");
});
/** Проверяет NULL пустого email-hint без выдуманного получателя, сохраняя пустое поле исходного proof. */
it("preserves an empty initial email as null rather than inventing a recipient", async () => {
  const f = fixture(initial.replace("Member@Example.test", ""));
  await processPayment(f.body, f.signature, "", f.ports);
  expect(f.fulfil.mock.calls[0][1].email).toBeNull();
  expect(f.fulfil.mock.calls[0][1].proof.email).toBe("");
});
/** Проверяет запрет dispatch при пустом выбранном merchant-ключе. */
it("does not dispatch when the selected merchant key is empty", async () => {
  const f = fixture();
  f.clubConfiguration.mockReturnValue({
    domain: "fixture.payform.ru",
    subscriptionId: "",
    secret: "",
  });
  expect(await processPayment(f.body, f.signature, "", f.ports)).toEqual({
    status: 422,
    body: "payment binding invalid",
  });
  expect(f.fulfil).not.toHaveBeenCalled();
});
/** Проверяет немедленное распространение ошибки конфигурации без чтения другого ключа и dispatch. */
it("does not read another configuration or dispatch after configuration fails", async () => {
  const f = fixture();
  const failure = new Error("synthetic invalid merchant configuration");
  f.clubConfiguration.mockImplementation(() => {
    throw failure;
  });
  await expect(processPayment(f.body, f.signature, "", f.ports)).rejects.toBe(
    failure,
  );
  expect(f.clubConfiguration).toHaveBeenCalledTimes(1);
  expect(f.fulfil).not.toHaveBeenCalled();
});
/** Удерживает durable fulfilment и проверяет отсутствие успешного acknowledgement до его завершения. */
it("does not resolve the acknowledgement while durable fulfilment is pending", async () => {
  const f = fixture();
  let finish!: (value: "club") => void;
  f.fulfil.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  let acknowledged = false;
  const response = processPayment(f.body, f.signature, "", f.ports).then(
    (result) => {
      acknowledged = true;
      return result;
    },
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(acknowledged).toBe(false);
  expect(f.fulfil).toHaveBeenCalledTimes(1);
  finish("club");
  expect(await response).toEqual({ status: 200, body: "success" });
});
