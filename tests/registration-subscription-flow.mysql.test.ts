import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { createHmac, randomUUID } from "node:crypto";
import superjson from "superjson";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { openContentTestDatabase } from "./helpers/content-mysql";
import { openLoopbackSmtp } from "./helpers/loopback-smtp";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { getDb } from "../apps/backend/src/db";
import { processAccessEmails } from "../apps/backend/src/identity/access";
import { sendTransactionalEmail } from "../apps/backend/src/_core/email";
import * as prodamus from "../apps/backend/src/prodamus";
import { sdk } from "../apps/backend/src/_core/sdk";
import { EMAIL_REGISTER_CONSENT_VERSION } from "../packages/shared/src/consent-texts";

type FlowResult = {
  cancellationStatus?: "none" | "pending" | "confirmed";
  state?: string;
  orderId?: string;
  url?: string;
  expiresAt?: Date;
  hasClubAccess?: boolean;
};

// Catches a missing transition across registration/mail/login/order/settlement
// and cancellation on ONE identity. Only provider cancellation is a double;
// JWT/cookies, SQL, webhook HMAC, password hashing and SMTP are native.
/** Проверяет связный жизненный цикл одного аккаунта от регистрации до оплаты, блокировки, восстановления пароля и подтверждённой отмены. */
describe.skipIf(!testDatabaseUrl)(
  "registration to subscription on isolated SQL/SMTP",
  () => {
    let conn: Connection, app: INestApplication, base: string;
    let smtp: Awaited<ReturnType<typeof openLoopbackSmtp>>;
    let userId: number | undefined;
    const email = "registration-subscription-flow@example.test";
    const password = "local-fixture-password-123";
    const secret = "local-fixture-merchant-signing-key";
    const moderatorId = 96122;
    const clubPostId = 96122;
    const clubBody = "OWNED_CLUB_BODY_PAID_BLOCK_CHECK";
    const nativeFetch = globalThis.fetch;
    let confirmCancellation = false;

    /** Читает контрольные строки текущего пользователя и его платёжной истории. */
    async function rows(sql: string, values: unknown[] = []) {
      return (await conn.query<RowDataPacket[]>(sql, values))[0];
    }
    /** Отправляет настоящий JSON POST в локальный API без внешних адресов. */
    const post = (path: string, body: unknown) =>
      fetch(`${base}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    /** Отправляет tRPC через HTTP с cookie и superjson и сохраняет безопасное wire-представление для проверки утечки закрытого текста. */
    async function trpc(
      path: string,
      input: unknown,
      cookie = "",
      query = false,
      extraHeaders: Record<string, string> = {},
    ) {
      const encoded = superjson.stringify(input);
      const response = await fetch(
        `${base}/api/trpc/${path}${query ? `?input=${encodeURIComponent(encoded)}` : ""}`,
        {
          method: query ? "GET" : "POST",
          headers: {
            "Content-Type": "application/json",
            ...(cookie ? { Cookie: cookie } : {}),
            ...extraHeaders,
          },
          ...(query ? {} : { body: encoded }),
        },
      );
      const body = await response.json();
      return {
        status: response.status,
        wire: JSON.stringify(body),
        data: body.result
          ? superjson.deserialize<FlowResult>(body.result.data)
          : null,
      };
    }
    /** Обрабатывает durable-outbox до отсутствия pending-писем через настоящий локальный SMTP. */
    async function drainMail() {
      await vi.waitFor(
        async () => {
          await processAccessEmails(
            (await getDb())!,
            sendTransactionalEmail,
            userId,
          );
          const pending = await rows(
            "SELECT id FROM access_email_outbox WHERE userId=? AND sentAt IS NULL AND discardedAt IS NULL",
            [userId],
          );
          expect(pending).toHaveLength(0);
        },
        { timeout: 3000, interval: 20 },
      );
    }
    /** Декодирует обе MIME-части письма и проверяет кликабельный href с точным одноразовым fragment доказательства. */
    function setupToken(index = 0) {
      const part = smtp.messages[index]
        .split(/\r\n--[^\r\n]+(?:\r\n|$)/)
        .find((value) => /^Content-Type: text\/plain;/im.test(value));
      expect(part).toBeDefined();
      const [headers, ...body] = part!.split("\r\n\r\n");
      const wire = body.join("\r\n\r\n");
      const text = /Content-Transfer-Encoding: base64/i.test(headers)
        ? Buffer.from(wire, "base64").toString("utf8")
        : wire
            .replace(/=\r\n/g, "")
            .replace(/=([0-9A-F]{2})/gi, (_, byte) =>
              String.fromCharCode(parseInt(byte, 16)),
            );
      const link = text.match(/http:\/\/[^\s<]+/)?.[0];
      expect(link).toBeDefined();
      const url = new URL(link!);
      expect(url.origin).toBe(base);
      // Email clients must not have to auto-detect a URL in ordinary HTML text.
      // The clickable destination must retain the exact one-time fragment.
      const htmlPart = smtp.messages[index]
        .split(/\r\n--[^\r\n]+(?:\r\n|$)/)
        .find((value) => /^Content-Type: text\/html;/im.test(value));
      expect(htmlPart).toBeDefined();
      const [htmlHeaders, ...htmlBody] = htmlPart!.split("\r\n\r\n");
      const htmlWire = htmlBody.join("\r\n\r\n");
      const html = /Content-Transfer-Encoding: base64/i.test(htmlHeaders)
        ? Buffer.from(htmlWire, "base64").toString("utf8")
        : htmlWire
            .replace(/=\r\n/g, "")
            .replace(/=([0-9A-F]{2})/gi, (_, byte) =>
              String.fromCharCode(parseInt(byte, 16)),
            );
      expect(html.match(/<a\b[^>]*href="([^"]+)"/i)?.[1]).toBe(link);
      return url.hash.slice("#token=".length);
    }
    /** Подписывает синтетический success-webhook независимо от production signing-helper и отправляет его локальному API. */
    async function notify(
      orderId: string,
      paymentId: string,
      signingKey = secret,
    ) {
      const body = {
        currency: "rub",
        customer_email: email,
        domain: "fixture.payform.ru",
        order_id: paymentId,
        order_num: orderId,
        payment_status: "success",
        subscription: { id: "123", profile_id: "456" },
        sum: "790.00",
      };
      // Literal field ordering matches the independently specified provider wire.
      return fetch(`${base}/api/prodamus/webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Sign: createHmac("sha256", signingKey)
            .update(JSON.stringify(body))
            .digest("hex"),
        },
        body: JSON.stringify(body),
      });
    }
    /** Создаёт синтетические роли, закрытый пост и локальный SMTP, запрещая любой non-loopback fetch и подменяя только provider-отмену. */
    beforeAll(async () => {
      conn = await openContentTestDatabase();
      await conn.query(
        "INSERT INTO users (id,openId,role) VALUES (?,'paid-block-fixture-moderator','moderator')",
        [moderatorId],
      );
      await conn.query(
        "INSERT INTO posts (id,text,photos,tags,target,status,published) VALUES (?,?,JSON_ARRAY(),JSON_ARRAY(),'club','published',TRUE)",
        [clubPostId, clubBody],
      );
      await conn.query(
        "CREATE TABLE IF NOT EXISTS user_consent_events (id INT AUTO_INCREMENT PRIMARY KEY,userId INT NOT NULL,consentKey VARCHAR(64) NOT NULL,status ENUM('granted','revoked') NOT NULL,consentVersion VARCHAR(32) NOT NULL,consentText TEXT,createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB",
      );
      smtp = await openLoopbackSmtp();
      for (const [key, value] of Object.entries({
        DATABASE_URL: testDatabaseUrl!,
        JWT_SECRET: "local-flow-session-key-at-least-32-characters",
        AUTH_LINK_ENCRYPTION_KEY: Buffer.alloc(32, 14).toString("base64"),
        SMTP_HOST: "127.0.0.1",
        SMTP_PORT: String(smtp.port),
        SMTP_SECURE: "false",
        SMTP_USER: "sender@example.test",
        SMTP_PASS: "fixture-only",
        SMTP_FROM: "sender@example.test",
        PRODAMUS_SECRET: secret,
        PRODAMUS_PAYFORM_URL: "https://fixture.payform.ru",
        PRODAMUS_SUBSCRIPTION_ID: "123",
        PRODAMUS_TEST_ENABLED: "false",
        YOOKASSA_TEST_ENABLED: "false",
        NORMAL_CHECKOUT_RECOVERY_ENABLED: "true",
      }))
        vi.stubEnv(key, value);
      // Deny every non-loopback HTTP operation, even if a new path tries one.
      vi.stubGlobal("fetch", ((url, options) => {
        const target = new URL(url instanceof Request ? url.url : String(url));
        if (target.protocol !== "http:" || target.hostname !== "127.0.0.1")
          throw new Error("Non-loopback HTTP forbidden in this fixture");
        return nativeFetch(url, options);
      }) as typeof fetch);
      vi.spyOn(prodamus, "cancelProdamusSubscription").mockImplementation(
        async (profile) => {
          if (
            profile.domain !== "fixture.payform.ru" ||
            profile.subscriptionId !== "123" ||
            profile.profileId !== "456"
          )
            throw new Error("Unexpected synthetic cancellation profile");
          return confirmCancellation;
        },
      );
      app = await createBackendApplication(); // No scheduled workers or env files.
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
      vi.stubEnv("PUBLIC_APP_URL", base);
    });
    /** Закрывает API и SMTP, удаляет только собственную цепочку аккаунта, аудита, платежей и закрытого поста и восстанавливает подмены. */
    afterAll(async () => {
      await app?.close();
      await smtp?.close();
      if (conn && userId) {
        await conn.query(
          "DELETE FROM admin_audit_log WHERE actorUserId=? AND targetId=?",
          [moderatorId, userId],
        );
        for (const [table, owner] of [
          ["normal_checkout_requests", "actorUserId"],
          ["billing_receipts", "userId"],
          ["billing_profiles", "userId"],
          ["password_tokens", "userId"],
          ["access_email_outbox", "userId"],
          ["club_payments", "userId"],
          ["user_consent_events", "userId"],
        ])
          await conn.query(`DELETE FROM ${table} WHERE ${owner}=?`, [userId]);
        await conn.query("DELETE FROM users WHERE id=? AND email=?", [
          userId,
          email,
        ]);
      }
      if (conn) {
        await conn.query("DELETE FROM posts WHERE id=? AND text=?", [
          clubPostId,
          clubBody,
        ]);
        await conn.query(
          "DELETE FROM users WHERE id=? AND openId='paid-block-fixture-moderator'",
          [moderatorId],
        );
      }
      await conn?.end();
      await (
        (await getDb()) as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    });
    /** Проходит регистрацию и setup, оплату и продление, блокировку с отзывом сессии, восстановление пароля и отмену без потери оплаченной истории. */
    it("revokes blocked paid sessions without losing entitlement across unblock, recovery and cancellation", async () => {
      const register = {
        email,
        name: "Synthetic member",
        consentVersion: EMAIL_REGISTER_CONSENT_VERSION,
      };
      const accepted = await post("/api/auth/register", register);
      expect(accepted.status).toBe(202);
      expect(accepted.headers.get("set-cookie")).toBeNull();
      const acceptedBody = await accepted.json();
      expect(acceptedBody).toMatchObject({
        ok: true,
        message: expect.stringContaining("Запрос принят"),
      });
      expect(acceptedBody).not.toHaveProperty("sent");
      expect(acceptedBody).not.toHaveProperty("sessionToken");
      const accounts = await rows(
        "SELECT id,passwordHash FROM users WHERE email=?",
        [email],
      );
      expect(accounts).toHaveLength(1);
      userId = accounts[0].id;
      expect(accounts[0].passwordHash).toBeNull();
      expect((await post("/api/auth/login", { email, password })).status).toBe(
        401,
      );
      // The native SMTP server rejects RCPT; acceptance of registration is not
      // delivery. Retry must keep the same account, setup token and durable mail.
      const pendingIdentity = await rows(
        "SELECT id,name,passwordHash,role,sessionVersion FROM users WHERE id=?",
        [userId],
      );
      const pendingTokens = await rows(
        "SELECT id,tokenHash,consumedAt FROM password_tokens WHERE userId=? ORDER BY id",
        [userId],
      );
      smtp.rejectRecipients(true);
      const failedAt = Date.now();
      await processAccessEmails(
        (await getDb())!,
        sendTransactionalEmail,
        userId,
      );
      expect(smtp.messages).toHaveLength(0);
      const failedMail = await rows(
        "SELECT id,sentAt,discardedAt,lastError,attempts,nextAttemptAt FROM access_email_outbox WHERE userId=? ORDER BY id",
        [userId],
      );
      expect(failedMail).toHaveLength(1);
      expect(failedMail[0]).toMatchObject({
        sentAt: null,
        discardedAt: null,
        lastError: "delivery_failed",
        attempts: 1,
      });
      expect(failedMail[0].nextAttemptAt.getTime()).toBeGreaterThan(failedAt);
      for (const retry of await Promise.all(
        Array.from({ length: 3 }, () =>
          post("/api/auth/register", {
            ...register,
            name: "Must not overwrite pending identity",
          }),
        ),
      )) {
        expect(retry.status).toBe(202);
        expect(retry.headers.get("set-cookie")).toBeNull();
        expect(await retry.json()).toEqual(acceptedBody);
      }
      expect(
        await rows(
          "SELECT id,name,passwordHash,role,sessionVersion FROM users WHERE email=?",
          [email],
        ),
      ).toEqual(pendingIdentity);
      expect(
        await rows(
          "SELECT id,tokenHash,consumedAt FROM password_tokens WHERE userId=? ORDER BY id",
          [userId],
        ),
      ).toEqual(pendingTokens);
      expect(
        await rows(
          "SELECT id,sentAt,discardedAt,lastError,attempts,nextAttemptAt FROM access_email_outbox WHERE userId=? ORDER BY id",
          [userId],
        ),
      ).toEqual(failedMail);
      expect((await post("/api/auth/login", { email, password })).status).toBe(
        401,
      );
      smtp.rejectRecipients(false);
      // Advance ONLY this fixture's retry deadline, leaving production backoff intact.
      await conn.query(
        "UPDATE access_email_outbox SET nextAttemptAt=NOW() WHERE userId=?",
        [userId],
      );
      await drainMail();
      expect(
        await rows(
          "SELECT id,sentAt,discardedAt,attempts FROM access_email_outbox WHERE userId=?",
          [userId],
        ),
      ).toEqual([
        {
          id: failedMail[0].id,
          sentAt: expect.any(Date),
          discardedAt: null,
          attempts: 2,
        },
      ]);
      expect(smtp.messages).toHaveLength(1);
      expect(smtp.recipients).toEqual([`RCPT TO:<${email}>`]);
      const token = setupToken();
      const complete = await post("/api/auth/password/complete", {
        token,
        password,
      });
      expect(complete.status).toBe(200);
      expect(complete.headers.get("set-cookie")).toBeNull();
      expect(
        (await post("/api/auth/password/complete", { token, password })).status,
      ).toBe(400);
      const login = await post("/api/auth/login", { email, password });
      expect(login.status).toBe(200);
      const cookieHeader = login.headers.get("set-cookie")!;
      expect(cookieHeader).toMatch(/HttpOnly/i);
      let cookie = cookieHeader.split(";")[0];
      // После доказанной установки пароля фиксируем идентичность: покупки не должны менять пароль, роль и эпоху сессии.
      const initialIdentity = await rows(
        "SELECT id,passwordHash,sessionVersion,role FROM users WHERE id=?",
        [userId],
      );
      expect(
        (await trpc("club.subscription", undefined, cookie, true)).data,
      ).toMatchObject({ hasClubAccess: false, subscribed: false });
      const intent = { plan: "monthly", idempotencyKey: randomUUID(), contactPhone: "+79990000001" };
      const order = await trpc("club.createNormalCheckout", intent, cookie);
      expect(order.status).toBe(200);
      expect(order.data?.state).toBe("pending");
      // A retry reuses the intent key; the harness retains the first reply as evidence.
      const replay = await trpc("club.createNormalCheckout", intent, cookie);
      expect(replay.data).toEqual(order.data);
      expect(new URL(order.data!.url!).hostname).toBe("fixture.payform.ru"); // Never opened.
      expect(
        await rows("SELECT status,contactPhone FROM club_payments WHERE userId=?", [userId]),
      ).toEqual([{ status: "pending", contactPhone: "+79990000001" }]);
      expect(await rows("SELECT contactPhone FROM users WHERE id=?", [userId])).toEqual([{contactPhone: "+79990000001"}]);
      expect(
        (await trpc("club.subscription", undefined, cookie, true)).data
          ?.hasClubAccess,
      ).toBe(false);
      expect(
        (await notify(order.data!.orderId!, "100001", "wrong-fixture-key"))
          .status,
      ).not.toBe(200);
      expect(
        (await trpc("club.subscription", undefined, cookie, true)).data
          ?.hasClubAccess,
      ).toBe(false);
      const paid = await notify(order.data!.orderId!, "100001");
      expect(paid.status).toBe(200);
      expect(await paid.text()).toBe("success");
      const firstExpiry = (
        await trpc("club.subscription", undefined, cookie, true)
      ).data!;
      expect(firstExpiry).toMatchObject({
        hasClubAccess: true,
        subscribed: true,
        cancelAtPeriodEnd: false,
      });
      const repeated = await notify(order.data!.orderId!, "100001");
      expect(await repeated.text()).toBe("success");
      expect(
        (await trpc("club.subscription", undefined, cookie, true)).data,
      ).toEqual(firstExpiry);
      await drainMail();
      expect(smtp.messages).toHaveLength(2);
      const renewal = await trpc(
        "club.createNormalCheckout",
        { ...intent, idempotencyKey: randomUUID() },
        cookie,
      );
      expect(renewal.status).toBe(200);
      expect(
        await (await notify(renewal.data!.orderId!, "100002")).text(),
      ).toBe("success");
      const renewed = (await trpc("club.subscription", undefined, cookie, true))
        .data!;
      expect(
        renewed.expiresAt!.getTime() - firstExpiry.expiresAt!.getTime(),
      ).toBe(30 * 86400000);
      expect(
        await rows(
          "SELECT id,passwordHash,sessionVersion,role FROM users WHERE id=?",
          [userId],
        ),
      ).toEqual(initialIdentity);
      expect(
        (
          await trpc(
            "club.normalCheckoutStatus",
            { idempotencyKey: intent.idempotencyKey },
            cookie,
            true,
          )
        ).data,
      ).toMatchObject({ state: "succeeded", orderId: order.data!.orderId });

      // Отдельно фиксируем оплаченную историю перед блокировкой: отзыв сессии закрывает чтение, но не стирает платежи.
      const paidBeforeBlock = await rows(
        "SELECT orderId,status,expiresAt,cancelAtPeriodEnd FROM club_payments WHERE userId=? ORDER BY id",
        [userId],
      );
      expect((await trpc("club.list", undefined, cookie, true)).wire).toContain(
        clubBody,
      );
      expect(
        (await trpc("feed.getById", { id: clubPostId }, cookie, true)).wire,
      ).toContain(clubBody);
      const cookieName = cookie.split("=")[0];
      const moderatorCookie = `${cookieName}=${await sdk.createSessionToken("paid-block-fixture-moderator", { sessionVersion: 0 })}`;
      const blockInput = { userId, reason: "Synthetic paid access check" };
      expect(
        (await trpc("moderation.blockUser", blockInput, cookie)).status,
      ).toBe(403);
      expect(
        (await trpc("moderation.blockUser", blockInput, moderatorCookie))
          .status,
      ).toBe(200);
      expect(
        (
          await rows("SELECT blockedAt,sessionVersion FROM users WHERE id=?", [
            userId,
          ])
        )[0],
      ).toMatchObject({
        blockedAt: expect.any(Date),
        sessionVersion: initialIdentity[0].sessionVersion + 1,
      });
      for (const path of [
        "club.list",
        "feed.savedPosts",
        "feed.userInteractions",
      ])
        expect((await trpc(path, undefined, cookie, true)).status).toBe(401);
      const oldBearer = cookie.slice(cookie.indexOf("=") + 1);
      expect(
        (
          await trpc("club.list", undefined, "", true, {
            Authorization: `Bearer ${oldBearer}`,
          })
        ).status,
      ).toBe(401);
      expect(
        (
          await trpc(
            "club.normalCheckoutStatus",
            { idempotencyKey: intent.idempotencyKey },
            cookie,
            true,
          )
        ).status,
      ).toBe(401);
      expect(
        (
          await trpc(
            "club.createNormalCheckout",
            { ...intent, idempotencyKey: randomUUID() },
            cookie,
          )
        ).status,
      ).toBe(401);
      const hiddenPost = await trpc(
        "feed.getById",
        { id: clubPostId },
        cookie,
        true,
      );
      expect(hiddenPost.status).toBe(200);
      expect(hiddenPost.data).toBeUndefined();
      expect(hiddenPost.wire).not.toContain(clubBody);
      expect(
        (await trpc("club.subscription", undefined, cookie, true)).data,
      ).toMatchObject({ hasClubAccess: false, subscribed: false });
      const me = await fetch(`${base}/api/auth/me`, {
        headers: { Cookie: cookie },
      });
      expect(await me.json()).toEqual({ user: null });
      expect((await post("/api/auth/login", { email, password })).status).toBe(
        401,
      );
      const beforeRefusedReplay = await rows(
        "SELECT orderId FROM billing_receipts WHERE userId=? ORDER BY orderId",
        [userId],
      );
      expect((await notify(order.data!.orderId!, "100001")).status).toBe(422);
      expect(
        await rows(
          "SELECT orderId FROM billing_receipts WHERE userId=? ORDER BY orderId",
          [userId],
        ),
      ).toEqual(beforeRefusedReplay);
      expect(
        await rows(
          "SELECT orderId,status,expiresAt,cancelAtPeriodEnd FROM club_payments WHERE userId=? ORDER BY id",
          [userId],
        ),
      ).toEqual(paidBeforeBlock);
      expect(
        (
          await rows(
            "SELECT cancelRequestedAt,cancelledAt FROM billing_profiles WHERE userId=?",
            [userId],
          )
        )[0],
      ).toMatchObject({
        cancelRequestedAt: expect.any(Date),
        cancelledAt: null,
      });
      expect(
        await rows(
          "SELECT action FROM admin_audit_log WHERE actorUserId=? AND targetId=?",
          [moderatorId, userId],
        ),
      ).toEqual([{ action: "block_user" }]);
      expect(
        (await trpc("moderation.unblockUser", { userId }, moderatorCookie))
          .status,
      ).toBe(200);
      // Removing the block must not resurrect the old revoked cookie.
      expect((await trpc("club.list", undefined, cookie, true)).status).toBe(
        401,
      );
      const unblockedLogin = await post("/api/auth/login", { email, password });
      expect(unblockedLogin.status).toBe(200);
      cookie = unblockedLogin.headers.get("set-cookie")!.split(";")[0];
      expect((await trpc("club.list", undefined, cookie, true)).wire).toContain(
        clubBody,
      );
      expect(
        (await trpc("club.subscription", undefined, cookie, true)).data,
      ).toEqual({ ...renewed, cancellationStatus: "pending" });
      expect(
        await rows(
          "SELECT orderId,status,expiresAt,cancelAtPeriodEnd FROM club_payments WHERE userId=? ORDER BY id",
          [userId],
        ),
      ).toEqual(paidBeforeBlock);

      // Reset must revoke old sessions without revoking an already paid period.
      const paidRows = await rows(
        "SELECT orderId,status,expiresAt,cancelAtPeriodEnd FROM club_payments WHERE userId=? ORDER BY id",
        [userId],
      );
      // Восстановление пароля начинается без отзыва действующей сессии; отзыв наступает только после доказанного завершения.
      const recovery = await post("/api/auth/password/request", { email });
      expect(recovery.status).toBe(202);
      expect((await post("/api/auth/login", { email, password })).status).toBe(
        200,
      );
      expect(
        (await trpc("club.subscription", undefined, cookie, true)).data,
      ).toEqual({ ...renewed, cancellationStatus: "pending" });
      await drainMail();
      expect(smtp.messages).toHaveLength(4); // setup + two purchases + reset.
      const resetToken = setupToken(smtp.messages.length - 1);
      const newPassword = "local-recovered-password-456";
      const changed = await post("/api/auth/password/complete", {
        token: resetToken,
        password: newPassword,
      });
      expect(changed.status).toBe(200);
      expect(changed.headers.get("set-cookie")).toBeNull();
      expect(
        (await trpc("club.subscription", undefined, cookie, true)).data
          ?.hasClubAccess,
      ).toBe(false);
      expect(
        (
          await trpc(
            "club.normalCheckoutStatus",
            { idempotencyKey: intent.idempotencyKey },
            cookie,
            true,
          )
        ).status,
      ).toBe(401);
      expect((await post("/api/auth/login", { email, password })).status).toBe(
        401,
      );
      expect(
        (
          await post("/api/auth/password/complete", {
            token: resetToken,
            password,
          })
        ).status,
      ).toBe(400);
      const relogin = await post("/api/auth/login", {
        email,
        password: newPassword,
      });
      expect(relogin.status).toBe(200);
      cookie = relogin.headers.get("set-cookie")!.split(";")[0];
      expect(
        (await trpc("club.subscription", undefined, cookie, true)).data,
      ).toEqual({ ...renewed, cancellationStatus: "pending" });
      expect(
        await rows(
          "SELECT orderId,status,expiresAt,cancelAtPeriodEnd FROM club_payments WHERE userId=? ORDER BY id",
          [userId],
        ),
      ).toEqual(paidRows);
      expect(
        (await rows("SELECT sessionVersion FROM users WHERE id=?", [userId]))[0]
          .sessionVersion,
      ).toBe(initialIdentity[0].sessionVersion + 2); // block + password reset.
      expect((await trpc("club.cancel", undefined, "")).status).toBe(401);
      // Принятое намерение отмены остаётся pending до подтверждения провайдера и сохраняет доступ до оплаченного срока.
      const requestedCancellation = await trpc(
        "club.cancel",
        undefined,
        cookie,
      );
      expect(requestedCancellation.status).toBe(200);
      expect(requestedCancellation.data).toMatchObject({
        cancellationStatus: "pending",
        expiresAt: renewed.expiresAt,
      });
      expect(
        (await trpc("club.subscription", undefined, cookie, true)).data,
      ).toEqual({ ...renewed, cancellationStatus: "pending" });
      expect(
        (
          await rows(
            "SELECT cancelRequestedAt,cancelledAt FROM billing_profiles WHERE userId=?",
            [userId],
          )
        )[0],
      ).toMatchObject({
        cancelRequestedAt: expect.any(Date),
        cancelledAt: null,
      });
      // Advance only the owned fixture retry schedule; no production backoff changes.
      await conn.query(
        "UPDATE billing_profiles SET nextAttemptAt=NOW() WHERE userId=?",
        [userId],
      );
      confirmCancellation = true;
      expect((await trpc("club.cancel", undefined, cookie)).status).toBe(200);
      expect(
        (await trpc("club.subscription", undefined, cookie, true)).data,
      ).toMatchObject({
        hasClubAccess: true,
        subscribed: true,
        cancelAtPeriodEnd: true,
        cancellationStatus: "confirmed",
        expiresAt: renewed.expiresAt,
      });
      await drainMail();
      expect(smtp.messages).toHaveLength(4);
      // Simulate expiry in the synthetic database, not by altering subscription policy.
      await conn.query(
        "UPDATE club_payments SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE userId=?",
        [userId],
      );
      expect(
        (await trpc("club.subscription", undefined, cookie, true)).data,
      ).toMatchObject({ hasClubAccess: false, subscribed: false });
      expect(
        await rows("SELECT orderId FROM billing_receipts WHERE userId=?", [
          userId,
        ]),
      ).toHaveLength(2);
      expect(
        await rows("SELECT id FROM users WHERE email=?", [email]),
      ).toHaveLength(1);
    }, 20000);
  },
);
