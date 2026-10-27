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
import { createServer, type AddressInfo, type Socket } from "node:net";
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { getDb, emailToOpenId } from "../apps/backend/src/db";
import { processAccessEmails } from "../apps/backend/src/identity/access";
import { sendTransactionalEmail } from "../apps/backend/src/_core/email";
import { EMAIL_REGISTER_CONSENT_VERSION } from "../packages/shared/src/consent-texts";

// Native HTTP + real MySQL + Nodemailer over a loopback SMTP wire, no mail mocks.
describe.skipIf(!testDatabaseUrl)("pending public registration retry", () => {
  let conn: Connection,
    app: INestApplication,
    base: string,
    fixture = 0;
  let rejectRecipient = false;
  const prefix = "registration-retry-fixture-";
  const sockets = new Set<Socket>(),
    messages: string[] = [],
    recipients: string[] = [];
  const smtp = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    socket.setEncoding("utf8");
    socket.write("220 local.test ESMTP\r\n");
    let pending = "",
      body: string[] | null = null;
    socket.on("data", (chunk) => {
      pending += chunk;
      let end: number;
      while ((end = pending.indexOf("\r\n")) >= 0) {
        const line = pending.slice(0, end);
        pending = pending.slice(end + 2);
        if (body !== null) {
          if (line === ".") {
            messages.push(body.join("\r\n"));
            body = null;
            socket.write("250 queued\r\n");
          } else body.push(line.replace(/^\.\./, "."));
        } else if (/^EHLO|^HELO/.test(line))
          socket.write("250-local.test\r\n250-AUTH PLAIN\r\n250 8BITMIME\r\n");
        else if (line.startsWith("AUTH PLAIN"))
          socket.write("235 authenticated\r\n");
        else if (line.startsWith("MAIL FROM")) socket.write("250 accepted\r\n");
        else if (line.startsWith("RCPT TO")) {
          if (!rejectRecipient) recipients.push(line);
          socket.write(
            rejectRecipient ? "550 rejected\r\n" : "250 accepted\r\n",
          );
        } else if (line === "DATA") {
          body = [];
          socket.write("354 send data\r\n");
        } else if (line === "QUIT") socket.end("221 goodbye\r\n");
        else socket.write("500 unsupported\r\n");
      }
    });
  });
  async function rows(sql: string, values: unknown[] = []) {
    return (await conn.query<RowDataPacket[]>(sql, values))[0];
  }
  const email = () => `${prefix}${fixture}@example.test`;
  async function post(path: string, body: unknown) {
    return fetch(base + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": `198.51.100.${fixture}`,
      },
      body: JSON.stringify(body),
    });
  }
  const register = (
    name = "Original name",
    consentVersion = EMAIL_REGISTER_CONSENT_VERSION,
  ) => post("/api/auth/register", { email: email(), name, consentVersion });
  async function user() {
    return (await rows("SELECT * FROM users WHERE email=?", [email()]))[0];
  }
  async function mails() {
    return rows(
      "SELECT * FROM access_email_outbox WHERE userId=? ORDER BY id",
      [(await user()).id],
    );
  }
  async function tokens() {
    return rows("SELECT * FROM password_tokens WHERE userId=? ORDER BY id", [
      (await user()).id,
    ]);
  }
  async function accepted(response: Response) {
    expect(response.status).toBe(202);
    expect(response.headers.get("set-cookie")).toBeNull();
    const data = await response.json();
    expect(data).toMatchObject({ ok: true, message: expect.any(String) });
    expect(data).not.toHaveProperty("user");
    expect(data).not.toHaveProperty("sessionToken");
  }
  async function cleanup() {
    const ids = (
      await rows("SELECT id FROM users WHERE email LIKE ?", [prefix + "%"])
    ).map((row) => row.id);
    if (!ids.length) return;
    for (const table of [
      "access_email_outbox",
      "password_tokens",
      "user_consent_events",
    ])
      await conn.query(`DELETE FROM ${table} WHERE userId IN (?)`, [ids]);
    await conn.query("DELETE FROM users WHERE id IN (?)", [ids]);
  }
  beforeAll(async () => {
    conn = await openTestDatabase();
    await conn.query(
      `CREATE TABLE IF NOT EXISTS user_consent_events (id INT AUTO_INCREMENT PRIMARY KEY,userId INT NOT NULL,consentKey VARCHAR(64) NOT NULL,status ENUM('granted','revoked') NOT NULL,consentVersion VARCHAR(32) NOT NULL,consentText TEXT,createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`,
    );
    vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
    vi.stubEnv("JWT_SECRET", "registration-retry-fixture-secret-32-characters");
    vi.stubEnv(
      "AUTH_LINK_ENCRYPTION_KEY",
      Buffer.alloc(32, 12).toString("base64"),
    );
    app = await createBackendApplication();
    await app.listen(0, "127.0.0.1");
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    vi.stubEnv("PUBLIC_APP_URL", base);
    await new Promise<void>((resolve) => smtp.listen(0, "127.0.0.1", resolve));
    vi.stubEnv("SMTP_HOST", "127.0.0.1");
    vi.stubEnv("SMTP_PORT", String((smtp.address() as AddressInfo).port));
    vi.stubEnv("SMTP_SECURE", "false");
    vi.stubEnv("SMTP_USER", "sender@example.test");
    vi.stubEnv("SMTP_PASS", "fixture-only-smtp-password");
    vi.stubEnv("SMTP_FROM", "sender@example.test");
  });
  beforeEach(async () => {
    await cleanup();
    fixture++;
    messages.length = 0;
    recipients.length = 0;
    rejectRecipient = false;
  });
  afterAll(async () => {
    await app?.close();
    for (const socket of sockets) socket.destroy();
    if (smtp.listening)
      await new Promise<void>((resolve) => smtp.close(() => resolve()));
    if (conn) {
      await cleanup();
      await conn.end();
    }
    await (
      (await getDb()) as unknown as { $client: { end(): Promise<void> } }
    )?.$client.end();
    vi.unstubAllEnvs();
  });
  async function deliver() {
    const id = (await user()).id;
    await vi.waitFor(
      async () => {
        await processAccessEmails((await getDb())!, sendTransactionalEmail, id);
        const records = await mails();
        expect(
          records.filter((row) => !row.sentAt && !row.discardedAt),
        ).toEqual([]);
      },
      { timeout: 3000, interval: 20 },
    );
  }
  function receivedToken(index = messages.length - 1) {
    const plainPart = messages[index]
      .split(/\r\n--[^\r\n]+(?:\r\n|$)/)
      .find((part) => /^Content-Type: text\/plain;/im.test(part));
    expect(plainPart).toBeDefined();
    const [headers, ...body] = plainPart!.split("\r\n\r\n");
    const wireText = body.join("\r\n\r\n");
    const decoded = /Content-Transfer-Encoding: base64/i.test(headers)
      ? Buffer.from(wireText, "base64").toString("utf8")
      : wireText
          .replace(/=\r\n/g, "")
          .replace(/=([0-9A-F]{2})/gi, (_, byte) =>
            String.fromCharCode(parseInt(byte, 16)),
          );
    const url = decoded.match(/http:\/\/[^\s<]+/)?.[0];
    expect(url).toBeDefined();
    return new URL(url!).hash.slice("#token=".length);
  }
  async function complete(token: string) {
    const response = await post("/api/auth/password/complete", {
      token,
      password: "verified-fixture-password",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
  }

  it("accepts a pending retry without overwriting identity, consent or issuing a session", async () => {
    await accepted(await register());
    const original = await user(),
      originalMails = await mails(),
      originalTokens = await tokens();
    const consents = await rows(
      "SELECT * FROM user_consent_events WHERE userId=?",
      [original.id],
    );
    await accepted(await register("Attacker supplied replacement"));
    expect(await user()).toEqual(original);
    expect(await mails()).toEqual(originalMails);
    expect(await tokens()).toEqual(originalTokens);
    expect(
      await rows("SELECT * FROM user_consent_events WHERE userId=?", [
        original.id,
      ]),
    ).toEqual(consents);
    expect(
      (
        await post("/api/auth/login", {
          email: email(),
          password: "not-yet-set",
        })
      ).status,
    ).toBe(401);
  });
  it("resends after SMTP acceptance without invalidating the first emailed link", async () => {
    await accepted(await register());
    await deliver();
    const first = receivedToken();
    await accepted(await register());
    await deliver();
    expect(recipients).toEqual([
      `RCPT TO:<${email()}>`,
      `RCPT TO:<${email()}>`,
    ]);
    expect(messages).toHaveLength(2);
    expect(receivedToken()).not.toBe(first);
    expect((await tokens()).every((row) => row.consumedAt === null)).toBe(true);
    await complete(first);
    const login = await post("/api/auth/login", {
      email: email(),
      password: "verified-fixture-password",
    });
    expect(login.status).toBe(200);
    expect(login.headers.get("set-cookie")).not.toBeNull();
  });
  it("keeps SMTP rejection pending and reuses the queued link on a public retry", async () => {
    await accepted(await register());
    rejectRecipient = true;
    await processAccessEmails(
      (await getDb())!,
      sendTransactionalEmail,
      (await user()).id,
    );
    expect(messages).toEqual([]);
    expect(await mails()).toMatchObject([
      { sentAt: null, lastError: "delivery_failed", attempts: 1 },
    ]);
    const originalTokens = await tokens();
    await accepted(await register());
    expect(await tokens()).toEqual(originalTokens);
    expect(await mails()).toHaveLength(1);
    rejectRecipient = false;
    await conn.query(
      "UPDATE access_email_outbox SET nextAttemptAt=NOW() WHERE userId=?",
      [(await user()).id],
    );
    await deliver();
    expect(messages).toHaveLength(1);
    await complete(receivedToken());
  });
  it("replaces an expired queued setup without claiming the account", async () => {
    await accepted(await register());
    await conn.query(
      "UPDATE password_tokens SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 MINUTE) WHERE userId=?",
      [(await user()).id],
    );
    await accepted(await register());
    expect(await mails()).toHaveLength(2);
    expect((await user()).passwordHash).toBeNull();
    await deliver();
    expect(messages).toHaveLength(1);
    await complete(receivedToken());
  });
  it("rolls a retry's new token back when durable mail insertion fails", async () => {
    await accepted(await register());
    await deliver();
    const original = await user(),
      originalTokens = await tokens(),
      originalMails = await mails();
    await conn.query(
      `CREATE TRIGGER backend_test_registration_retry BEFORE INSERT ON access_email_outbox FOR EACH ROW BEGIN IF NEW.userId=${Number(original.id)} THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Owned retry failure'; END IF; END`,
    );
    try {
      const response = await register();
      expect(response.status).toBe(500);
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(await tokens()).toEqual(originalTokens);
      expect(await mails()).toEqual(originalMails);
      expect(await user()).toEqual(original);
    } finally {
      await conn.query("DROP TRIGGER backend_test_registration_retry");
    }
    await complete(receivedToken());
  });
  it("bounds concurrent retries to three setup mails per recipient per rolling hour", async () => {
    await accepted(await register());
    await deliver();
    const first = receivedToken();
    await accepted(await register());
    await deliver();
    await Promise.all(
      Array.from({ length: 12 }, async () => accepted(await register())),
    );
    expect(await mails()).toHaveLength(3);
    expect(await tokens()).toHaveLength(3);
    await deliver();
    await accepted(await register());
    expect(await mails()).toHaveLength(3);
    expect(messages).toHaveLength(3);
    await complete(first);
  });
  it("permits another setup once earlier deliveries leave the rolling hour", async () => {
    await accepted(await register());
    await deliver();
    await accepted(await register());
    await deliver();
    await accepted(await register());
    await deliver();
    await conn.query(
      "UPDATE access_email_outbox SET createdAt=DATE_SUB(NOW(),INTERVAL 61 MINUTE) WHERE userId=?",
      [(await user()).id],
    );
    await accepted(await register());
    await deliver();
    expect(await mails()).toHaveLength(4);
    expect(messages).toHaveLength(4);
  });
  it("does not bypass the setup quota or revoke a valid link through password recovery", async () => {
    await accepted(await register());
    await deliver();
    const first = receivedToken();
    await accepted(await register());
    await deliver();
    await accepted(await register());
    await deliver();
    const originalTokens = await tokens();
    expect(
      (await post("/api/auth/password/request", { email: email() })).status,
    ).toBe(202);
    expect(await mails()).toHaveLength(3);
    expect(await tokens()).toEqual(originalTokens);
    await complete(first);
  });
  it.each([
    "passwordHash='existing-hash'",
    "role='admin'",
    "role='moderator'",
    "blockedAt=NOW()",
  ])(
    "does not resume an unavailable or active identity (%s)",
    async (patch) => {
      await accepted(await register());
      await conn.query(`UPDATE users SET ${patch} WHERE email=?`, [email()]);
      const original = await user(),
        originalMails = await mails();
      const response = await register("Replacement");
      await accepted(response);
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(await user()).toEqual(original);
      expect(await mails()).toEqual(originalMails);
    },
  );
  it("does not turn an unrelated passwordless checkout account into public registration", async () => {
    await conn.query(
      "INSERT INTO users (openId,email,name,loginMethod) VALUES (?,?,'Checkout identity','email')",
      [emailToOpenId(email()), email()],
    );
    const original = await user();
    await accepted(await register("Replacement"));
    expect(await user()).toEqual(original);
    expect(await mails()).toEqual([]);
    expect(await tokens()).toEqual([]);
  });
  it("still requires current consent on a pending retry", async () => {
    await accepted(await register());
    const originalTokens = await tokens();
    expect((await register("Replacement", "not-current")).status).toBe(400);
    expect(await tokens()).toEqual(originalTokens);
  });
  it("retains the existing IP quota instead of bypassing it on pending retries", async () => {
    for (let attempt = 0; attempt < 15; attempt++)
      await accepted(await register());
    expect((await register()).status).toBe(429);
    expect(await mails()).toHaveLength(1);
    expect(await tokens()).toHaveLength(1);
  });
  it("keeps pending registration retry passwordless in compiled production ESM", async () => {
    const directory = mkdtempSync(resolve(".tmp-registration-retry-"));
    const entry = join(directory, "application.mjs");
    try {
      await build({
        stdin: {
          resolveDir: process.cwd(),
          loader: "ts",
          contents: `
        import { createBackendApplication } from './apps/backend/src/_core/application';
        import { getDb } from './apps/backend/src/db';
        const app = await createBackendApplication();
        try {
          await app.listen(0,'127.0.0.1');
          const base='http://127.0.0.1:'+app.getHttpServer().address().port;
          const register=async name=>fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'${prefix}compiled@example.test',name,consentVersion:'${EMAIL_REGISTER_CONSENT_VERSION}'})});
          const first=await register('Compiled original'),second=await register('Untrusted replacement');
          const database=await getDb();
          const [users]=await database.$client.query('SELECT id,name,passwordHash FROM users WHERE email=?',['${prefix}compiled@example.test']);
          const [mails]=await database.$client.query('SELECT COUNT(*) n FROM access_email_outbox WHERE userId=?',[users[0].id]);
          console.log('REGISTRATION_RETRY_RESULT:'+JSON.stringify({statuses:[first.status,second.status],noCookies:!first.headers.get('set-cookie')&&!second.headers.get('set-cookie'),name:users[0].name,passwordless:users[0].passwordHash===null,mails:mails[0].n}));
        } finally {await app.close();await (await getDb())?.$client.end();}
      `,
        },
        platform: "node",
        packages: "external",
        bundle: true,
        format: "esm",
        outfile: entry,
      });
      const output = execFileSync(process.execPath, [entry], {
        cwd: tmpdir(),
        encoding: "utf8",
        timeout: 10000,
        env: {
          NODE_ENV: "production",
          DATABASE_URL: testDatabaseUrl!,
          JWT_SECRET: "compiled-registration-fixture-secret-32-characters",
          AUTH_LINK_ENCRYPTION_KEY: Buffer.alloc(32, 12).toString("base64"),
          PUBLIC_APP_URL: "https://club.example.test",
        },
      });
      const result = output
        .split("\n")
        .find((line) => line.startsWith("REGISTRATION_RETRY_RESULT:"));
      expect(result).toBeDefined();
      expect(
        JSON.parse(result!.slice("REGISTRATION_RETRY_RESULT:".length)),
      ).toEqual({
        statuses: [202, 202],
        noCookies: true,
        name: "Compiled original",
        passwordless: true,
        mails: 1,
      });
    } finally {
      if (existsSync(entry)) rmSync(entry);
      rmdirSync(directory);
    }
  });
});
