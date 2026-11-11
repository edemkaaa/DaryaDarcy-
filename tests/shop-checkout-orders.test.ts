/** Проверяем сохранение отдельных pending orders через настоящий построитель ссылок и локальный legacy redirect; SQL write подменён, checkout capability включается только в spies. */
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
} from "vitest";
import type { TrpcContext } from "../apps/backend/src/_core/context";
import type { User } from "../packages/database/src/schema";

/** Вместо SQL сохраняем только наблюдаемые вызовы createShopPurchase для проверки отсутствия записи при отказе. */
const persistence = vi.hoisted(() => ({
  orders: [] as {
    userId?: number | null;
    productId: string;
    orderId: string;
    email?: string | null;
  }[],
}));
// Replace only the SQL write; URL construction, signing and routers stay real.
vi.mock("../apps/backend/src/db", () => ({
  createShopPurchase: async (input: (typeof persistence.orders)[number]) => {
    persistence.orders.push(input);
  },
}));
import { shopRouter } from "../apps/backend/src/shop/router";
import {
  parseShopProductId,
  registerProdamusRoutes,
} from "../apps/backend/src/prodamus";
import * as capabilities from "../apps/backend/src/launch/capabilities";
import * as database from "../apps/backend/src/db";

let server: Server;
let base: string;
/** Регистрируем настоящие Prodamus routes на собственном loopback Express listener. */
beforeAll(async () => {
  const app = express();
  registerProdamusRoutes(app);
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
/** Закрываем созданный listener и ждём окончания его работы. */
afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});
/** Сбрасываем pending fixtures, задаём synthetic shop config и одинаковые часы; capability bypass проверяет лишь отключённую реализацию. */
beforeEach(() => {
  persistence.orders = [];
  vi.stubEnv("PUBLIC_APP_URL", "https://shop.example.test");
  vi.stubEnv("PRODAMUS_SHOP_PAYFORM_URL", "https://fixture-shop.payform.ru");
  vi.stubEnv("PRODAMUS_SHOP_SECRET", "synthetic-shop-signing-key");
  vi.stubEnv("PRODAMUS_SHOP_DEMO", "0");
  vi.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
  // Exercise the dormant implementation, never enable unsafe shop settlement.
  // Real default-disabled behavior remains covered by launch-capabilities.test.
  vi.spyOn(capabilities, "requireCapability").mockImplementation(() => {});
  vi.spyOn(capabilities, "getCapabilities").mockReturnValue({
    smsLogin: false,
    penPals: false,
    shopOnlinePayment: true,
    webPush: false,
    privateContentUploads: false,
    privatePostMediaUploads: false,
    privatePostVideoUploads: false,
  });
});
/** Возвращаем provider окружение, часы и capability spies после каждого сценария. */
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

