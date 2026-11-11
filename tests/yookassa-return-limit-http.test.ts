/** Настоящий локальный HTTP проверяет quota до выключенного TEST provider и без SQL. */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
} from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import superjson from "superjson";
import { createBackendApplication } from "../apps/backend/src/_core/application";

let app: INestApplication;
let base: string;
let windowIndex = 0;
/** Запускаем Nest с пустой БД и disabled ЮKassa: разрешённый check заканчивается412, не платёжным эффектом. */
beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("YOOKASSA_TEST_ENABLED", "false");
  app = await createBackendApplication();
  await app.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
});
/** Передвигаем Date за прежнее окно, не добавляя production reset-методов лимитера. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  // Move beyond every preceding window without test-only limiter reset methods.
  vi.setSystemTime(new Date(Date.UTC(2026, 10, 1) + ++windowIndex * 120_000));
});
/** Возвращаем настоящие часы. */
afterEach(() => vi.useRealTimers());
/** Закрываем app/env. */
afterAll(async () => {
  await app?.close();
  vi.unstubAllEnvs();
});
/** Отправляем один reconcile POST с UUID header и управляемым body/forwarded-IP. */
function check(
  key: string | null,
  headers: Record<string, string> = {},
  input?: unknown,
) {
  return fetch(`${base}/api/trpc/club.reconcileCheckout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { "Idempotency-Key": key } : {}),
      ...headers,
    },
    body: JSON.stringify(superjson.serialize(input)),
  });
}

/** 13-я попытка даёт429/no-store/Retry-After без UUID и cookie; другой intent ещё разрешён. */
it("allows twelve checks of one intent then refuses without exposing its key", async () => {
  const key = randomUUID();
  for (let attempt = 0; attempt < 12; attempt++)
    expect((await check(key)).status).toBe(412);
  const blocked = await check(key);
  expect(blocked.status).toBe(429);
  expect(blocked.headers.get("retry-after")).toBe("60");
  expect(blocked.headers.get("cache-control")).toBe("no-store");
  expect(blocked.headers.get("set-cookie")).toBeNull();
  const body = await blocked.json();
  expect(body.error.json.data.code).toBe("TOO_MANY_REQUESTS");
  expect(body.error.json.data.stack).toBeUndefined();
  expect(JSON.stringify(body)).not.toContain(key);
  // The per-intent refusal must not disable another intent before the IP quota.
  expect((await check(randomUUID())).status).toBe(412);
});

/** Регистр UUID не создаёт новый bucket. */
it("normalizes intent UUID casing so uppercase cannot reset the quota", async () => {
  const key = "abcdefab-1234-4123-8123-abcdefabcdef";
  for (let attempt = 0; attempt < 12; attempt++)
    expect((await check(key)).status).toBe(412);
  expect((await check(key.toUpperCase())).status).toBe(429);
});

/** Смена IP не снимает квоту одного intent. */
it("shares the intent budget across resolved IPs", async () => {
  const key = randomUUID();
  for (let attempt = 0; attempt < 12; attempt++) {
    expect(
      (await check(key, { "X-Forwarded-For": `192.0.2.${attempt + 1}` }))
        .status,
    ).toBe(412);
  }
  expect((await check(key, { "X-Forwarded-For": "192.0.2.100" })).status).toBe(
    429,
  );
});

/** Учитывается доверенно resolved remote IP, не произвольный leftmost/X-Real-IP. */
it("allows sixty distinct intents per resolved IP despite forged leftmost forwarded headers", async () => {
  for (let attempt = 0; attempt < 60; attempt++) {
    expect(
      (
        await check(randomUUID(), {
          // Loopback simulates a trusted proxy appending the actual remote IP.
          "X-Forwarded-For": `198.51.100.${attempt + 1}, 192.0.2.200`,
          "X-Real-IP": `203.0.113.${attempt + 1}`,
        })
      ).status,
    ).toBe(412);
  }
  const blocked = await check(randomUUID(), {
    "X-Forwarded-For": "192.0.2.99, 192.0.2.200",
  });
  expect(blocked.status).toBe(429);
  expect(blocked.headers.get("retry-after")).toBe("60");
  expect(
    (await check(randomUUID(), { "X-Forwarded-For": "192.0.2.201" })).status,
  ).toBe(412);
});

/** Отказ IP не истощает intent, который затем приходит с разрешённого адреса. */
it("does not spend an intent budget when its IP is already blocked", async () => {
  for (let attempt = 0; attempt < 60; attempt++) await check(randomUUID());
  const key = randomUUID();
  for (let attempt = 0; attempt < 15; attempt++)
    expect((await check(key)).status).toBe(429);
  for (let attempt = 0; attempt < 12; attempt++) {
    expect(
      (await check(key, { "X-Forwarded-For": "192.0.2.202" })).status,
    ).toBe(412);
  }
  expect((await check(key, { "X-Forwarded-For": "192.0.2.202" })).status).toBe(
    429,
  );
});

/** Невалидный header не даёт бесконечные бесплатные попытки с одного IP. */
it("counts malformed and missing intent headers in the IP budget", async () => {
  for (let attempt = 0; attempt < 60; attempt++) {
    expect((await check(attempt % 2 ? null : "not-a-uuid")).status).toBe(400);
  }
  expect((await check(randomUUID())).status).toBe(429);
});

/** Ошибочный parsed input расходует квоту, но не вызывает оплату. */
it("counts invalid bodies without allowing them to invoke payment storage", async () => {
  const key = randomUUID();
  for (let attempt = 0; attempt < 12; attempt++)
    expect((await check(key, {}, { paid: true })).status).toBe(400);
  expect((await check(key)).status).toBe(429);
});

/** Отказ на59-йсекунде не продлевает60сек окно. */
it("does not extend the window on refusal and resumes only at expiry", async () => {
  const key = randomUUID();
  for (let attempt = 0; attempt < 12; attempt++) await check(key);
  vi.advanceTimersByTime(59_001);
  const blocked = await check(key);
  expect(blocked.status).toBe(429);
  expect(blocked.headers.get("retry-after")).toBe("1");
  vi.advanceTimersByTime(999);
  const allowed = await check(key);
  expect(allowed.status).toBe(412);
  expect(allowed.headers.get("retry-after")).toBeNull();
});

/** 20parallel HTTP дают ровно12допусков и8отказов. */
it("concurrent requests cannot exceed the per-intent budget", async () => {
  const key = randomUUID();
  const responses = await Promise.all(
    Array.from({ length: 20 }, () => check(key)),
  );
  expect(responses.filter((response) => response.status === 412)).toHaveLength(
    12,
  );
  expect(responses.filter((response) => response.status === 429)).toHaveLength(
    8,
  );
});

/** Обычные subscription reads используют отдельную политику. */
it("does not spend the payment-check budget on unrelated subscription queries", async () => {
  for (let attempt = 0; attempt < 65; attempt++) {
    expect((await fetch(`${base}/api/trpc/club.subscription`)).status).toBe(
      200,
    );
  }
  expect((await check(randomUUID())).status).toBe(412);
});
