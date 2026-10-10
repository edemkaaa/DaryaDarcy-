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
import {
  chromium,
  expect as browserExpect,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { createDecipheriv } from "node:crypto";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { maintainMemberEmailBindings } from "../apps/backend/src/identity/email-binding-lifecycle";
import { sdk } from "../apps/backend/src/_core/sdk";
import { getDb } from "../apps/backend/src/db";
import { COOKIE_NAME } from "../packages/shared/src/const";
import { openContentTestDatabase } from "./helpers/content-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { openLoopbackSmtp } from "./helpers/loopback-smtp";
import { processMemberEmailBindingEmails } from "../apps/backend/src/identity/email-binding-delivery";
import { sendTransactionalEmail } from "../apps/backend/src/_core/email";
import { registerAdminMembershipBrowserCases } from "./helpers/admin-membership-browser-cases";

// Opt in with a separately started, enabled production frontend build. API
// forwarding below is a transport proxy, never a mock response or fake session.
const frontend = process.env.BINDING_BROWSER_FRONTEND_URL;
describe.skipIf(!testDatabaseUrl || !frontend)(
  "member email form with native API and disposable SQL",
  () => {
    let connection: Connection, application: INestApplication, browser: Browser;
    let base: string, token: string, context: BrowserContext;
    let smtp: Awaited<ReturnType<typeof openLoopbackSmtp>>;
    const actorId = 91401,
      memberId = 91402;
    async function rows(sql: string, args: unknown[] = []) {
      return (await connection.query<RowDataPacket[]>(sql, args))[0];
    }
    async function cleanup() {
      await connection.query("DELETE FROM access_email_outbox WHERE userId=?", [
        memberId,
      ]);
      await connection.query("DELETE FROM password_tokens WHERE userId=?", [
        memberId,
      ]);
      await connection.query("DELETE FROM club_payments WHERE userId=?", [
        memberId,
      ]);
      await connection.query(
        "DELETE o FROM member_email_binding_outbox o JOIN member_email_bindings b USING(requestKey) WHERE b.actorUserId=?",
        [actorId],
      );
      await connection.query(
        "DELETE FROM member_email_bindings WHERE actorUserId=?",
        [actorId],
      );
      await connection.query(
        "DELETE FROM admin_audit_log WHERE actorUserId=?",
        [actorId],
      );
      await connection.query(
        "DELETE FROM users WHERE id IN (?,?) AND openId LIKE 'binding-browser-%'",
        [actorId, memberId],
      );
    }
    beforeAll(async () => {
      const url = new URL(frontend!);
      if (
        url.protocol !== "http:" ||
        !["127.0.0.1", "localhost"].includes(url.hostname) ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash
      ) {
        throw new Error("Browser fixture requires a loopback frontend origin");
      }
      connection = await openContentTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "synthetic-binding-browser-session-secret-32");
      vi.stubEnv("PUBLIC_APP_URL", url.origin);
      vi.stubEnv("PUBLIC_AUTH_URL", "");
      smtp = await openLoopbackSmtp();
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("SMTP_HOST", "127.0.0.1");
      vi.stubEnv("SMTP_PORT", String(smtp.port));
      vi.stubEnv("SMTP_SECURE", "false");
      vi.stubEnv("SMTP_USER", "sender@example.test");
      vi.stubEnv("SMTP_PASS", "fixture-only-browser-smtp-password");
      vi.stubEnv("SMTP_FROM", "sender@example.test");
      vi.stubEnv("MEMBER_EMAIL_BINDING_ENABLED", "true");
      vi.stubEnv(
        "AUTH_LINK_ENCRYPTION_KEY",
        Buffer.alloc(32, 41).toString("base64"),
      );
      application = await createBackendApplication();
      await application.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(application.getHttpServer().address() as AddressInfo).port}`;
      token = await sdk.createSessionToken("binding-browser-admin", {
        sessionVersion: 0,
      });
      browser = await chromium.launch({
        executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
      });
    }, 30_000);
    beforeEach(async () => {
      await cleanup();
      smtp.reset();
      await connection.query(
        `INSERT INTO users (id,openId,name,role,phone,passwordHash) VALUES
      (?,'binding-browser-admin','Browser administrator','admin',NULL,'SYNTHETIC_ADMIN_HASH'),
      (?,'binding-browser-member','Browser phone member','user','+70000091402','SYNTHETIC_MEMBER_HASH')`,
        [actorId, memberId],
      );
      context = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
      context.setDefaultTimeout(5_000);
      await context.addInitScript(() => {
        localStorage.setItem("@darcy_install_guide_seen", "1");
      });
      await context.addCookies([
        {
          name: COOKIE_NAME,
          value: token,
          url: frontend!,
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      // Neither production workers nor external mail/payment providers are started.
      await context.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== new URL(frontend!).origin)
          return route.abort("blockedbyclient");
        if (!url.pathname.startsWith("/api/")) return route.continue();
        const response = await route.fetch({
          url: base + url.pathname + url.search,
          maxRedirects: 0,
        });
        return route.fulfill({ response });
      });
    });
    afterEach(async () => {
      if (context) {
        for (const page of context.pages())
          await page.unrouteAll({ behavior: "wait" });
        await context.unrouteAll({ behavior: "wait" });
      }
      await context?.close();
    });
    afterAll(async () => {
      await browser?.close();
      await application?.close();
      await smtp?.close();
      if (connection) {
        await cleanup();
        await connection.end();
        await (
          (await getDb()) as unknown as { $client: { end(): Promise<void> } }
        )?.$client.end();
      }
      vi.unstubAllEnvs();
    });
    async function open(page: Page) {
      await page.goto(frontend! + "admin");
      await browserExpect(
        page.getByRole("button", { name: "Участницы", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Участницы", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Привязать почту", exact: true })
        .click();
      return page.getByRole("form", { name: "Первая привязка почты" });
    }
    async function send(page: Page) {
      const form = await open(page);
      await form
        .getByLabel("Почта участницы")
        .fill("browser.member@example.test");
      await form
        .getByRole("button", { name: "Отправить подтверждение", exact: true })
        .click();
      await browserExpect(
        form.getByRole("button", { name: "Проверить заявку", exact: true }),
      ).toBeEnabled();
      return form;
    }
    registerAdminMembershipBrowserCases(() => ({
      rows,
      connection,
      context,
      actorId,
      memberId,
      base,
      frontend: frontend!,
      smtp,
    }));
    async function proof(requestKey: string) {
      const [binding] = await rows(
        "SELECT b.payloadHash,o.tokenCipher FROM member_email_bindings b JOIN member_email_binding_outbox o USING(requestKey) WHERE b.requestKey=?",
        [requestKey],
      );
      const encrypted = Buffer.from(binding.tokenCipher, "base64");
      const decipher = createDecipheriv(
        "aes-256-gcm",
        Buffer.alloc(32, 41),
        encrypted.subarray(0, 12),
      );
      decipher.setAAD(
        Buffer.from(`email-binding:v1:${requestKey}:${binding.payloadHash}`),
      );
      decipher.setAuthTag(encrypted.subarray(-16));
      return Buffer.concat([
        decipher.update(encrypted.subarray(12, -16)),
        decipher.final(),
      ]).toString("utf8");
    }
    async function deliveredLink() {
      const database = await getDb();
      if (!database) throw new Error("Disposable database unavailable");
      await processMemberEmailBindingEmails(database, sendTransactionalEmail);
      expect(smtp.recipients).toEqual([
        "RCPT TO:<browser.member@example.test>",
      ]);
      expect(smtp.messages).toHaveLength(1);
      const decoded = smtp.messages[0]
        .split(/\r\n--/)
        .map((part) => {
          const separator = part.indexOf("\r\n\r\n");
          const header = part.slice(0, separator);
          const body = part.slice(separator + 4);
          return /Content-Transfer-Encoding: base64/i.test(header)
            ? Buffer.from(body.replace(/\r\n/g, ""), "base64").toString("utf8")
            : body
                .replace(/=\r\n/g, "")
                .replace(/=([0-9A-F]{2})/g, (_, hex) =>
                  String.fromCharCode(parseInt(hex, 16)),
                );
        })
        .join("\n");
      const match = decoded.match(
        /http:\/\/127\.0\.0\.1:\d+\/api\/auth\/email-binding#token=[A-Za-z0-9_-]{43}/,
      );
      expect(match).not.toBeNull();
      const link = new URL(match![0]);
      expect(link.origin).toBe(new URL(frontend!).origin);
      return link;
    }
    it("opens the delivered GET without changing SQL or leaking proof, while retaining the cross-site policy gate", async () => {
      await send(await context.newPage());
      const link = await deliveredLink();
      const before = await rows("SELECT * FROM users WHERE id=?", [memberId]);
      const recipient = await context.newPage();
      recipient.on("request", (request) => {
        expect(request.url()).not.toContain("token=");
      });
      const response = await recipient.goto(link.toString());
      expect(response?.status()).toBe(200);
      // A webmail document navigation hits a separate existing policy gate.
      const webmailEntry = await fetch(base + link.pathname, {
        headers: {
          "Sec-Fetch-Site": "cross-site",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Dest": "document",
        },
      });
      expect(webmailEntry.status).toBe(403);
      await browserExpect(
        recipient.getByRole("button", {
          name: "Подтвердить почту",
          exact: true,
        }),
      ).toBeEnabled();
      expect(new URL(recipient.url()).pathname).toBe("/email-binding");
      expect(new URL(recipient.url()).hash).toBe("");
      expect(await rows("SELECT * FROM users WHERE id=?", [memberId])).toEqual(
        before,
      );
      expect(
        await rows(
          "SELECT state FROM member_email_bindings WHERE actorUserId=?",
          [actorId],
        ),
      ).toEqual([{ state: "pending" }]);
    }, 30_000);
    it("confirms the actual SMTP-delivered link through the read-only redirect and explicit native POST", async () => {
      await connection.query(
        "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'binding-browser-existing-access','paid','0','2030-01-01')",
        [memberId],
      );
      const access = await rows("SELECT * FROM club_payments WHERE userId=?", [
        memberId,
      ]);
      await send(await context.newPage());
      const beforeCookies = await context.cookies();
      const before = await rows("SELECT * FROM users WHERE id=?", [memberId]);
      const link = await deliveredLink();
      expect(await rows("SELECT * FROM users WHERE id=?", [memberId])).toEqual(
        before,
      );
      expect(
        await rows(
          "SELECT o.sentAt,o.tokenCipher,o.attempts FROM member_email_binding_outbox o JOIN member_email_bindings b USING(requestKey) WHERE b.actorUserId=?",
          [actorId],
        ),
      ).toEqual([{ sentAt: expect.any(Date), tokenCipher: null, attempts: 1 }]);
      const recipient = await context.newPage();
      await recipient.goto(link.toString());
      const submit = recipient.getByRole("button", {
        name: "Подтвердить почту",
        exact: true,
      });
      await browserExpect(submit).toBeEnabled();
      expect(new URL(recipient.url()).hash).toBe("");
      expect(await rows("SELECT * FROM users WHERE id=?", [memberId])).toEqual(
        before,
      );
      await submit.click();
      await browserExpect(recipient.getByRole("status")).toContainText(
        "Почта подтверждена",
      );
      const after = await rows("SELECT * FROM users WHERE id=?", [memberId]);
      expect(after[0]).toMatchObject({
        ...before[0],
        email: "browser.member@example.test",
      });
      expect(await context.cookies()).toEqual(beforeCookies);
      expect(
        await rows("SELECT * FROM club_payments WHERE userId=?", [memberId]),
      ).toEqual(access);
      await processMemberEmailBindingEmails(
        (await getDb())!,
        sendTransactionalEmail,
      );
      expect(smtp.messages).toHaveLength(1);
    }, 30_000);
    it("commits one queued intent without changing the member identity and recovers it after reload", async () => {
      const page = await context.newPage();
      let form = await open(page);
      await form
        .getByLabel("Почта участницы")
        .fill(" Browser.Member@Example.Test ");
      await form
        .getByRole("button", { name: "Отправить подтверждение", exact: true })
        .click();
      await browserExpect(
        form.getByRole("button", { name: "Проверить заявку", exact: true }),
      ).toBeVisible();
      const [intent] = await rows(
        "SELECT requestKey,state,email FROM member_email_bindings WHERE actorUserId=?",
        [actorId],
      );
      expect(intent).toMatchObject({
        state: "pending",
        email: "browser.member@example.test",
      });
      expect(
        await rows(
          "SELECT sentAt,discardedAt,attempts FROM member_email_binding_outbox WHERE requestKey=?",
          [intent.requestKey],
        ),
      ).toEqual([{ sentAt: null, discardedAt: null, attempts: 0 }]);
      expect(
        await rows(
          "SELECT email,passwordHash,sessionVersion FROM users WHERE id=?",
          [memberId],
        ),
      ).toEqual([
        {
          email: null,
          passwordHash: "SYNTHETIC_MEMBER_HASH",
          sessionVersion: 0,
        },
      ]);
      await page.reload();
      form = await open(page);
      await form
        .getByRole("button", { name: "Восстановить заявку", exact: true })
        .click();
      await browserExpect(
        form.getByRole("button", { name: "Проверить заявку", exact: true }),
      ).toBeVisible();
      expect(
        await rows(
          "SELECT requestKey FROM member_email_bindings WHERE actorUserId=?",
          [actorId],
        ),
      ).toEqual([{ requestKey: intent.requestKey }]);
    }, 30_000);
    it("replays a committed request after a lost HTTP reply without another outbox or audit row", async () => {
      const page = await context.newPage();
      let loseReply = true;
      const keys: string[] = [];
      await page.route("**/api/admin/member-email-bindings", async (route) => {
        keys.push(route.request().postDataJSON().requestKey);
        const response = await route.fetch({
          url: base + "/api/admin/member-email-bindings",
          maxRedirects: 0,
        });
        expect(response.status()).toBe(202);
        if (loseReply) {
          loseReply = false;
          return route.abort("failed");
        }
        return route.fulfill({ response });
      });
      const form = await open(page);
      await form
        .getByLabel("Почта участницы")
        .fill("browser.member@example.test");
      await form
        .getByRole("button", { name: "Отправить подтверждение", exact: true })
        .click();
      await browserExpect(
        form.getByRole("button", { name: "Повторить эту заявку", exact: true }),
      ).toBeVisible();
      await form
        .getByRole("button", { name: "Повторить эту заявку", exact: true })
        .click();
      await browserExpect(
        form.getByRole("button", { name: "Повторить эту заявку", exact: true }),
      ).toHaveCount(0);
      expect(keys).toHaveLength(2);
      expect(keys[1]).toBe(keys[0]);
      expect(
        await rows(
          "SELECT requestKey FROM member_email_bindings WHERE actorUserId=?",
          [actorId],
        ),
      ).toEqual([{ requestKey: keys[0] }]);
      expect(
        await rows(
          "SELECT requestKey FROM member_email_binding_outbox WHERE requestKey=?",
          [keys[0]],
        ),
      ).toHaveLength(1);
      expect(
        await rows("SELECT id FROM admin_audit_log WHERE actorUserId=?", [
          actorId,
        ]),
      ).toHaveLength(1);
    }, 30_000);
    it("prepares a fresh draft only after native expiry and sends a new intent only on explicit submit", async () => {
      const page = await context.newPage();
      const form = await send(page);
      const [original] = await rows(
        "SELECT requestKey FROM member_email_bindings WHERE actorUserId=?",
        [actorId],
      );
      await connection.query(
        "UPDATE member_email_bindings SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE requestKey=?",
        [original.requestKey],
      );
      expect(await maintainMemberEmailBindings((await getDb())!)).toEqual({
        expired: 1,
        purged: 0,
      });
      await form
        .getByRole("button", { name: "Проверить заявку", exact: true })
        .click();
      await browserExpect(
        form.getByRole("button", {
          name: "Подготовить новую заявку",
          exact: true,
        }),
      ).toBeEnabled();
      await form
        .getByRole("button", { name: "Подготовить новую заявку", exact: true })
        .click();
      await browserExpect(
        form.getByRole("button", {
          name: "Отправить подтверждение",
          exact: true,
        }),
      ).toBeEnabled();
      await browserExpect(form.getByLabel("Почта участницы")).toHaveValue("");
      expect(
        await rows(
          "SELECT requestKey,state,email,proofHash FROM member_email_bindings WHERE actorUserId=?",
          [actorId],
        ),
      ).toEqual([
        {
          requestKey: original.requestKey,
          state: "expired",
          email: null,
          proofHash: null,
        },
      ]);
      await form
        .getByLabel("Почта участницы")
        .fill("fresh.browser@example.test");
      await form
        .getByRole("button", { name: "Отправить подтверждение", exact: true })
        .click();
      await browserExpect(
        form.getByRole("button", { name: "Проверить заявку", exact: true }),
      ).toBeEnabled();
      const [fresh] = await rows(
        "SELECT requestKey,email FROM member_email_bindings WHERE actorUserId=? AND state='pending'",
        [actorId],
      );
      expect(fresh.email).toBe("fresh.browser@example.test");
      expect(fresh.requestKey).not.toBe(original.requestKey);
      expect(
        await rows("SELECT email FROM users WHERE id=?", [memberId]),
      ).toEqual([{ email: null }]);
    }, 30_000);
    it("refreshes canonical member data after native proof confirmation while preserving existing access and credentials", async () => {
      await connection.query(
        "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'binding-browser-existing-access','paid','0','2030-01-01')",
        [memberId],
      );
      const before = await rows("SELECT * FROM club_payments WHERE userId=?", [
        memberId,
      ]);
      const page = await context.newPage();
      const form = await send(page);
      const [intent] = await rows(
        "SELECT requestKey FROM member_email_bindings WHERE actorUserId=?",
        [actorId],
      );
      const response = await fetch(base + "/api/auth/email-bindings/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: await proof(intent.requestKey) }),
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(await response.json()).toEqual({ ok: true });
      await form
        .getByRole("button", { name: "Проверить заявку", exact: true })
        .click();
      await browserExpect(
        page.getByText("browser.member@example.test", { exact: true }),
      ).toBeVisible();
      await browserExpect(
        page.getByRole("button", { name: "Привязать почту", exact: true }),
      ).toHaveCount(0);
      expect(
        await rows(
          "SELECT email,passwordHash,sessionVersion FROM users WHERE id=?",
          [memberId],
        ),
      ).toEqual([
        {
          email: "browser.member@example.test",
          passwordHash: "SYNTHETIC_MEMBER_HASH",
          sessionVersion: 0,
        },
      ]);
      expect(
        await rows("SELECT * FROM club_payments WHERE userId=?", [memberId]),
      ).toEqual(before);
      expect(
        await rows(
          "SELECT state,email,proofHash FROM member_email_bindings WHERE requestKey=?",
          [intent.requestKey],
        ),
      ).toEqual([{ state: "confirmed", email: null, proofHash: null }]);
    }, 30_000);
    it("confirms from the recipient page only after explicit action without changing credentials, access or browser identity", async () => {
      await connection.query(
        "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'binding-browser-existing-access','paid','0','2030-01-01')",
        [memberId],
      );
      const access = await rows("SELECT * FROM club_payments WHERE userId=?", [
        memberId,
      ]);
      const administrator = await context.newPage();
      await send(administrator);
      const [intent] = await rows(
        "SELECT requestKey FROM member_email_bindings WHERE actorUserId=?",
        [actorId],
      );
      const recipient = await context.newPage();
      const beforeCookies = await context.cookies();
      let writes = 0;
      recipient.on("request", (request) => {
        if (request.url().endsWith("/api/auth/email-bindings/confirm")) {
          writes++;
          expect(request.headers().cookie).toBeUndefined();
          expect(request.headers().referer).toBeUndefined();
        }
      });
      await recipient.goto(
        frontend! + "email-binding#token=" + (await proof(intent.requestKey)),
      );
      const submit = recipient.getByRole("button", {
        name: "Подтвердить почту",
        exact: true,
      });
      await browserExpect(submit).toBeEnabled();
      expect(new URL(recipient.url()).hash).toBe("");
      expect(writes).toBe(0);
      expect(
        await rows("SELECT email FROM users WHERE id=?", [memberId]),
      ).toEqual([{ email: null }]);
      await submit.click();
      await browserExpect(recipient.getByRole("status")).toContainText(
        "Почта подтверждена",
      );
      expect(writes).toBe(1);
      expect(await context.cookies()).toEqual(beforeCookies);
      expect(
        await rows(
          "SELECT openId,phone,email,passwordHash,sessionVersion FROM users WHERE id=?",
          [memberId],
        ),
      ).toEqual([
        {
          openId: "binding-browser-member",
          phone: "+70000091402",
          email: "browser.member@example.test",
          passwordHash: "SYNTHETIC_MEMBER_HASH",
          sessionVersion: 0,
        },
      ]);
      expect(
        await rows("SELECT * FROM club_payments WHERE userId=?", [memberId]),
      ).toEqual(access);
      expect(
        await rows(
          "SELECT state,email,proofHash FROM member_email_bindings WHERE requestKey=?",
          [intent.requestKey],
        ),
      ).toEqual([{ state: "confirmed", email: null, proofHash: null }]);
    }, 30_000);
    it("does not show confirmation or change SQL when the recipient submits an expired proof", async () => {
      const administrator = await context.newPage();
      await send(administrator);
      const [intent] = await rows(
        "SELECT requestKey FROM member_email_bindings WHERE actorUserId=?",
        [actorId],
      );
      const savedProof = await proof(intent.requestKey);
      await connection.query(
        "UPDATE member_email_bindings SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE requestKey=?",
        [intent.requestKey],
      );
      const before = await rows("SELECT * FROM users WHERE id=?", [memberId]);
      const recipient = await context.newPage();
      await recipient.goto(frontend! + "email-binding#token=" + savedProof);
      await recipient
        .getByRole("button", { name: "Подтвердить почту", exact: true })
        .click();
      await browserExpect(recipient.getByRole("status")).toContainText(
        "уже использована",
      );
      await browserExpect(recipient.getByRole("status")).not.toContainText(
        "Почта подтверждена",
      );
      expect(await rows("SELECT * FROM users WHERE id=?", [memberId])).toEqual(
        before,
      );
      expect(
        await rows("SELECT action FROM admin_audit_log WHERE targetId=?", [
          memberId,
        ]),
      ).toEqual([{ action: "request_member_email_binding" }]);
    }, 30_000);
    it("keeps the committed result ambiguous after a lost confirmation reply and a consumed-proof reopen without duplicating audit", async () => {
      const administrator = await context.newPage();
      await send(administrator);
      const [intent] = await rows(
        "SELECT requestKey FROM member_email_bindings WHERE actorUserId=?",
        [actorId],
      );
      const savedProof = await proof(intent.requestKey);
      const recipient = await context.newPage();
      let writes = 0;
      await recipient.route(
        "**/api/auth/email-bindings/confirm",
        async (route) => {
          writes++;
          const request = route.request();
          // Native Node transport has no browser cookie jar and preserves omitted credentials.
          const response = await fetch(
            base + "/api/auth/email-bindings/confirm",
            {
              method: "POST",
              headers: request.headers(),
              body: request.postData(),
              redirect: "error",
            },
          );
          expect(response.headers.get("set-cookie")).toBeNull();
          if (writes === 1) {
            expect(response.status).toBe(200);
            await response.text();
            return route.abort("failed");
          }
          expect(response.status).toBe(400);
          return route.fulfill({
            status: response.status,
            headers: { "Content-Type": "application/json" },
            body: await response.text(),
          });
        },
      );
      await recipient.goto(frontend! + "email-binding#token=" + savedProof);
      await recipient
        .getByRole("button", { name: "Подтвердить почту", exact: true })
        .click();
      await browserExpect(
        recipient.getByText("Ответ не подтверждён.", { exact: false }),
      ).toBeVisible();
      expect(writes).toBe(1);
      const before = await rows("SELECT * FROM users WHERE id=?", [memberId]);
      expect(before[0].email).toBe("browser.member@example.test");
      await recipient.goto(frontend! + "email-binding#token=" + savedProof);
      await recipient
        .getByRole("button", { name: "Подтвердить почту", exact: true })
        .click();
      await browserExpect(recipient.getByRole("status")).toContainText(
        "уже использована",
      );
      await browserExpect(recipient.getByRole("status")).not.toContainText(
        "Почта подтверждена",
      );
      expect(writes).toBe(2);
      expect(await rows("SELECT * FROM users WHERE id=?", [memberId])).toEqual(
        before,
      );
      expect(
        await rows(
          "SELECT action FROM admin_audit_log WHERE targetId=? ORDER BY id",
          [memberId],
        ),
      ).toEqual([
        { action: "request_member_email_binding" },
        { action: "confirm_member_email_binding" },
      ]);
    }, 30_000);
    it.each(
      ["moderator", "user"].flatMap((role) =>
        ["request", "status"].map((operation) => ({ role, operation })),
      ),
    )(
      "refuses $operation from a stale admin form after the actor becomes $role without changing SQL",
      async ({ role, operation }) => {
        const page = await context.newPage();
        const form =
          operation === "status" ? await send(page) : await open(page);
        const before = await rows(
          "SELECT * FROM member_email_bindings WHERE actorUserId=?",
          [actorId],
        );
        const auditBefore = await rows(
          "SELECT id FROM admin_audit_log WHERE actorUserId=?",
          [actorId],
        );
        await connection.query("UPDATE users SET role=? WHERE id=?", [
          role,
          actorId,
        ]);
        if (operation === "request")
          await form
            .getByLabel("Почта участницы")
            .fill("browser.member@example.test");
        const rejected = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname.startsWith(
              "/api/admin/member-email-bindings",
            ) &&
            response.request().method() ===
              (operation === "request" ? "POST" : "GET"),
        );
        await form
          .getByRole("button", {
            name:
              operation === "request"
                ? "Отправить подтверждение"
                : "Проверить заявку",
            exact: true,
          })
          .click();
        expect((await rejected).status()).toBe(403);
        expect(
          await rows(
            "SELECT * FROM member_email_bindings WHERE actorUserId=?",
            [actorId],
          ),
        ).toEqual(before);
        expect(
          await rows("SELECT id FROM admin_audit_log WHERE actorUserId=?", [
            actorId,
          ]),
        ).toEqual(auditBefore);
        expect(
          await rows("SELECT email FROM users WHERE id=?", [memberId]),
        ).toEqual([{ email: null }]);
      },
      30_000,
    );
  },
);
