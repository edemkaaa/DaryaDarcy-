import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { AddressInfo } from "node:net";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import { closeDb } from "../apps/backend/src/db";
import { SessionService } from "../apps/backend/src/identity/session.service";
import * as capabilities from "../apps/backend/src/launch/capabilities";
import type { AppRouter } from "../apps/backend/src/routers";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";

/** Проверяет владельца заказа Магазина и актуальность сессии непосредственно перед записью checkout. */
describe.skipIf(!testDatabaseUrl)(
  "shop checkout with a current session",
  () => {
    const buyer = {
      id: 8464,
      openId: "shop-checkout-buyer",
      email: "buyer@example.test",
    };
    let conn: Connection;
    let app: Awaited<ReturnType<typeof createBackendApplication>>;
    let base: string;
    let token: string;

    /** Удаляет только покупки и аккаунт собственного покупателя. */
    async function cleanup() {
      await conn.query("DELETE FROM shop_purchases WHERE userId=?", [buyer.id]);
      await conn.query("DELETE FROM users WHERE id=?", [buyer.id]);
    }
    /** Поднимает локальный API с synthetic Shop TEST-конфигурацией без внешних платежных запросов. */
    beforeAll(async () => {
      conn = await openTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "synthetic-shop-checkout-session-key-32");
      vi.stubEnv("PUBLIC_APP_URL", "https://shop.example.test");
      vi.stubEnv(
        "PRODAMUS_SHOP_PAYFORM_URL",
        "https://fixture-shop.payform.ru",
      );
      vi.stubEnv("PRODAMUS_SHOP_SECRET", "synthetic-shop-signing-key");
      vi.stubEnv("PRODAMUS_SHOP_DEMO", "1");
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    });
    /** Восстанавливает покупателя и токен; capability выключенной ветки подменяется только внутри процесса suite. */
    beforeEach(async () => {
      await cleanup();
      await conn.query("INSERT INTO users (id,openId,email) VALUES (?,?,?)", [
        buyer.id,
        buyer.openId,
        buyer.email,
      ]);
      token = await sdk.createSessionToken(buyer.openId, { sessionVersion: 0 });
      // Проверяем выключенную ветку только внутри тестового процесса.
      vi.spyOn(capabilities, "requireCapability").mockImplementation(() => {});
    });
    /** Возвращает session/capability методы после каждого сценария. */
    afterEach(() => vi.restoreAllMocks());
    /** Закрывает API, удаляет своего покупателя и заказы и закрывает DB-пул. */
    afterAll(async () => {
      await app?.close();
      if (conn) {
        await cleanup();
        await conn.end();
      }
      await closeDb();
      vi.unstubAllEnvs();
    });

    /** Вызывает настоящий shop.createCheckout владельца для synthetic digital-товара. */
    function checkout() {
      const client = createTRPCProxyClient<AppRouter>({
        links: [
          httpLink({
            url: `${base}/api/trpc`,
            transformer: superjson,
            headers: { Authorization: `Bearer ${token}` },
          }),
        ],
      });
      return client.shop.createCheckout.mutate({ productId: "digital-1" });
    }
    /** Читает только заказы собственного покупателя для сверки identity и pending-статуса. */
    async function orders() {
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT orderId,productId,email,status FROM shop_purchases WHERE userId=?",
        [buyer.id],
      );
      return rows;
    }

    /** Сохранённый pending-заказ совпадает с order_id и email в подписанном provider URL. */
    it("creates a pending order matching the signed URL for the active buyer", async () => {
      const url = new URL((await checkout()).url);
      expect(url.hostname).toBe("fixture-shop.payform.ru");
      expect(url.searchParams.get("customer_email")).toBe(buyer.email);
      const orderId = url.searchParams.get("order_id");
      expect(orderId).toMatch(/^shop-digital-1-/);
      expect(await orders()).toEqual([
        {
          orderId,
          productId: "digital-1",
          email: buyer.email,
          status: "pending",
        },
      ]);
    });

    /** После capture сессии logout или блокировка запрещают позднее создание заказа. */
    it.each(["logout", "account block"])(
      "refuses checkout after %s",
      async (change) => {
        const sessions = app.get(SessionService);
        const readSession = sessions.optionalUser.bind(sessions);
        let entered!: () => void;
        let release!: () => void;
        const authenticated = new Promise<void>((resolve) => {
          entered = resolve;
        });
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        vi.spyOn(sessions, "optionalUser").mockImplementationOnce(
          async (req) => {
            const actor = await readSession(req);
            entered();
            await gate;
            return actor;
          },
        );
        const pending = checkout();
        try {
          await Promise.race([
            authenticated,
            pending.then(() => {
              throw new Error("Expected authenticated request to pause");
            }),
          ]);
          if (change === "logout") {
            const response = await fetch(`${base}/api/auth/logout`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            });
            expect(response.status).toBe(200);
            expect(await response.json()).toEqual({ success: true });
          } else {
            await conn.query("UPDATE users SET blockedAt=NOW() WHERE id=?", [
              buyer.id,
            ]);
          }
          release();
          await expect(pending).rejects.toMatchObject({
            data: { httpStatus: change === "logout" ? 401 : 403 },
          });
          expect(await orders()).toEqual([]);
        } finally {
          release();
          await pending.catch(() => {});
        }
      },
    );
  },
);
