/** Контактный номер проверяется на настоящем checkout-сервисе с mock DB: без SMS, provider HTTP и выдачи сессии. */
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const data = vi.hoisted(() => ({
  orders: [] as Record<string, unknown>[],
  accounts: 0,
}));
vi.mock("../apps/backend/src/db", () => ({
  getUserByEmail: async () => undefined,
  ensureUserByEmail: async () => {
    data.accounts++;
    return { id: 123, email: "contact@example.test" };
  },
  createClubPayment: async (order: Record<string, unknown>) => {
    data.orders.push(order);
  },
}));
import { ClubCheckoutService } from "../apps/backend/src/billing/club-checkout.service";
const service = new ClubCheckoutService();
/** Вызываем гостевой checkout с фиксированным email и изменяемым непроверенным contactPhone. */
const checkout = (phone: unknown) =>
  service.createCheckout(null, {
    email: "contact@example.test",
    contactPhone: phone,
  } as never);
/** Сбрасываем account/order spies и включаем только синтетические TEST-настройки. */
beforeEach(() => {
  data.orders = [];
  data.accounts = 0;
  vi.stubEnv("PUBLIC_APP_URL", "https://daryadarcy.dev.reeskeen.ru");
  vi.stubEnv("PRODAMUS_TEST_ENABLED", "true");
  vi.stubEnv("PRODAMUS_TEST_PAYFORM_URL", "https://testpage1.payform.ru");
  vi.stubEnv("PRODAMUS_TEST_SECRET", "a".repeat(64));
  vi.stubEnv("YOOKASSA_TEST_ENABLED", "false");
});
/** Снимаем env после каждого варианта. */
afterEach(() => vi.unstubAllEnvs());
/** Обязательный нормализуемый номер проверяется до account/order записи. */
it.each([
  undefined,
  null,
  "",
  "   ",
  "123",
  "+7abc9991234567",
  "+1" + "1".repeat(16),
])(
  "refuses invalid/missing contact before creating an account or order (%j)",
  async (phone) => {
    await expect(checkout(phone)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(data.accounts).toBe(0);
    expect(data.orders).toEqual([]);
  },
);
/** Российские и международные форматы сохраняются канонически в заказе, но не попадают в provider URL. */
it.each([
  ["8 (999) 123-45-67", "+79991234567"],
  ["+7 999 123-45-67", "+79991234567"],
  ["+44 7700 900123", "+447700900123"],
])(
  "stores a normalized unverified contact locally (%s)",
  async (phone, normalized) => {
    const result = await checkout(phone);
    expect(data.orders).toEqual([
      expect.objectContaining({ userId: 123, contactPhone: normalized }),
    ]);
    expect(result.user).toBeNull();
    expect(decodeURIComponent(result.url)).not.toContain(normalized);
    expect(new URL(result.url).searchParams.has("customer_phone")).toBe(false);
  },
);
/** Обычная LIVE-сборка ссылки использует то же правило без реального платежа. */
it("also requires and stores contact in LIVE checkout, without sending it to the provider", async () => {
  vi.stubEnv("PRODAMUS_TEST_ENABLED", "false");
  vi.stubEnv("GUEST_CHECKOUT_RECOVERY_ENABLED", "false");
  vi.stubEnv("PRODAMUS_PAYFORM_URL", "https://fixture.payform.ru");
  vi.stubEnv("PRODAMUS_SECRET", "synthetic-key");
  vi.stubEnv("PRODAMUS_SUBSCRIPTION_ID", "12345");
  await expect(checkout(undefined)).rejects.toMatchObject({
    code: "BAD_REQUEST",
  });
  const result = await checkout("+7 999 123-45-67");
  expect(data.orders).toEqual([
    expect.objectContaining({ contactPhone: "+79991234567" }),
  ]);
  expect(new URL(result.url).searchParams.has("customer_phone")).toBe(false);
});

import { normalizeContactPhone } from "../packages/shared/src/checkout-contact";
import { normalCheckoutInput } from "../apps/backend/src/billing/normal-checkout";
import { guestCheckoutInput } from "../apps/backend/src/billing/guest-normal-checkout";
/** Нормализация не вырезает script/переводы строк и не угадывает номер без международного префикса. */
it.each([
  "+0 12345678",
  "+7<script>9991234567",
  "9991234567",
  "+7\n9991234567",
  "1".repeat(10000),
])("does not silently remove arbitrary characters (%s)", (value) => {
  expect(normalizeContactPhone(value)).toBeNull();
});
/** Оба keyed контракта нормализуют контакт одинаково до долговечного создания. */
it("accepts contact in both durable checkout contracts", () => {
  const common = {
    idempotencyKey: "0a14203e-0812-4f96-9dd4-56a5502f28cc",
    contactPhone: "8 (999) 123-45-67",
  };
  expect(normalCheckoutInput.parse(common).contactPhone).toBe("+79991234567");
  expect(
    guestCheckoutInput.parse({
      ...common,
      email: "contact@example.test",
      recoveryToken: "A".repeat(43),
    }).contactPhone,
  ).toBe("+79991234567");
});
