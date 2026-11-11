/** Изолируем TEST-провайдера через synthetic config и подменённый fetch: настоящих платежей, ключей или запросов в YooKassa нет. */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readYookassaTestConfig,
  YookassaTestClient,
} from "../apps/backend/src/billing/yookassa/client";

const config = {
  shopId: "123456",
  secretKey: "test_synthetic-not-a-real-secret",
  returnUrl: "https://daryadarcy.dev.reeskeen.ru/club",
};
const id = "2419a771-000f-5000-9000-1edaf29243f2";
const order = "yk-club-12345678-1234-4123-8123-123456789abc";
/** Создаёт минимальный согласованный TEST-ответ; отдельные поля намеренно подменяются в отрицательных сценариях. */
const payment = () => ({
  id,
  status: "pending",
  paid: false,
  test: true,
  amount: { value: "790.00", currency: "RUB" },
  recipient: { account_id: "123456", gateway_id: "111" },
  metadata: { order_id: order },
  created_at: "2026-10-07T00:00:00Z",
  refundable: false,
  confirmation: {
    type: "redirect",
    confirmation_url: `https://yoomoney.ru/checkout/payments/v2/contract?orderId=${id}`,
  },
});
/** Снимаем глобальный fetch и spies, чтобы последующий файл не унаследовал тестовый провайдер. */
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Проверяем включение, происхождение ответа, ограничение транспорта и отсутствие автоматического повтора неопределённой записи. */
describe("YooKassa test-only provider boundary", () => {
  /** Даже заполненные реквизиты не разрешают внешнюю интеграцию без отдельного TEST-флага. */
  it("fails closed without explicit test enablement", () => {
    expect(() =>
      readYookassaTestConfig({
        YOOKASSA_SHOP_ID: "123456",
        YOOKASSA_SECRET_KEY: config.secretKey,
      }),
    ).toThrow();
  });
  /** LIVE-префикс, пустой TEST-секрет и перевод строки отвергаются до формирования заголовков запроса. */
  it.each(["live_synthetic", "test_", "test_bad\nheader"])(
    "rejects unsafe credentials before an external request: %s",
    (secret) => {
      expect(() =>
        readYookassaTestConfig({
          YOOKASSA_TEST_ENABLED: "true",
          YOOKASSA_SHOP_ID: "123456",
          YOOKASSA_SECRET_KEY: secret,
          PUBLIC_APP_URL: "https://daryadarcy.dev.reeskeen.ru",
        }),
      ).toThrow();
    },
  );
  /** Принимается ровно разрешённый TEST origin с ожидаемыми реквизитами, без расширения на боевой домен. */
  it("accepts the explicitly enabled test stand only", () => {
    expect(
      readYookassaTestConfig({
        YOOKASSA_TEST_ENABLED: "true",
        YOOKASSA_SHOP_ID: "123456",
        YOOKASSA_SECRET_KEY: config.secretKey,
        PUBLIC_APP_URL: "https://daryadarcy.dev.reeskeen.ru",
      }),
    ).toEqual(config);
  });
  /** Тестовый ключ не делает боевую страницу допустимой точкой возврата TEST-оплаты. */
  it("rejects production return origins even with a test key", () => {
    expect(() =>
      readYookassaTestConfig({
        YOOKASSA_TEST_ENABLED: "true",
        YOOKASSA_SHOP_ID: "123456",
        YOOKASSA_SECRET_KEY: config.secretKey,
        PUBLIC_APP_URL: "https://daryadarcy.com",
      }),
    ).toThrow();
  });
  /** Подменённый account response должен подтвердить TEST-магазин и возможность принимать платежи. */
  it("checks the authenticated store is a test payment store", async () => {
    vi.stubGlobal("fetch", async () =>
      Response.json({
        account_id: "123456",
        test: true,
        payment_methods: ["bank_card"],
      }),
    );
    await expect(
      new YookassaTestClient(config).verifyAccount(),
    ).resolves.toBeUndefined();
    vi.unstubAllGlobals();
  });
  /** Другой магазин, LIVE-аккаунт или аккаунт выплат не проходят проверку идентичности провайдера. */
  it.each([
    { account_id: "999", test: true, payment_methods: ["bank_card"] },
    { account_id: "123456", test: false, payment_methods: ["bank_card"] },
    { account_id: "123456", test: true, payout_methods: ["bank_card"] },
  ])("refuses wrong/live/payout accounts", async (account) => {
    vi.stubGlobal("fetch", async () => Response.json(account));
    await expect(
      new YookassaTestClient(config).verifyAccount(),
    ).rejects.toThrow("YooKassa");
    vi.unstubAllGlobals();
  });
  /** Проверяем фиксированный API origin, запрет redirect, AbortSignal и исключение ненужных карточных полей из результата. */
  it("reads a payment on the fixed origin, redacting unused card fields", async () => {
    let requestUrl = "";
    let options: RequestInit | undefined;
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      requestUrl = url;
      options = init;
      return Response.json({
        ...payment(),
        payment_method: { saved: false, card: { last4: "1111" } },
      });
    });
    const result = await new YookassaTestClient(config).getPayment(id);
    expect(requestUrl).toBe(`https://api.yookassa.ru/v3/payments/${id}`);
    expect(options?.redirect).toBe("error");
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(result).not.toHaveProperty("payment_method.card");
    expect(result.id).toBe(id);
    vi.unstubAllGlobals();
  });
  /** Запись использует переданный Idempotence-Key и точный одноразовый payload без сохранения карты или отправки email. */
  it("creates a one-off payment using the given stable key, without email/card data", async () => {
    let outbound: { url: string; init: RequestInit } | undefined;
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      outbound = { url, init };
      return Response.json(payment());
    });
    const client = new YookassaTestClient(config);
    const request = client.paymentRequest(order, 79000);
    await expect(
      client.createPayment(request, "12345678-1234-4123-8123-123456789abc"),
    ).resolves.toMatchObject({ id });
    expect(outbound?.url).toBe("https://api.yookassa.ru/v3/payments");
    expect(outbound?.init.method).toBe("POST");
    expect(new Headers(outbound?.init.headers).get("Idempotence-Key")).toBe(
      "12345678-1234-4123-8123-123456789abc",
    );
    expect(JSON.parse(String(outbound?.init.body))).toEqual({
      amount: { value: "790.00", currency: "RUB" },
      capture: true,
      save_payment_method: false,
      description: "DaryaDarcy: test club access",
      confirmation: {
        type: "redirect",
        return_url: `https://daryadarcy.dev.reeskeen.ru/club?payment=returned&order=${order}`,
      },
      metadata: { order_id: order },
    });
  });
  /** Созданный платёж должен совпасть по TEST, магазину, сумме и order metadata; сохранённый метод оплаты тоже запрещён. */
  it.each([
    { test: false },
    { recipient: { account_id: "999" } },
    { amount: { value: "0.01", currency: "RUB" } },
    { metadata: { order_id: "club-123-other" } },
    { payment_method: { saved: true } },
  ])("refuses mismatched created payments", async (replacement) => {
    vi.stubGlobal("fetch", async () =>
      Response.json({ ...payment(), ...replacement }),
    );
    const client = new YookassaTestClient(config);
    await expect(
      client.createPayment(
        client.paymentRequest(order, 79000),
        "12345678-1234-4123-8123-123456789abc",
      ),
    ).rejects.toThrow("YooKassa");
  });
  /** На 500 остаётся один вызов и безопасная ошибка: провайдер мог принять запись, слепой повтор недопустим. */
  it("never retries an uncertain create automatically or leaks error bodies", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls++;
      return Response.json(
        { description: "provider-secret-leak" },
        { status: 500 },
      );
    });
    const client = new YookassaTestClient(config);
    await expect(
      client.createPayment(
        client.paymentRequest(order, 79000),
        "12345678-1234-4123-8123-123456789abc",
      ),
    ).rejects.toThrow(/^YooKassa provider unavailable$/);
    expect(calls).toBe(1);
  });
  /** Сегмент пути проверяется до fetch; traversal не должен попасть в адрес внешнего API. */
  it("rejects invalid payment IDs before network work", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls++;
      return Response.json(payment());
    });
    await expect(
      new YookassaTestClient(config).getPayment("../me"),
    ).rejects.toThrow();
    expect(calls).toBe(0);
  });
  /** Платёжная ссылка проверяется по HTTPS и точному хосту без credentials, нестандартного порта и поддоменного обмана. */
  it.each([
    "https://evil.example/checkout/p",
    "https://yoomoney.ru.evil.example/checkout/p",
    "http://yoomoney.ru/checkout/p",
    "https://user@yoomoney.ru/checkout/p",
    "https://yoomoney.ru:8443/checkout/p",
  ])("rejects unsafe confirmation %s", async (url) => {
    vi.stubGlobal("fetch", async () =>
      Response.json({
        ...payment(),
        confirmation: { type: "redirect", confirmation_url: url },
      }),
    );
    await expect(
      new YookassaTestClient(config).getPayment(id),
    ).rejects.toThrow();
  });
  /** Слишком большой ответ отклоняется, но занятый слот освобождается для следующего корректного запроса. */
  it("rejects oversized JSON and frees the transport slot", async () => {
    const client = new YookassaTestClient(config);
    vi.stubGlobal("fetch", async () =>
      Response.json({ ...payment(), unused: "x".repeat(65536) }),
    );
    await expect(client.getPayment(id)).rejects.toThrow();
    vi.stubGlobal("fetch", async () => Response.json(payment()));
    await expect(client.getPayment(id)).resolves.toMatchObject({ id });
  });
  /** Четыре удержанных fetch занимают лимит; пятый сразу отклоняется, после освобождения все принятые чтения завершаются. */
  it("limits concurrent network operations without an unbounded queue", async () => {
    const releases: Array<(response: Response) => void> = [];
    vi.stubGlobal(
      "fetch",
      () => new Promise<Response>((resolve) => releases.push(resolve)),
    );
    const client = new YookassaTestClient(config);
    const pending = Array.from({ length: 4 }, () => client.getPayment(id));
    await expect(client.getPayment(id)).rejects.toThrow();
    expect(releases).toHaveLength(4);
    for (const resolve of releases) resolve(Response.json(payment()));
    await expect(Promise.all(pending)).resolves.toHaveLength(4);
  });
});
