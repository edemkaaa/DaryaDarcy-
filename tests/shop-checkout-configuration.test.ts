/** Низкоуровневый shop URL builder проверяется без отправки платежа; его наличие не включает продажи через приложение. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const input = { productId: "digital-1", orderId: "shop-digital-1-fixture" };
/** Каждый импорт получает synthetic shop/club merchant и фиксированные product prices. */
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("PUBLIC_APP_URL", "https://shop.example.test");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("PRODAMUS_SHOP_PAYFORM_URL", "https://fixture-shop.payform.ru");
  vi.stubEnv("PRODAMUS_SHOP_SECRET", "synthetic-shop-key");
  vi.stubEnv("PRODAMUS_SHOP_DEMO", "0");
  vi.stubEnv("PRODAMUS_PAYFORM_URL", "https://fixture-club.payform.ru");
  vi.stubEnv("PRODAMUS_SECRET", "synthetic-club-key");
  vi.stubEnv("PRODAMUS_SUBSCRIPTION_ID", "");
  vi.stubEnv("SHOP_DIGITAL_1_PRICE", "50");
  vi.stubEnv("SHOP_DIGITAL_2_PRICE", "50");
});
/** Возвращаем env. */
afterEach(() => vi.unstubAllEnvs());

/** Catalog lookup использует только собственные product keys. */
it.each(["__proto__", "constructor", "toString"])(
  "does not resolve inherited object properties as shop products: %s",
  async (productId) => {
    const { getShopProduct } = await import("../apps/backend/src/prodamus");
    expect(getShopProduct(productId)).toBeNull();
  },
);

/** Unknown product отвергается ещё до merchant configuration. */
it.each(["__proto__", "constructor", "toString"])(
  "does not build a payment URL for inherited catalog properties: %s",
  async (productId) => {
    // Unknown products must be rejected even before merchant configuration.
    vi.stubEnv("PRODAMUS_SHOP_PAYFORM_URL", "");
    const { buildShopCheckoutUrl } = await import("../apps/backend/src/prodamus");
    expect(buildShopCheckoutUrl({ ...input, productId })).toBeNull();
  },
);

/** Невалидный HTTPS payform root даёт безопасный PRECONDITION_FAILED без credentials. */
it.each([
  "",
  "   ",
  "not a URL",
  "http://fixture-shop.payform.ru",
  "https://payments-disabled.invalid",
  "https://fixture-shop.payform.ru.attacker.test",
  "https://PRIVATE_VALUE@fixture-shop.payform.ru",
  "https://user:PRIVATE_VALUE@fixture-shop.payform.ru",
  "https://fixture-shop.payform.ru:8443",
  "https://fixture-shop.payform.ru/path",
  "https://fixture-shop.payform.ru?order_id=PRIVATE_VALUE",
  "https://fixture-shop.payform.ru#PRIVATE_VALUE",
])("refuses an unsafe or missing shop form: %s", async (form) => {
  vi.stubEnv("PRODAMUS_SHOP_PAYFORM_URL", form);
  const { buildShopCheckoutUrl } = await import("../apps/backend/src/prodamus");
  let failure: unknown;
  try {
    buildShopCheckoutUrl(input);
  } catch (error) {
    failure = error;
  }
  expect(failure).toMatchObject({ code: "PRECONDITION_FAILED" });
  expect(String(failure)).not.toContain("PRIVATE_VALUE");
  expect(String(failure)).not.toContain("synthetic-shop-key");
});

/** Пустые ключи не разрешают payable unsigned URL. */
it("refuses an unsigned shop link when neither merchant has a signing key", async () => {
  vi.stubEnv("PRODAMUS_SHOP_SECRET", " ");
  vi.stubEnv("PRODAMUS_SECRET", "");
  const { buildShopCheckoutUrl } = await import("../apps/backend/src/prodamus");
  expect(() => buildShopCheckoutUrl(input)).toThrowError(
    "Оплата временно недоступна. Попробуйте позже.",
  );
});

