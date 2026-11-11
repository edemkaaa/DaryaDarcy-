import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { createServer, request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import { createConnection, type Connection, type RowDataPacket } from "mysql2/promise";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { build } from "esbuild";
import superjson from "superjson";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { emailToOpenId, getDb } from "../apps/backend/src/db";
import { sdk } from "../apps/backend/src/_core/sdk";

/** Проверяет гостевую LIVE-ветку создания и восстановления заказа через настоящий HTTP и SQL без реальной оплаты. */
describe.skipIf(!testDatabaseUrl)(
  "guest normal checkout recovery over HTTP and SQL",
  () => {
    let conn: Connection, app: INestApplication, base: string;
    let input: {
      idempotencyKey: string;
      recoveryToken: string;
      email: string;
      plan: "monthly";
      contactPhone: string;
    };
    const emails = [
      "guest-recovery@example.test",
      "other-guest-recovery@example.test",
      "new-guest-recovery@example.test",
    ];
    /** Читает контрольные строки платежей, намерений и пользователя отдельной базы. */
    async function rows(query: string, values: unknown[] = []) {
      return (await conn.query<RowDataPacket[]>(query, values))[0];
    }
    /** Удаляет только триггер и данные трёх синтетических адресов, начиная с дочерних записей. */
    async function cleanup() {
      await conn.query("DROP TRIGGER IF EXISTS owned_guest_ledger_failure");
      const ids = await rows(
        "SELECT id FROM users WHERE email IN (?,?,?)",
        emails,
      );
      for (const { id } of ids) {
        await conn.query(
          "DELETE FROM normal_checkout_requests WHERE actorUserId=?",
          [id],
        );
        for (const table of ["billing_receipts", "billing_profiles", "access_email_outbox", "password_tokens"])
          await conn.query(`DELETE FROM ${table} WHERE userId=?`, [id]);
        await conn.query("DELETE FROM club_payments WHERE userId=?", [id]);
        await conn.query("DELETE FROM users WHERE id=?", [id]);
      }
    }
    /** Формирует секретное доказательство восстановления из UUID операции и независимого токена. */
    const proof = () => ({
      idempotencyKey: input.idempotencyKey,
      recoveryToken: input.recoveryToken,
    });
    /** Отправляет процедуру клуба настоящим POST и разбирает superjson вместе с cookie и заголовками кеширования. */
    async function call(
      method: string,
      data: unknown,
      headers: Record<string, string> = {},
      target = base,
    ) {
      const r = await fetch(`${target}/api/trpc/club.${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: superjson.stringify(data),
      });
      const body = await r.json();
      return {
        code: r.status,
        data: body.result
          ? superjson.deserialize<any>(body.result.data)
          : body.error?.json?.data?.code,
        cookie: r.headers.get("set-cookie"),
        cache: r.headers.get("cache-control"),
        retry: r.headers.get("retry-after"),
      };
    }
    /** Создаёт или повторяет гостевой checkout с управляемым телом и авторизацией. */
    const create = (data: unknown = input, headers?: Record<string, string>) =>
      call("createGuestNormalCheckout", data, headers);
    /** Запрашивает состояние гостевого checkout только по полному доказательству восстановления. */
    const status = (data: unknown = proof()) =>
      call("guestNormalCheckoutStatus", data);
    /** Захватывает тестовую advisory-блокировку и поднимает локальный API с отдельной базой. */
    beforeAll(async () => {
      conn = await openTestDatabase();
      expect(
        (
          await rows(
            "SELECT GET_LOCK('backend_test_normal_checkout',30) AS held",
          )
        )[0].held,
      ).toBe(1);
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "guest-recovery-synthetic-session-only");
      vi.stubEnv("PUBLIC_APP_URL", "https://club.example.test");
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    }, 45_000);
    /** Возвращает синтетические LIVE-настройки и создаёт два существующих аккаунта без изменения их паролей. */
    beforeEach(async () => {
      await cleanup();
      vi.stubEnv("GUEST_CHECKOUT_RECOVERY_ENABLED", "true");
      vi.stubEnv("PRODAMUS_TEST_ENABLED", "false");
      vi.stubEnv("YOOKASSA_TEST_ENABLED", "false");
      vi.stubEnv("PRODAMUS_PAYFORM_URL", "https://fixture.payform.ru");
      vi.stubEnv("PRODAMUS_SECRET", "synthetic-merchant-key");
      vi.stubEnv("PRODAMUS_SUBSCRIPTION_ID", "123");
      await conn.query(
        "INSERT INTO users(id,openId,email,passwordHash,role) VALUES (981401,'guest-recovery-member',?,'PRESERVED_HASH','user'),(981402,'guest-recovery-other',?,'OTHER_HASH','user')",
        emails.slice(0, 2),
      );
      input = {
        idempotencyKey: randomUUID(),
        recoveryToken: randomBytes(32).toString("base64url"),
        email: emails[0],
        plan: "monthly",
        contactPhone: "+79991234567",
      };
    });
    /** Удаляет только собственные данные, освобождает advisory-блокировку, закрывает приложение и SQL-пул. */
    afterAll(async () => {
      await app?.close();
      if (conn) {
        await cleanup();
        await conn.query("SELECT RELEASE_LOCK('backend_test_normal_checkout')");
        await conn.end();
      }
      await (
        (await getDb()) as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    /** Проверяет совместимое восстановление старого намерения с NULL-телефоном без смены заказа. */
    it("recovers an old guest order with NULL contact without rotating the order", async () => {
      const first = await create();
      expect(first.code).toBe(200);
      const oldHash = createHash("sha256").update(JSON.stringify(["v1", input.plan, input.email])).digest("hex");
      await conn.query("UPDATE club_payments SET contactPhone=NULL WHERE orderId=?", [first.data.orderId]);
      await conn.query("UPDATE normal_checkout_requests SET requestHash=? WHERE orderId=?", [oldHash, first.data.orderId]);
      const { contactPhone: ignored, ...oldInput } = input;
      expect((await call("createGuestNormalCheckout", oldInput)).data).toEqual(first.data);
      expect(await rows("SELECT contactPhone FROM club_payments WHERE userId=981401")).toEqual([{ contactPhone: null }]);
    });
    /** Проверяет обязательный контакт нового заказа, нормализацию и конфликт изменённого телефона на повторе без изменения карточки до оплаты. */
    it("requires contact before new guest creation and preserves it on replay", async () => {
      await conn.query("UPDATE users SET contactPhone='+12025550123' WHERE id=981401");
      const { contactPhone: ignored, ...missing } = input;
      expect((await call("createGuestNormalCheckout", missing)).code).toBe(400);
      expect(await rows("SELECT orderId FROM club_payments WHERE userId=981401")).toHaveLength(0);
      const first = await call("createGuestNormalCheckout", { ...input, contactPhone: "8 (999) 123-45-67" });
      expect(first.code).toBe(200);
      expect(await rows("SELECT contactPhone FROM club_payments WHERE userId=981401")).toEqual([{ contactPhone: "+79991234567" }]);
      expect((await call("createGuestNormalCheckout", { ...input, contactPhone: "+447700900123" })).code).toBe(409);
      expect((await create()).data).toEqual(first.data);
      expect(await rows("SELECT orderId FROM club_payments WHERE userId=981401")).toHaveLength(1);
      expect((await rows("SELECT phone FROM users WHERE id=981401"))[0].phone).toBeNull();
      expect(await rows("SELECT contactPhone FROM users WHERE id=981401")).toEqual([{ contactPhone: "+12025550123" }]);
    });
    /** Проверяет единственный pending-заказ без cookie, изменения идентичности и преждевременной выдачи доступа. */
    it("replays one order without a login cookie, identity changes or an access grant", async () => {
      const identity = await rows(
        "SELECT id,email,passwordHash,role,sessionVersion FROM users WHERE id=981401",
      );
      const first = await create();
      expect(first.code).toBe(200);
      expect(first.data.state).toBe("pending");
      expect(first.cookie).toBeNull();
      expect(first.cache).toContain("no-store");
      expect((await create()).data).toEqual(first.data);
      expect((await status()).data).toEqual({
        state: "pending",
        orderId: first.data.orderId,
      });
      expect(
        await rows(
          "SELECT id,email,passwordHash,role,sessionVersion FROM users WHERE id=981401",
        ),
      ).toEqual(identity);
      expect(
        await rows("SELECT orderId FROM club_payments WHERE userId=981401"),
      ).toHaveLength(1);
      expect(
        await rows("SELECT * FROM billing_receipts WHERE userId=981401"),
      ).toHaveLength(0);
      expect(new URL(first.data.url).searchParams.get("subscription")).toBe(
        "123",
      );
      expect(first.data.url).not.toContain(input.recoveryToken);
    });
    /** Разрывает прокси-соединение после успешного ответа API и восстанавливает закоммиченный заказ по доказательству без дубля. */
    it("recovers after the HTTP connection loses the committed response", async () => {
      let upstreamStatus: number | undefined;
      const proxy = createServer((req, res) => {
        const upstream = httpRequest(
          new URL(req.url!, base),
          { method: req.method, headers: req.headers },
          (reply) => {
            upstreamStatus = reply.statusCode;
            reply.resume();
            reply.on("end", () => res.destroy());
          },
        );
        upstream.on("error", () => res.destroy());
        req.pipe(upstream);
      });
      await new Promise<void>((resolve) =>
        proxy.listen(0, "127.0.0.1", resolve),
      );
      try {
        const target = `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`;
        await expect(
          call("createGuestNormalCheckout", input, {}, target),
        ).rejects.toThrow();
        expect(upstreamStatus).toBe(200);
        expect((await status()).data.state).toBe("pending");
        expect((await create()).code).toBe(200);
        expect(
          await rows("SELECT orderId FROM club_payments WHERE userId=981401"),
        ).toHaveLength(1);
      } finally {
        proxy.closeAllConnections();
        await new Promise<void>((resolve) => proxy.close(() => resolve()));
      }
    });
    /** Проверяет сериализацию трёх повторов с созданием одного нового получателя и одного заказа. */
    it("serializes concurrent retries and creates only one canonical new recipient", async () => {
      input.email = emails[2];
      const replies = await Promise.all([create(), create(), create()]);
      expect(replies.map((x) => x.code)).toEqual([200, 200, 200]);
      expect(new Set(replies.map((x) => x.data.orderId)).size).toBe(1);
      expect(
        await rows("SELECT id FROM users WHERE email=?", [emails[2]]),
      ).toHaveLength(1);
      expect(await rows("SELECT email,contactPhone,phone FROM users WHERE email=?", [emails[2]]))
        .toEqual([{ email: emails[2], contactPhone: null, phone: null }]);
      expect(
        await rows("SELECT orderId FROM club_payments WHERE email=?", [
          emails[2],
        ]),
      ).toHaveLength(1);
    });
    /** Подтверждает синтетическим подписанным webhook именно второй заказ и проверяет запись только его телефона в пустую карточку. */
    it("fills a new guest card only from the order that was paid", async () => {
      const email = emails[2];
      vi.stubEnv("AUTH_LINK_ENCRYPTION_KEY", Buffer.alloc(32, 8).toString("base64"));
      const first = await create({ ...input, email });
      const paidPhone = "+447700900123";
      const second = await create({
        ...input,
        email,
        idempotencyKey: randomUUID(),
        contactPhone: paidPhone,
      });
      expect([first.code, second.code]).toEqual([200, 200]);
      expect(second.data.orderId).not.toBe(first.data.orderId);
      expect(await rows("SELECT contactPhone FROM users WHERE email=?", [email]))
        .toEqual([{ contactPhone: null }]);
      const body = JSON.stringify({
        currency: "rub",
        customer_email: email,
        domain: "fixture.payform.ru",
        order_id: "98140901",
        order_num: second.data.orderId,
        payment_status: "success",
        subscription: { id: "123", profile_id: "981409" },
        sum: "790.00",
      });
      const paid = await fetch(base + "/api/prodamus/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Sign: createHmac("sha256", "synthetic-merchant-key").update(body).digest("hex"),
        },
        body,
      });
      expect([paid.status, await paid.text()]).toEqual([200, "success"]);
      expect(await rows("SELECT contactPhone,phone FROM users WHERE email=?", [email]))
        .toEqual([{ contactPhone: paidPhone, phone: null }]);
    });
    /** Удерживает конкурентную регистрацию того же email и проверяет сохранность созданной ею карточки после продолжения checkout. */
    it("preserves an account created while guest checkout waits on the same email", async () => {
      const email = emails[2];
      const registration = await createConnection(testDatabaseUrl!);
      try {
        await registration.beginTransaction();
        await registration.query(
          "INSERT INTO users(openId,email,name,loginMethod) VALUES (?,?,'Registration name','email')",
          [emailToOpenId(email), email],
        );
        const checkout = create({ ...input, email });
        try {
          await vi.waitFor(async () => {
            const queries = await rows("SHOW FULL PROCESSLIST");
            expect(queries.some(({ Info }) =>
              /insert into `users`/i.test(String(Info)) &&
              String(Info).includes(email),
            )).toBe(true);
          }, { timeout: 3000, interval: 25 });
          await registration.commit();
        } finally {
          await registration.rollback();
          await checkout;
        }
        expect((await checkout).code).toBe(200);
        expect(await rows("SELECT name,profileRevision,contactPhone FROM users WHERE email=?", [email]))
          .toEqual([{ name: "Registration name", profileRevision: 0, contactPhone: null }]);
      } finally {
        await registration.end();
      }
    });
    /** Проверяет невозможность восстановить чужую операцию только по UUID или почте без правильного секрета. */
    it("does not recover someone else's operation with only UUID or email", async () => {
      const first = await create();
      expect(first.code).toBe(200);
      expect(
        (
          await status({
            ...proof(),
            recoveryToken: randomBytes(32).toString("base64url"),
          })
        ).data,
      ).toEqual({ state: "notRecorded" });
      expect(
        (await status({ ...proof(), idempotencyKey: randomUUID() })).data,
      ).toEqual({ state: "notRecorded" });
      expect(
        (
          await status({
            idempotencyKey: input.idempotencyKey,
            email: input.email,
          })
        ).code,
      ).toBe(400);
    });
    /** Проверяет конфликт изменённых email и тарифа вместо создания второго заказа. */
    it("rejects changed parameters rather than creating another order", async () => {
      expect((await create()).code).toBe(200);
      expect((await create({ ...input, email: emails[1] })).code).toBe(409);
      expect((await create({ ...input, plan: "semiannual" })).code).toBe(409);
      expect(
        await rows(
          "SELECT orderId FROM club_payments WHERE userId IN (981401,981402)",
        ),
      ).toHaveLength(1);
    });
    /** Проверяет разделение гостевого и авторизованного пространств операций и продолжение только своего существующего гостевого намерения. */
    it("keeps namespaces separate and resumes only an existing owned guest intent after login", async () => {
      expect((await create()).code).toBe(200);
      vi.stubEnv("NORMAL_CHECKOUT_RECOVERY_ENABLED", "true");
      const token = await sdk.createSessionToken("guest-recovery-member", {
        sessionVersion: 0,
      });
      const r = await fetch(
        `${base}/api/trpc/club.normalCheckoutStatus?input=${encodeURIComponent(superjson.stringify({ idempotencyKey: input.idempotencyKey }))}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(r.status).toBe(200);
      expect(superjson.deserialize((await r.json()).result.data)).toEqual({
        state: "notRecorded",
      });
      expect(
        (await create(input, { Authorization: `Bearer ${token}` })).data.state,
      ).toBe("pending");
      expect(
        (
          await create(
            { ...input, idempotencyKey: randomUUID() },
            { Authorization: `Bearer ${token}` },
          )
        ).code,
      ).toBe(400);
      const other = await sdk.createSessionToken("guest-recovery-other", {
        sessionVersion: 0,
      });
      expect(
        (await create(input, { Authorization: `Bearer ${other}` })).code,
      ).toBe(403);
      expect(
        (
          await call("guestNormalCheckoutStatus", proof(), {
            Authorization: `Bearer ${other}`,
          })
        ).code,
      ).toBe(403);
    });
    /** Проверяет единственного победителя и безопасный конфликт при гонке одного ключа с двумя получателями. */
    it("conflicts safely when the same intent races with two recipients", async () => {
      const r = await Promise.all([
        create(),
        create({ ...input, email: emails[1] }),
      ]);
      expect(r.map((v) => v.code).sort()).toEqual([200, 409]);
      expect(
        await rows(
          "SELECT orderId FROM club_payments WHERE userId IN (981401,981402)",
        ),
      ).toHaveLength(1);
    });
    /** Проверяет нормализацию email и прежний полугодовой тариф без параметра автопродления. */
    it("normalizes email and preserves the existing non-recurring semiannual contract", async () => {
      const r = await create({
        ...input,
        email: " GUEST-RECOVERY@EXAMPLE.TEST ",
        plan: "semiannual",
      });
      expect(r.code).toBe(200);
      const url = new URL(r.data.url);
      expect(url.searchParams.get("customer_email")).toBe(emails[0]);
      expect(url.searchParams.has("subscription")).toBe(false);
      expect(
        await rows("SELECT sum FROM club_payments WHERE userId=981401"),
      ).toEqual([{ sum: "4740" }]);
    });
    /** Собирает production ESM и проверяет восстановление одного закоммиченного заказа независимыми процессами. */
    it("replays the committed operation across independent compiled processes", async () => {
      const directory = mkdtempSync(resolve(".tmp-guest-recovery-")),
        entry = join(directory, "application.mjs");
      try {
        await build({
          stdin: {
            resolveDir: process.cwd(),
            loader: "ts",
            contents: `
        import {createBackendApplication} from './apps/backend/src/_core/application';
        import {getDb} from './apps/backend/src/db';
        import superjson from 'superjson';
        const app=await createBackendApplication();
        try{await app.listen(0,'127.0.0.1');const base='http://127.0.0.1:'+app.getHttpServer().address().port;
          const r=await fetch(base+'/api/trpc/club.createGuestNormalCheckout',{method:'POST',headers:{'Content-Type':'application/json'},body:superjson.stringify(${JSON.stringify(input)})});
          if(r.status!==200)throw new Error('Guest recovery refused');
          console.log('GUEST_RESULT:'+JSON.stringify(superjson.deserialize((await r.json()).result.data)));
        }finally{await app.close();await (await getDb())?.$client.end();}
      `,
          },
          platform: "node",
          bundle: true,
          packages: "external",
          format: "esm",
          outfile: entry,
        });
        /** Запускает отдельный собранный процесс с синтетической конфигурацией и извлекает только маркированный результат checkout. */
        const run = () => {
          const raw = execFileSync(process.execPath, [entry], {
            cwd: tmpdir(),
            encoding: "utf8",
            timeout: 10_000,
            env: {
              NODE_ENV: "production",
              DATABASE_URL: testDatabaseUrl!,
              JWT_SECRET: "compiled-guest-synthetic-secret-32-bytes",
              PUBLIC_APP_URL: "https://club.example.test",
              GUEST_CHECKOUT_RECOVERY_ENABLED: "true",
              PRODAMUS_TEST_ENABLED: "false",
              YOOKASSA_TEST_ENABLED: "false",
              PRODAMUS_PAYFORM_URL: "https://fixture.payform.ru",
              PRODAMUS_SECRET: "synthetic-merchant-key",
              PRODAMUS_SUBSCRIPTION_ID: "123",
            },
          });
          return JSON.parse(
            raw
              .split("\n")
              .find((line) => line.startsWith("GUEST_RESULT:"))!
              .slice("GUEST_RESULT:".length),
          );
        };
        const first = run();
        expect(run()).toEqual(first);
        expect((await status()).data).toEqual({
          state: "pending",
          orderId: first.orderId,
        });
        expect(
          await rows("SELECT orderId FROM club_payments WHERE userId=981401"),
        ).toHaveLength(1);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }, 30_000);
    /** Проверяет закрытый отказ выключенной, неполной или TEST-конфигурации без создания заказа. */
    it("refuses missing/disabled configuration and TEST routing without DB writes", async () => {
      vi.stubEnv("GUEST_CHECKOUT_RECOVERY_ENABLED", "false");
      expect((await create()).code).toBe(412);
      vi.stubEnv("GUEST_CHECKOUT_RECOVERY_ENABLED", "true");
      vi.stubEnv("PRODAMUS_SECRET", "");
      expect((await create()).code).toBe(412);
      vi.stubEnv("PRODAMUS_SECRET", "synthetic-merchant-key");
      vi.stubEnv("PRODAMUS_TEST_ENABLED", "true");
      expect((await create()).code).toBe(412);
      vi.stubEnv("PRODAMUS_TEST_ENABLED", "false");
      expect(
        (await create(input, { "idempotency-key": randomUUID() })).code,
      ).toBe(412);
      expect(
        await rows("SELECT orderId FROM club_payments WHERE userId=981401"),
      ).toHaveLength(0);
    });
    /** Проверяет чтение статуса без боевого секрета и отказ повторного создания при изменившейся конфигурации продавца. */
    it("recovers status without live keys and refuses merchant drift for replay", async () => {
      const first = await create();
      expect(first.code).toBe(200);
      vi.stubEnv("PRODAMUS_SECRET", "");
      expect((await status()).data.state).toBe("pending");
      expect((await create()).code).toBe(412);
      vi.stubEnv("PRODAMUS_SECRET", "different-synthetic-secret");
      expect((await create()).code).toBe(412);
      expect(
        await rows("SELECT orderId FROM club_payments WHERE userId=981401"),
      ).toHaveLength(1);
    });
    /** Проверяет откат заказа при отказе durable-журнала и допустимый повтор после удаления собственного триггера. */
    it("rolls back the order if the durable ledger cannot commit", async () => {
      await conn.query(
        "CREATE TRIGGER owned_guest_ledger_failure BEFORE INSERT ON normal_checkout_requests FOR EACH ROW BEGIN IF NEW.actorUserId=981401 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic guest ledger failure'; END IF; END",
      );
      expect((await create()).code).toBe(500);
      expect((await status()).data).toEqual({ state: "notRecorded" });
      expect(
        await rows("SELECT orderId FROM club_payments WHERE userId=981401"),
      ).toHaveLength(0);
      await conn.query("DROP TRIGGER owned_guest_ledger_failure");
      expect((await create()).code).toBe(200);
    });
    /** Проверяет, что paid-строки без квитанции недостаточно для успеха, а settlement-доказательство разрешает восстановление результата. */
    it("requires settlement evidence and never promotes a bare paid row to success", async () => {
      const first = await create();
      expect(first.code).toBe(200);
      await conn.query(
        "UPDATE club_payments SET status='paid',paidAt=NOW(),expiresAt=DATE_ADD(NOW(),INTERVAL 30 DAY) WHERE orderId=?",
        [first.data.orderId],
      );
      expect((await status()).code).toBe(500);
      await conn.query(
        "INSERT INTO billing_receipts(paymentKey,userId,orderId,payloadHash,amountMinor) VALUES (?,981401,?,?,79000)",
        ["a".repeat(64), first.data.orderId, "b".repeat(64)],
      );
      const result = await status();
      expect(result.code).toBe(200);
      expect(result.data.state).toBe("succeeded");
      expect((await create()).data).toEqual(result.data);
    });
    /** Проверяет сохранение failed-результата без автоматического заказа-замены. */
    it("preserves a failed outcome without creating a replacement", async () => {
      const first = await create();
      expect(first.code).toBe(200);
      await conn.query(
        "UPDATE club_payments SET status='failed' WHERE orderId=?",
        [first.data.orderId],
      );
      expect((await status()).data).toEqual({
        state: "failed",
        orderId: first.data.orderId,
      });
      expect((await create()).data).toEqual({
        state: "failed",
        orderId: first.data.orderId,
      });
    });
    /** Проверяет запрет чтения и повтора для заблокированного или удаляющегося получателя. */
    it("blocks reads and retries for a blocked or retiring recipient", async () => {
      expect((await create()).code).toBe(200);
      await conn.query("UPDATE users SET blockedAt=NOW() WHERE id=981401");
      expect((await status()).code).toBe(403);
      expect((await create()).code).toBe(403);
      await conn.query(
        "UPDATE users SET blockedAt=NULL,accountDeletionRequestedAt=NOW() WHERE id=981401",
      );
      expect((await create()).code).toBe(403);
    });
    /** Проверяет строгую форму доказательства, запрет GET и batch без отражения секрета. */
    it("rejects malformed secrets, GET and batch without exposing proof in a response", async () => {
      expect(
        (await create({ ...input, recoveryToken: "not-a-proof" })).code,
      ).toBe(400);
      expect((await create({ ...input, userId: 981402 })).code).toBe(400);
      expect(
        (
          await fetch(
            `${base}/api/trpc/club.guestNormalCheckoutStatus?input=${encodeURIComponent(superjson.stringify(proof()))}`,
          )
        ).status,
      ).toBe(405);
      const r = await fetch(
        `${base}/api/trpc/club.guestNormalCheckoutStatus?batch=1`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 0: superjson.serialize(proof()) }),
        },
      );
      expect(r.status).toBe(400);
      expect(await r.text()).not.toContain(input.recoveryToken);
    });
    /** Проверяет обязательность durable-ветки для старого гостевого LIVE-входа только при включённом флаге. */
    it("requires the durable path for legacy guest LIVE checkout only when enabled", async () => {
      expect((await call("createCheckout", { email: input.email, contactPhone: input.contactPhone })).code).toBe(
        412,
      );
      vi.stubEnv("GUEST_CHECKOUT_RECOVERY_ENABLED", "invalid");
      expect((await call("createCheckout", { email: input.email, contactPhone: input.contactPhone })).code).toBe(
        412,
      );
      expect((await create()).code).toBe(412);
      vi.stubEnv("GUEST_CHECKOUT_RECOVERY_ENABLED", "false");
      expect((await call("createCheckout", { email: input.email, contactPhone: input.contactPhone })).code).toBe(
        200,
      );
    });
    /** Изолирует окно квоты одного доказательства и проверяет 429 с Retry-After без создания заказов. */
    it("bounds status polling and returns Retry-After without creating orders", async () => {
      // This test measures one proof budget, independently of the previous HTTP
      // cases' shared IP budget. Production limits remain unchanged.
      const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 61_000);
      try {
        for (let i = 0; i < 12; i++) expect((await status()).code).toBe(200);
        const r = await status();
        expect(r.code).toBe(429);
        expect(Number(r.retry)).toBeGreaterThan(0);
        expect(await rows("SELECT orderId FROM club_payments WHERE userId=981401")).toHaveLength(0);
      } finally { clock.mockRestore(); }
    });
  },
);
