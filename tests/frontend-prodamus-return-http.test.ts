/** Связка реального frontend caller с локальным TEST-контроллером проверяет общий quota bucket. */
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { readProdamusReturnResult } from "../apps/frontend/src/features/club/prodamus-return-api";

let app: INestApplication;
const actualFetch = globalThis.fetch;
/** Поднимаем loopback Nest без БД; fetch меняет лишь базу относительного браузерного URL. */
beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("PUBLIC_APP_URL", "https://daryadarcy.dev.reeskeen.ru");
  vi.stubEnv("PRODAMUS_TEST_ENABLED", "true");
  vi.stubEnv("PRODAMUS_TEST_PAYFORM_URL", "https://testpage1.payform.ru");
  vi.stubEnv("PRODAMUS_TEST_SECRET", "a".repeat(64));
  vi.stubEnv("YOOKASSA_TEST_ENABLED", "false");
  app = await createBackendApplication({
    allowedPostPaths: ["/api/prodamus/test/result"],
  });
  await app.listen(0, "127.0.0.1");
  const base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  // Only adapt the browser's relative URL; keep the real HTTP quota/controller.
  vi.stubGlobal("fetch", (input: RequestInfo | URL, options?: RequestInit) =>
    actualFetch(new URL(String(input), base), options),
  );
});
/** Восстанавливаем fetch/окружение и закрываем своё приложение. */
afterAll(async () => {
  vi.unstubAllGlobals();
  await app?.close();
  vi.unstubAllEnvs();
});

/** Невалидная подпись даёт unknown без settlement; 13-я проверка того же ключа получает 429. */
it("the real frontend request reaches TEST result and keeps retries in one quota bucket", async () => {
  // Invalid HMAC: no SQL, settlement, provider, email or session side effects.
  const token =
    `club-test-101-12345678-1234-4000-8000-123456789abc.${Math.floor(Date.now() / 1000) + 3600}.` +
    "b".repeat(64);
  for (let attempt = 0; attempt < 12; attempt++) {
    await expect(
      readProdamusReturnResult(token, new AbortController().signal),
    ).resolves.toEqual({
      state: "unknown",
      nextAction: null,
      emailStatus: null,
    });
  }
  await expect(
    readProdamusReturnResult(token, new AbortController().signal),
  ).rejects.toMatchObject({ status: 429 });
});