/** Создаёт типизированную тестовую личность покупателя; идентичность не берётся из тела checkout. */
function caller(id = 7, email: string | null = "buyer@example.test") {
  const user: User = {
    id,
    email,
    openId: `shop-test-${id}`,
    name: null,
    phone: null, contactPhone: null,
    passwordHash: null,
    sessionVersion: 0, profileRevision: 0,
    loginMethod: "email",
    gender: null,
    avatarUrl: null,
    role: "user",
    blockedAt: null,
    blockedReason: null,
    accountDeletionRequestedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return shopRouter.createCaller({ user, req: {}, res: {} } as TrpcContext);
}

/** Читает локальный redirect без перехода к провайдеру или запуска оплаты. */
async function legacyCheckout(productId: string) {
  const response = await fetch(`${base}/api/pay/${productId}`, {
    redirect: "manual",
  });
  expect(response.status).toBe(302);
  return response.headers.get("location")!;
}

/** Сверяет уникальные orderId в URL и SQL-boundary, product identity и существующий предел длины колонки. */
function expectSeparatePendingOrders(urls: string[], productId: string) {
  const ids = urls.map((url) => new URL(url).searchParams.get("order_id"));
  expect(new Set(ids).size).toBe(urls.length);
  expect(persistence.orders).toHaveLength(urls.length);
  expect(new Set(persistence.orders.map((order) => order.orderId))).toEqual(
    new Set(ids),
  );
  for (const id of ids) {
    expect(id).toBeTruthy();
    expect(parseShopProductId(id!)).toBe(productId);
    expect(id!.length).toBeLessThanOrEqual(80); // existing SQL column, no migration
  }
}

/** Одинаковое время не смешивает двух покупателей: заявки, email, подпись и user metadata соответствуют каждой ссылке. */
it("keeps simultaneous authenticated checkouts for different buyers separate", async () => {
  const results = await Promise.all([
    caller().createCheckout({ productId: "digital-1" }),
    caller(8, "other@example.test").createCheckout({ productId: "digital-1" }),
  ]);
  expectSeparatePendingOrders(
    results.map((result) => result.url),
    "digital-1",
  );
  expect(persistence.orders).toEqual([
    {
      userId: 7,
      email: "buyer@example.test",
      productId: "digital-1",
      orderId: expect.any(String),
    },
    {
      userId: 8,
      email: "other@example.test",
      productId: "digital-1",
      orderId: expect.any(String),
    },
  ]);
  for (const [index, result] of results.entries()) {
    const query = new URL(result.url).searchParams;
    expect(query.get("_param_userId")).toBe(String(index + 7));
    expect(query.get("customer_email")).toBe(
      index ? "other@example.test" : "buyer@example.test",
    );
    expect(query.get("signature")).toMatch(/^[a-f0-9]{64}$/);
  }
});

/** Анонимные legacy redirects получают разные orderId без выдуманного user/email. */
it("keeps simultaneous legacy redirect checkouts separate", async () => {
  const urls = await Promise.all([
    legacyCheckout("digital-2"),
    legacyCheckout("digital-2"),
  ]);
  expectSeparatePendingOrders(urls, "digital-2");
  expect(
    persistence.orders.every(
      (order) => order.userId === undefined && order.email === undefined,
    ),
  ).toBe(true);
});

/** Два транспорта не создают один orderId при одновременной покупке одинакового товара. */
it("does not collide between authenticated checkout and the legacy redirect", async () => {
  const [modern, legacy] = await Promise.all([
    caller().createCheckout({ productId: "digital-1" }),
    legacyCheckout("digital-1"),
  ]);
  expectSeparatePendingOrders([modern.url, legacy], "digital-1");
});

/** Неизвестный товар отклоняется обоими путями без записи и платёжного redirect. */
it("rejects an unknown product without persisting a pending order", async () => {
  await expect(
    caller().createCheckout({ productId: "unknown" }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  const response = await fetch(`${base}/api/pay/unknown`, {
    redirect: "manual",
  });
  expect(response.status).toBe(404);
  expect(response.headers.get("location")).toBeNull();
  expect(persistence.orders).toEqual([]);
});

/** Унаследованное имя Object не является ключом товара и не создаёт pending запись. */
it.each(["__proto__", "constructor", "toString"])(
  "rejects inherited product keys in authenticated checkout before persistence: %s",
  async (productId) => {
    await expect(caller().createCheckout({ productId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(persistence.orders).toEqual([]);
  },
);

/** Тот же запрет прототипных ключей действует на публичном legacy endpoint. */
it.each(["__proto__", "constructor", "toString"])(
  "rejects inherited product keys in legacy checkout without redirect or write: %s",
  async (productId) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await fetch(`${base}/api/pay/${productId}`, {
      redirect: "manual",
    });
    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
    expect(await response.text()).toBe("unknown product");
    expect(persistence.orders).toEqual([]);
  },
);

/** Авторизованный checkout требует email получателя до сохранения заявки. */
it("rejects a missing buyer email without persisting a pending order", async () => {
  await expect(
    caller(7, null).createCheckout({ productId: "digital-1" }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(persistence.orders).toEqual([]);
});

/** Неверный public origin блокирует запись до построения подписанной ссылки. */
it("does not persist authenticated checkout when its payment link cannot be built", async () => {
  vi.stubEnv("PUBLIC_APP_URL", "");
  await expect(
    caller().createCheckout({ productId: "digital-1" }),
  ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  expect(persistence.orders).toEqual([]);
});

/** Legacy handler возвращает безопасный 500 без Location и частично записанного заказа. */
it("does not persist legacy checkout when its payment link cannot be built", async () => {
  vi.stubEnv("PUBLIC_APP_URL", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await fetch(`${base}/api/pay/digital-1`, {
    redirect: "manual",
  });
  expect(response.status).toBe(500);
  expect(response.headers.get("location")).toBeNull();
  expect(await response.text()).toBe("error");
  expect(persistence.orders).toEqual([]);
});

/** Отсутствие shop и fallback секретов не разрешает неподписанную заявку. */
it("rejects authenticated unsigned checkout before persistence", async () => {
  vi.stubEnv("PRODAMUS_SHOP_SECRET", "");
  vi.stubEnv("PRODAMUS_SECRET", "");
  await expect(
    caller().createCheckout({ productId: "digital-1" }),
  ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  expect(persistence.orders).toEqual([]);
});

/** Legacy путь также не перенаправляет на неподписанную оплату. */
it("rejects legacy unsigned checkout before persistence or redirect", async () => {
  vi.stubEnv("PRODAMUS_SHOP_SECRET", "");
  vi.stubEnv("PRODAMUS_SECRET", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await fetch(`${base}/api/pay/digital-1`, {
    redirect: "manual",
  });
  expect(response.status).toBe(500);
  expect(response.headers.get("location")).toBeNull();
  expect(await response.text()).toBe("error");
  expect(persistence.orders).toEqual([]);
});

/** SQL exception не отражает в логе приватные параметры покупателя или подписанный URL. */
it("does not log private database error details when a legacy order write fails", async () => {
  const privateMarker = "SYNTHETIC_PRIVATE_BUYER_AND_SIGNED_URL";
  vi.spyOn(database, "createShopPurchase").mockRejectedValueOnce(
    new Error(`SQL parameters: ${privateMarker}`),
  );
  const logs = vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await fetch(`${base}/api/pay/digital-1`, {
    redirect: "manual",
  });
  expect(response.status).toBe(500);
  expect(response.headers.get("location")).toBeNull();
  expect(await response.text()).toBe("error");
  expect(logs).toHaveBeenCalled();
  expect(logs.mock.calls.flat().map(String).join(" ")).not.toContain(
    privateMarker,
  );
});