/** Legacy fallback требует отдельно валидный club merchant, не guessed origin. */
it.each(["", "https://fixture-club.payform.ru?signature=PRIVATE_VALUE"])(
  "requires an explicit safe club form for the existing club-key fallback: %s",
  async (form) => {
    vi.stubEnv("PRODAMUS_SHOP_SECRET", "");
    vi.stubEnv("PRODAMUS_PAYFORM_URL", form);
    const { buildShopCheckoutUrl } =
      await import("../apps/backend/src/prodamus");
    expect(() => buildShopCheckoutUrl(input)).toThrowError(
      "Оплата временно недоступна. Попробуйте позже.",
    );
  },
);

/** Callback origin проверяется независимо и не отражает private userinfo в ошибке. */
it.each([
  "",
  "http://shop.example.test",
  "https://user:PRIVATE_VALUE@shop.example.test",
])(
  "reports unsafe public callback configuration without exposing it: %s",
  async (app) => {
    vi.stubEnv("PUBLIC_APP_URL", app);
    const { buildShopCheckoutUrl } =
      await import("../apps/backend/src/prodamus");
    let failure: unknown;
    try {
      buildShopCheckoutUrl(input);
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(String(failure)).not.toContain("PRIVATE_VALUE");
  },
);

/** Цена должна соответствовать тем же decimal/minor-unit правилам, что и settlement. */
it.each(["SHOP_DIGITAL_1_PRICE", "SHOP_DIGITAL_2_PRICE"])(
  "rejects invalid money in %s using the billing amount rules",
  async (name) => {
    for (const price of ["0", "-1", "NaN", "50.001", "1e3", "99999999"]) {
      vi.stubEnv(name, price);
      vi.resetModules();
      const { buildShopCheckoutUrl } =
        await import("../apps/backend/src/prodamus");
      expect(() =>
        buildShopCheckoutUrl({
          ...input,
          productId:
            name === "SHOP_DIGITAL_1_PRICE" ? "digital-1" : "digital-2",
        }),
      ).toThrowError("Оплата временно недоступна. Попробуйте позже.");
    }
  },
);

// These digests come from an independently hand-written canonical payload,
// not from createProdamusSign or the URL builder being tested.
/** Независимые literal HMAC для live/demo сохраняют one-off без subscription. */
it.each([
  ["0", "47bcafc84547b76d5e0a8e507e85c80caa3e078dc3ea5b1acc3a9108027b65d4"],
  ["true", "5977a33a05239254c5bf57f97e52ca29ad5e48da9531acf03f5a553e53409d79"],
])(
  "preserves the shop merchant signature in demo mode %s",
  async (demo, signature) => {
    vi.stubEnv("PRODAMUS_SHOP_DEMO", demo);
    const { buildShopCheckoutUrl } =
      await import("../apps/backend/src/prodamus");
    const url = new URL(buildShopCheckoutUrl(input)!);
    expect(url.origin).toBe("https://fixture-shop.payform.ru");
    expect(url.searchParams.get("signature")).toBe(signature);
    expect(url.searchParams.get("products[0][price]")).toBe("50");
    expect(url.searchParams.has("subscription")).toBe(false);
  },
);

/** Явно настроенный fallback использует club key, но не recurring subscription. */
it("preserves the explicit club merchant fallback for a one-off shop purchase", async () => {
  vi.stubEnv("PRODAMUS_SHOP_SECRET", "");
  const { buildShopCheckoutUrl } = await import("../apps/backend/src/prodamus");
  const url = new URL(buildShopCheckoutUrl(input)!);
  expect(url.origin).toBe("https://fixture-club.payform.ru");
  expect(url.searchParams.get("signature")).toBe(
    "721f84aa8ee63421bc592178f951ee5bde920fd81fcf13130289dc37fede0972",
  );
  expect(url.searchParams.has("subscription")).toBe(false);
});

/** Whitespace/trailing slash нормализуются без потери копеек. */
it("normalizes an explicit shop root without changing fractional product price", async () => {
  vi.stubEnv("PRODAMUS_SHOP_PAYFORM_URL", " https://fixture-shop.payform.ru/ ");
  vi.stubEnv("SHOP_DIGITAL_1_PRICE", "50.25");
  const { buildShopCheckoutUrl } = await import("../apps/backend/src/prodamus");
  const url = buildShopCheckoutUrl(input)!;
  expect(url.startsWith("https://fixture-shop.payform.ru/?")).toBe(true);
  expect(new URL(url).searchParams.get("products[0][price]")).toBe("50.25");
});
