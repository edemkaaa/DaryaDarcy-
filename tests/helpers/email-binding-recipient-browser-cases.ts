import { expect, it } from "vitest";
import {
  expect as browserExpect,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";
import type { INestApplication } from "@nestjs/common";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { getDb } from "../../apps/backend/src/db";
import { sdk } from "../../apps/backend/src/_core/sdk";
import { hashPassword } from "../../apps/backend/src/_core/password";
import { COOKIE_NAME } from "../../packages/shared/src/const";
import { processMemberEmailBindingEmails } from "../../apps/backend/src/identity/email-binding-delivery";
import { sendTransactionalEmail } from "../../apps/backend/src/_core/email";

interface EmailBindingRecipientBrowserFixture {
  rows(sql: string, args?: unknown[]): Promise<RowDataPacket[]>;
  connection: Pick<Connection, "query">;
  context: BrowserContext;
  application: INestApplication;
  actorId: number;
  memberId: number;
  base: string;
  frontend: string;
  smtp: { messages: string[]; recipients: string[] };
  send(page: Page): Promise<Locator>;
}

// Share the parent native lifecycle; read its per-test context only when a
// case runs, never at registration time. No extra server or SQL cleanup.
export function registerEmailBindingRecipientBrowserCases(
  fixture: () => EmailBindingRecipientBrowserFixture,
) {
  async function deliveredLink() {
    const { smtp, frontend } = fixture();
    const database = await getDb();
    if (!database) throw new Error("Disposable database unavailable");
    await processMemberEmailBindingEmails(database, sendTransactionalEmail);
    expect(smtp.recipients).toEqual(["RCPT TO:<browser.member@example.test>"]);
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
  it("opens the delivered GET from a webmail document without changing SQL or leaking proof", async () => {
    const { rows, context, actorId, memberId, base, application, send } =
      fixture();
    await send(await context.newPage());
    const link = await deliveredLink();
    const before = await rows("SELECT * FROM users WHERE id=?", [memberId]);
    const recipient = await context.newPage();
    recipient.on("request", (request) => {
      expect(request.url()).not.toContain("token=");
    });
    const response = await recipient.goto(link.toString());
    expect(response?.status()).toBe(200);
    // Synthetic webmail document is fulfilled locally: no external mail or
    // network access. This separate boundary probe goes directly to native
    // Nest (test-only origin replacement); unlike the transport proxy it
    // observes Chromium's Fetch Metadata on the actual HTTP wire.
    const boundaryLink = new URL(link.pathname + link.hash, base);
    await recipient.route(base + link.pathname, (route) => route.continue());
    await recipient.route("https://webmail.example.test/inbox", (route) =>
      route.fulfill({
        contentType: "text/html; charset=utf-8",
        body: `<a href="${boundaryLink.toString()}">Открыть письмо</a>`,
      }),
    );
    await recipient.goto("https://webmail.example.test/inbox");
    let entryHeaders: import("node:http").IncomingHttpHeaders = {};
    const observe = (request: import("node:http").IncomingMessage) => {
      if (request.url === link.pathname) entryHeaders = request.headers;
    };
    const server = application.getHttpServer();
    server.on("request", observe);
    try {
      await recipient.getByRole("link", { name: "Открыть письмо" }).click();
      await recipient.waitForURL((url) => url.pathname === "/email-binding");
    } finally {
      server.off("request", observe);
    }
    expect(entryHeaders["sec-fetch-site"]).toBe("cross-site");
    expect(entryHeaders["sec-fetch-mode"]).toBe("navigate");
    expect(entryHeaders["sec-fetch-dest"]).toBe("document");
    expect(entryHeaders.origin).toBeUndefined();
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
    const { rows, connection, context, actorId, memberId, smtp, send } =
      fixture();
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
  it("logs in through the existing email form after binding with the old password and paid account", async () => {
    const { rows, connection, context, memberId, base, smtp, send } = fixture();
    const password = "synthetic-binding-existing-password-123";
    const passwordHash = await hashPassword(password);
    await connection.query("UPDATE users SET passwordHash=? WHERE id=?", [
      passwordHash,
      memberId,
    ]);
    await connection.query(
      "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'binding-browser-existing-access','paid','0','2030-01-01')",
      [memberId],
    );
    const identity = (
      await rows("SELECT * FROM users WHERE id=?", [memberId])
    )[0];
    const access = await rows("SELECT * FROM club_payments WHERE userId=?", [
      memberId,
    ]);
    const oldMemberToken = await sdk.createSessionToken(
      "binding-browser-member",
      { sessionVersion: 0 },
    );
    await send(await context.newPage());
    const link = await deliveredLink();
    await context.clearCookies();
    const recipient = await context.newPage();
    await recipient.goto(link.toString());
    await recipient
      .getByRole("button", { name: "Подтвердить почту", exact: true })
      .click();
    await browserExpect(recipient.getByRole("status")).toContainText(
      "Почта подтверждена",
    );
    expect(await context.cookies()).toEqual([]);
    expect(
      (await rows("SELECT * FROM users WHERE id=?", [memberId]))[0],
    ).toEqual({
      ...identity,
      email: "browser.member@example.test",
    });
    const oldSession = await fetch(base + "/api/auth/me", {
      headers: { Authorization: `Bearer ${oldMemberToken}` },
    });
    expect(oldSession.status).toBe(200);
    expect((await oldSession.json()).user).toMatchObject({
      id: memberId,
      email: "browser.member@example.test",
    });
    await recipient
      .getByRole("link", { name: "Перейти ко входу", exact: true })
      .click();
    await recipient
      .getByPlaceholder("Email", { exact: true })
      .fill("browser.member@example.test");
    await recipient.getByPlaceholder("Пароль", { exact: true }).fill(password);
    const [login] = await Promise.all([
      recipient.waitForResponse(
        (response) => new URL(response.url()).pathname === "/api/auth/login",
      ),
      recipient.getByRole("button", { name: "Войти", exact: true }).click(),
    ]);
    expect(login.status()).toBe(200);
    expect((await login.json()).user).toMatchObject({
      id: memberId,
      openId: "binding-browser-member",
      role: "user",
    });
    const [cookie] = (await context.cookies()).filter(
      (cookie) => cookie.name === COOKIE_NAME,
    );
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax" });
    const session = await recipient.evaluate(async () => {
      const me = await fetch("/api/auth/me");
      const club = await fetch("/api/trpc/club.list");
      return {
        status: me.status,
        profile: await me.json(),
        clubStatus: club.status,
      };
    });
    expect(session.status).toBe(200);
    expect(session.profile.user).toMatchObject({
      id: memberId,
      email: "browser.member@example.test",
    });
    expect(session.clubStatus).toBe(200);
    expect(
      (
        await rows(
          "SELECT passwordHash,sessionVersion,openId,phone,role FROM users WHERE id=?",
          [memberId],
        )
      )[0],
    ).toEqual({
      passwordHash,
      sessionVersion: 0,
      openId: "binding-browser-member",
      phone: "+70000091402",
      role: "user",
    });
    expect(
      await rows("SELECT * FROM club_payments WHERE userId=?", [memberId]),
    ).toEqual(access);
    expect(
      await rows(
        "SELECT id FROM users WHERE email='browser.member@example.test'",
      ),
    ).toEqual([{ id: memberId }]);
    expect(
      await rows("SELECT id FROM password_tokens WHERE userId=?", [memberId]),
    ).toEqual([]);
    expect(smtp.messages).toHaveLength(1);
  }, 30_000);
}
