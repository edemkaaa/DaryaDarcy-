/** Best-effort push не срывает завершённое действие и не раскрывает токены при сбое хранилища. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as db from "../apps/backend/src/db";
import {
  sendMarketingPostNotification,
  sendServicePushNotification,
} from "../apps/backend/src/push";

const token = "ExponentPushToken[private-fixture]";
/** Создаём синтетическое SQL-сообщение с фиктивным токеном для проверки редактирования логов. */
const privateFailure = () =>
  new Error(`SELECT token FROM push_tokens: ${token}`);

/** БД выключена; любой внешний fetch запрещён, console.warn перехвачен для точной проверки. */
beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("No provider request is allowed after a storage failure");
    }),
  );
});

/** Снимаем spies и все подмены окружения/глобалов. */
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/** Сбой поиска адресатов даёт 0 доставок и только общее сообщение. */
it("service notification contains a recipient-store failure without logging tokens or SQL", async () => {
  vi.spyOn(db, "getPushTokensForUser").mockRejectedValue(privateFailure());

  await expect(
    sendServicePushNotification({
      userId: 42,
      title: "Fixture",
      body: "Fixture",
    }),
  ).resolves.toBe(0);

  expect(fetch).not.toHaveBeenCalled();
  expect(console.warn).toHaveBeenCalledExactlyOnceWith(
    "[Push] Service notification failed",
  );
});

/** Даже отказ повторной проверки аудитории не выбрасывается наружу после основного commit. */
it("service notification contains an asynchronous audience recheck failure instead of rejecting after commit", async () => {
  vi.spyOn(db, "getPushTokensForUser").mockResolvedValue([token]);
  vi.spyOn(db, "getServicePushTokens").mockRejectedValueOnce(privateFailure());

  await expect(
    sendServicePushNotification({
      userId: 42,
      title: "Fixture",
      body: "Fixture",
    }),
  ).resolves.toBe(0);

  expect(fetch).not.toHaveBeenCalled();
  expect(console.warn).toHaveBeenCalledExactlyOnceWith(
    "[Push] Service notification failed",
  );
});

/** Маркетинговая отправка также подавляет транспортный сбой, не логируя список получателей. */
it("marketing notification contains a storage failure without logging recipient data", async () => {
  vi.spyOn(db, "getMarketingPushTokens").mockRejectedValue(privateFailure());

  await expect(
    sendMarketingPostNotification("Fixture", 42, "club"),
  ).resolves.toBeUndefined();

  expect(fetch).not.toHaveBeenCalled();
  expect(console.warn).toHaveBeenCalledExactlyOnceWith(
    "[Push] Marketing notification failed",
  );
});
