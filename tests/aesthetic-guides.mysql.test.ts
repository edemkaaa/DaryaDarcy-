import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import type { Connection } from "mysql2/promise";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import * as db from "../apps/backend/src/db";

/** Проверяем защищённую выдачу семи текстовых гидов на настоящем HTTP/JWT и текущей подписке SQL. */
describe.skipIf(!testDatabaseUrl)(
  "protected aesthetic guides: native HTTP/JWT/SQL",
  () => {
    let app: INestApplication, conn: Connection, base: string;
    /** Создаём paid/free/staff фикстуры и локальное Nest-приложение с синтетическим JWT. */
    beforeAll(async () => {
      conn = await openTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "library-guide-fixture-only-32-characters");
      await conn.query(
        "INSERT INTO users (id,openId,role) VALUES (9060,'guide-paid','user'),(9061,'guide-free','user'),(9062,'guide-staff','moderator')",
      );
      await conn.query(
        "INSERT INTO club_payments (userId,orderId,status,expiresAt) VALUES (9060,'guide-fixture','paid','2030-01-01')",
      );
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    });
    /** Снимаем подмены и восстанавливаем epoch, блокировки и исходный оплаченный срок своей группы. */
    beforeEach(async () => {
      vi.restoreAllMocks();
      await conn.query(
        "UPDATE users SET blockedAt=NULL,sessionVersion=0 WHERE id BETWEEN 9060 AND 9062",
      );
      await conn.query(
        "UPDATE club_payments SET expiresAt='2030-01-01',cancelAtPeriodEnd=FALSE WHERE orderId='guide-fixture'",
      );
    });
    /** Останавливаем HTTP, удаляем только собственные оплаты и аккаунты, закрываем SQL и окружение. */
    afterAll(async () => {
      vi.restoreAllMocks();
      await app?.close();
      await conn?.query(
        "DELETE FROM club_payments WHERE orderId='guide-fixture'",
      );
      await conn?.query("DELETE FROM users WHERE id BETWEEN 9060 AND 9062");
      await conn?.end();
      await (
        (await db.getDb()) as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    /** Запрашиваем выбранный гид текущим синтетическим actor, неверным токеном или гостем, поддерживая HEAD. */
    async function read(
      key = "cottagecore",
      actor = "guide-paid",
      method = "GET",
    ) {
      return fetch(`${base}/api/library/guides/aesthetics/${key}`, {
        method,
        headers: actor
          ? {
              Authorization: `Bearer ${actor === "invalid" ? actor : await sdk.createSessionToken(actor, { sessionVersion: 0 })}`,
            }
          : {},
      });
    }
    /** Все семь ключей дают только согласованные разделы гида и private,no-store, без дополнительных полей. */
    it.each([
      "cottagecore",
      "goblincore",
      "witchcore",
      "castlecore",
      "fairycore",
      "darkAcademia",
      "lightAcademia",
    ])("returns only five paid sections for %s", async (key) => {
      const response = await read(key);
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      const data = await response.json();
      expect(Object.keys(data).sort()).toEqual(
        ["key", "style", "space", "rituals", "blog", "inspiration"].sort(),
      );
      expect(data.key).toBe(key);
      expect(data.style.intro.length).toBeGreaterThan(30);
    });
    /** Гость, неверный токен и бесплатный аккаунт получают одинаковый закрытый ответ без тела гида. */
    it.each(["", "invalid", "guide-free"])(
      "denies guest/invalid/unpaid %s without content",
      async (actor) => {
        const response = await read("cottagecore", actor);
        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({
          error: "Материал недоступен.",
        });
        expect(response.headers.get("cache-control")).toBe("private, no-store");
      },
    );
    /** Прототипные ключи, неизвестный материал и лишний query не проходят канонический маршрут. */
    it.each(["constructor", "__proto__", "unknown", "cottagecore?x=1"])(
      "rejects noncanonical key/query %s",
      async (key) => {
        expect((await read(key)).status).toBe(404);
      },
    );
    /** После успешного чтения блокировка или новый epoch немедленно закрывают прежнюю сессию. */
    it.each(["blockedAt=NOW()", "sessionVersion=1"])(
      "rechecks live identity after %s",
      async (patch) => {
        expect((await read()).status).toBe(200);
        await conn.query(`UPDATE users SET ${patch} WHERE id=9060`);
        expect((await read()).status).toBe(404);
      },
    );
    /** Запрос отмены сохраняет оплаченный срок; истёкший срок закрывает материал, staff-доступ остаётся отдельным. */
    it("rechecks expiry, preserves paid-until-end cancellation and service access", async () => {
      await conn.query(
        "UPDATE club_payments SET cancelAtPeriodEnd=TRUE WHERE orderId='guide-fixture'",
      );
      expect((await read()).status).toBe(200);
      await conn.query(
        "UPDATE club_payments SET expiresAt='2020-01-01' WHERE orderId='guide-fixture'",
      );
      expect((await read()).status).toBe(404);
      expect((await read("cottagecore", "guide-staff")).status).toBe(200);
    });
    /** Изолированно подменяем лишь ошибку читателя подписки: HTTP503 не раскрывает SQL-маркер и не выдаёт гостевой успех. */
    it("does not turn infrastructure failure into guest or disclose internals", async () => {
      vi.spyOn(db, "getActiveClubSubscription").mockRejectedValueOnce(
        new Error("private-sql-marker"),
      );
      const response = await read();
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        error: "Материал временно недоступен.",
      });
    });
    /** HEAD проходит ту же авторизацию, но никогда не передаёт закрытый текст. */
    it("HEAD checks access and sends no paid body", async () => {
      const response = await read("cottagecore", "guide-paid", "HEAD");
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("");
      expect((await read("cottagecore", "guide-free", "HEAD")).status).toBe(
        404,
      );
    });
  },
);
