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
import type { Connection, RowDataPacket } from "mysql2/promise";
import { randomUUID, createDecipheriv } from "node:crypto";
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdtempSync, existsSync, unlinkSync, rmdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import { getDb } from "../apps/backend/src/db";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";

describe.skipIf(!testDatabaseUrl)("email binding native HTTP and MySQL", () => {
  let conn: Connection, app: INestApplication, base: string, bearer: string;
  let fixture = 0;
  const adminPath = "/api/admin/member-email-bindings";
  const confirmPath = "/api/auth/email-bindings/confirm";
  const encryptionKey = Buffer.alloc(32, 31);
  async function rows(sql: string, args: unknown[] = []) {
    return (await conn.query<RowDataPacket[]>(sql, args))[0];
  }
  async function cleanup() {
    await conn.query("DROP TRIGGER IF EXISTS binding_http_audit_failure");
    await conn.query(
      "DELETE o FROM member_email_binding_outbox o JOIN member_email_bindings b ON b.requestKey=o.requestKey WHERE b.actorUserId=91301",
    );
    await conn.query(
      "DELETE FROM member_email_bindings WHERE actorUserId=91301",
    );
    await conn.query(
      "DELETE FROM admin_audit_log WHERE actorUserId=91301 OR targetId=91302",
    );
    await conn.query(
      "DELETE FROM users WHERE id IN (91301,91302) AND openId LIKE 'binding-http-%'",
    );
  }
  beforeAll(async () => {
    conn = await openTestDatabase();
    vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
    vi.stubEnv("JWT_SECRET", "synthetic-binding-http-session-secret-32");
    vi.stubEnv("PUBLIC_APP_URL", "http://127.0.0.1");
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "http://localhost");
    app = await createBackendApplication();
    await app.listen(0, "127.0.0.1");
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    bearer = await sdk.createSessionToken("binding-http-admin", {
      sessionVersion: 2,
    });
  });
  beforeEach(async () => {
    fixture++;
    vi.stubEnv("PUBLIC_APP_URL", "http://127.0.0.1");
    vi.stubEnv("PUBLIC_AUTH_URL", "");
    vi.stubEnv("MEMBER_EMAIL_BINDING_ENABLED", "true");
    vi.stubEnv("AUTH_LINK_ENCRYPTION_KEY", encryptionKey.toString("base64"));
    await cleanup();
    await conn.query(`INSERT INTO users (id,openId,role,phone,sessionVersion,passwordHash) VALUES
      (91301,'binding-http-admin','admin',NULL,2,'ADMIN_HASH'),
      (91302,'binding-http-member','user','+70000091302',4,'MEMBER_HASH')`);
  });
  afterAll(async () => {
    await app?.close();
    if (conn) {
      await cleanup();
      await conn.end();
    }
    await (
      (await getDb()) as unknown as { $client: { end(): Promise<void> } }
    )?.$client.end();
    vi.unstubAllEnvs();
  });
  const input = () => ({
    userId: 91302,
    email: "binding-http@example.test",
    requestKey: randomUUID(),
  });
  function call(
    path: string,
    body?: unknown,
    auth = true,
    headers: Record<string, string> = {},
  ) {
    return fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": `198.51.100.${fixture}`,
        ...(auth ? { Authorization: `Bearer ${bearer}` } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  async function safe(response: Response, code: number) {
    expect(response.status).toBe(code);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).toEqual({ error: "Запрос недоступен." });
  }
  async function proof(requestKey: string) {
    const [binding] = await rows(
      "SELECT b.payloadHash,o.tokenCipher FROM member_email_bindings b JOIN member_email_binding_outbox o USING(requestKey) WHERE b.requestKey=?",
      [requestKey],
    );
    const encrypted = Buffer.from(binding.tokenCipher, "base64");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey,
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
  it("is closed by default for request/status/confirm without creating an intent", async () => {
    vi.stubEnv("MEMBER_EMAIL_BINDING_ENABLED", "");
    const request = input();
    await safe(await call(adminPath, request, false), 503);
    await safe(
      await call(`${adminPath}/${request.requestKey}`, undefined, false),
      503,
    );
    await safe(await call(confirmPath, { token: "a".repeat(43) }, false), 503);
    await safe(await call("/api/auth/email-binding", undefined, false), 503);
    expect(
      await rows("SELECT * FROM member_email_bindings WHERE actorUserId=91301"),
    ).toEqual([]);
  });
  it("redirects the public read-only entry to the configured frontend without consuming a proof or changing identity", async () => {
    const request = input();
    expect((await call(adminPath, request)).status).toBe(202);
    const before = await rows("SELECT * FROM users WHERE id=91302");
    const bindings = await rows(
      "SELECT * FROM member_email_bindings WHERE actorUserId=91301",
    );
    const outbox = await rows(
      "SELECT o.* FROM member_email_binding_outbox o JOIN member_email_bindings b USING(requestKey) WHERE b.actorUserId=91301",
    );
    const audit = await rows(
      "SELECT * FROM admin_audit_log WHERE actorUserId=91301",
    );
    vi.stubEnv("PUBLIC_AUTH_URL", "https://unrelated.example.test");
    const response = await fetch(base + "/api/auth/email-binding", {
      redirect: "manual",
      headers: { Host: "untrusted.example.test" },
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://127.0.0.1/email-binding",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.text()).toBe("");
    expect(await rows("SELECT * FROM users WHERE id=91302")).toEqual(before);
    expect(
      await rows("SELECT * FROM member_email_bindings WHERE actorUserId=91301"),
    ).toEqual(bindings);
    expect(
      await rows(
        "SELECT o.* FROM member_email_binding_outbox o JOIN member_email_bindings b USING(requestKey) WHERE b.actorUserId=91301",
      ),
    ).toEqual(outbox);
    expect(
      await rows("SELECT * FROM admin_audit_log WHERE actorUserId=91301"),
    ).toEqual(audit);
  });
  it("refuses query-bearing entry without reflecting proof or redirect input", async () => {
    for (const query of [
      "token=" + "a".repeat(43),
      "next=https://untrusted.example.test",
      "anything=1",
    ]) {
      const response = await fetch(base + "/api/auth/email-binding?" + query, {
        redirect: "manual",
      });
      await safe(response, 400);
      expect(response.headers.get("location")).toBeNull();
    }
  });
  it("fails closed on invalid configured frontend navigation", async () => {
    vi.stubEnv(
      "PUBLIC_APP_URL",
      "https://user:fixture-only@untrusted.example.test",
    );
    await safe(
      await fetch(base + "/api/auth/email-binding", { redirect: "manual" }),
      503,
    );
    vi.stubEnv("PUBLIC_APP_URL", "http://127.0.0.1");
  });
  it("creates once, recovers safe status and rejects key reuse with a different payload", async () => {
    const request = input();
    const before = await rows("SELECT * FROM users WHERE id=91302");
    for (let i = 0; i < 2; i++) {
      const reply = await call(adminPath, request);
      expect(reply.status).toBe(202);
      expect(await reply.json()).toEqual({
        requestKey: request.requestKey,
        state: "pending",
      });
    }
    const response = await call(`${adminPath}/${request.requestKey}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      requestKey: request.requestKey,
      userId: 91302,
      state: "pending",
      delivery: "queued",
      expiresAt: expect.any(String),
      completedAt: null,
    });
    await safe(
      await call(adminPath, { ...request, email: "different@example.test" }),
      409,
    );
    expect(await rows("SELECT * FROM users WHERE id=91302")).toEqual(before);
    expect(
      await rows("SELECT id FROM admin_audit_log WHERE actorUserId=91301"),
    ).toHaveLength(1);
  });
  it("requires current administrator authority on request and status", async () => {
    await safe(await call(adminPath, input(), false), 401);
    await safe(
      await call(`${adminPath}/${randomUUID()}`, undefined, false),
      401,
    );
    await conn.query("UPDATE users SET role='moderator' WHERE id=91301");
    await safe(await call(adminPath, input()), 403);
    await safe(await call(`${adminPath}/${randomUUID()}`), 403);
  });
  it("rejects a stale session on both protected routes", async () => {
    await conn.query("UPDATE users SET sessionVersion=3 WHERE id=91301");
    await safe(await call(adminPath, input()), 401);
    await safe(await call(`${adminPath}/${randomUUID()}`), 401);
  });
  it.each([
    ["role='user'", 403],
    ["blockedAt=NOW()", 401],
    ["accountDeletionRequestedAt=NOW()", 403],
  ] as const)(
    "refuses an unavailable actor on both routes: %s",
    async (change, status) => {
      await conn.query(`UPDATE users SET ${change} WHERE id=91301`);
      await safe(await call(adminPath, input()), status);
      await safe(await call(`${adminPath}/${randomUUID()}`), status);
    },
  );
  it("validates strict inputs and unavailable targets without leaking values", async () => {
    await safe(await call(adminPath, { ...input(), role: "admin" }), 400);
    await safe(await call(adminPath, { ...input(), userId: 2147483648 }), 400);
    await safe(await call(adminPath, { ...input(), userId: 91303 }), 404);
    await safe(await call(`${adminPath}/invalid-key`), 400);
    await safe(await call(`${adminPath}/${randomUUID()}`), 404);
  });
  it("requires explicit public proof POST and never authenticates or grants a subscription", async () => {
    const request = input();
    expect((await call(adminPath, request)).status).toBe(202);
    const token = await proof(request.requestKey);
    const before = (await rows("SELECT * FROM users WHERE id=91302"))[0];
    expect(
      (await call(`${confirmPath}?token=${token}`, undefined, false)).status,
    ).toBe(404);
    expect(
      (await rows("SELECT email FROM users WHERE id=91302"))[0].email,
    ).toBeNull();
    const response = await call(confirmPath, { token }, false);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).toEqual({ ok: true });
    expect((await rows("SELECT * FROM users WHERE id=91302"))[0]).toEqual({
      ...before,
      email: request.email,
    });
    expect(
      await rows("SELECT * FROM club_payments WHERE userId=91302"),
    ).toEqual([]);
    await safe(await call(confirmPath, { token }, false), 400);
    expect(await (await call(adminPath, request)).json()).toEqual({
      requestKey: request.requestKey,
      state: "confirmed",
    });
  });
  it("rejects malformed and unknown proof bodies identically", async () => {
    for (const body of [
      { token: "bad" },
      { token: "a".repeat(43) },
      { token: "a".repeat(43), userId: 91302 },
      {},
      [],
    ]) {
      await safe(await call(confirmPath, body, false), 400);
    }
  });
  it("returns sanitized 503 and rolls back a request on SQL failure", async () => {
    await conn.query(
      "CREATE TRIGGER binding_http_audit_failure BEFORE INSERT ON admin_audit_log FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='binding-http@example.test private SQL failure'",
    );
    await safe(await call(adminPath, input()), 503);
    expect(
      await rows("SELECT * FROM member_email_bindings WHERE actorUserId=91301"),
    ).toEqual([]);
  });
  it("requires same-origin even for another CORS-allowed origin", async () => {
    await safe(
      await call(adminPath, input(), true, { Origin: "http://localhost" }),
      403,
    );
    await safe(
      await call(confirmPath, { token: "a".repeat(43) }, false, {
        Origin: "http://localhost",
      }),
      403,
    );
    const result = await call(
      `${adminPath}/${randomUUID()}`,
      undefined,
      false,
      { Origin: "https://untrusted.example" },
    );
    expect(result.status).toBe(403);
    expect(result.headers.get("cache-control")).toBe("no-store");
  });
  it("requires JSON and preserves bounded parser errors without echoing input", async () => {
    await safe(
      await call(adminPath, input(), true, { "Content-Type": "text/plain" }),
      415,
    );
    await safe(
      await call(confirmPath, { token: "a".repeat(43) }, false, {
        "Content-Type": "text/plain",
      }),
      415,
    );
    for (const [body, status] of [
      ["null", 400],
      ["{broken-private-input", 400],
      [JSON.stringify({ token: "p".repeat(17000) }), 413],
    ] as const) {
      const response = await fetch(base + confirmPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      expect(response.status).toBe(status);
      expect(response.headers.get("cache-control")).toBe("no-store");
      const error = await response.json();
      expect(Object.keys(error)).toEqual(["error"]);
      expect(error.error).not.toContain("private-input");
    }
  });
  it("does not spend mail quota on status polling and bounds proof attempts", async () => {
    for (let i = 0; i < 21; i++)
      await safe(await call(`${adminPath}/${randomUUID()}`), 404);
    expect((await call(adminPath, input())).status).toBe(202);
    for (let i = 0; i < 20; i++)
      await safe(
        await call(confirmPath, { token: "z".repeat(43) }, false),
        400,
      );
    const response = await call(confirmPath, { token: "z".repeat(43) }, false);
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
    await safe(response, 429);
  });
  it("rolls back failed confirmation and permits the same proof to retry", async () => {
    const request = input();
    expect((await call(adminPath, request)).status).toBe(202);
    const token = await proof(request.requestKey);
    await conn.query(
      "CREATE TRIGGER binding_http_audit_failure BEFORE INSERT ON admin_audit_log FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='private SQL confirmation failure'",
    );
    await safe(await call(confirmPath, { token }, false), 503);
    expect(
      (await rows("SELECT email FROM users WHERE id=91302"))[0].email,
    ).toBeNull();
    await conn.query("DROP TRIGGER binding_http_audit_failure");
    expect((await call(confirmPath, { token }, false)).status).toBe(200);
  });
  // Includes bundling and a separate HTTP/SQL server; keep this budget local.
  it("registers request, recovery and confirmation in compiled production ESM", async () => {
    const directory = mkdtempSync(resolve(".tmp-binding-http-"));
    const entry = join(directory, "application.mjs");
    try {
      await build({
        stdin: {
          resolveDir: process.cwd(),
          loader: "ts",
          contents: `
        import { createBackendApplication } from './apps/backend/src/_core/application';
        import { getDb } from './apps/backend/src/db';
        import { sdk } from './apps/backend/src/_core/sdk';
        import { createDecipheriv, randomUUID } from 'node:crypto';
        const app = await createBackendApplication();
        try {
          await app.listen(0,'127.0.0.1');
          const base='http://127.0.0.1:'+app.getHttpServer().address().port;
          const bearer=await sdk.createSessionToken('binding-http-admin',{sessionVersion:2});
          const call=(path,body)=>fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+bearer},...(body?{body:JSON.stringify(body)}:{})});
          const request={userId:91302,email:'binding-http@example.test',requestKey:randomUUID()};
          const first=await call('/api/admin/member-email-bindings',request);
          const status=await call('/api/admin/member-email-bindings/'+request.requestKey);
          for(let i=0;i<19;i++) {
            if((await call('/api/admin/member-email-bindings',request)).status!==202) throw new Error('Premature request throttle');
          }
          const throttled=await call('/api/admin/member-email-bindings',request);
          const database=await getDb();
          const [rows]=await database.$client.query('SELECT b.payloadHash,o.tokenCipher FROM member_email_bindings b JOIN member_email_binding_outbox o USING(requestKey) WHERE b.requestKey=?',[request.requestKey]);
          const raw=Buffer.from(rows[0].tokenCipher,'base64');
          const cipher=createDecipheriv('aes-256-gcm',Buffer.from(process.env.AUTH_LINK_ENCRYPTION_KEY,'base64'),raw.subarray(0,12));
          cipher.setAAD(Buffer.from('email-binding:v1:'+request.requestKey+':'+rows[0].payloadHash));cipher.setAuthTag(raw.subarray(-16));
          const token=Buffer.concat([cipher.update(raw.subarray(12,-16)),cipher.final()]).toString('utf8');
          const confirmed=await call('/api/auth/email-bindings/confirm',{token});
          const replay=await call('/api/auth/email-bindings/confirm',{token});
          console.log('BINDING_HTTP_RESULT:'+JSON.stringify({statuses:[first.status,status.status,confirmed.status,replay.status],requestQuota:throttled.status,retryAfter:Number(throttled.headers.get('retry-after'))>0,delivery:(await status.json()).delivery,confirmed:await confirmed.json(),noCookie:!confirmed.headers.get('set-cookie')}));
        }finally{await app.close();await (await getDb())?.$client.end();}
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
          JWT_SECRET: "compiled-binding-http-fixture-secret-32",
          AUTH_LINK_ENCRYPTION_KEY: encryptionKey.toString("base64"),
          PUBLIC_APP_URL: "https://club.example.test",
          MEMBER_EMAIL_BINDING_ENABLED: "true",
        },
      });
      const line = output
        .split("\n")
        .find((value) => value.startsWith("BINDING_HTTP_RESULT:"));
      expect(line).toBeDefined();
      expect(JSON.parse(line!.slice("BINDING_HTTP_RESULT:".length))).toEqual({
        statuses: [202, 200, 200, 400],
        requestQuota: 429,
        retryAfter: true,
        delivery: "queued",
        confirmed: { ok: true },
        noCookie: true,
      });
      expect(
        (
          await rows(
            "SELECT email,passwordHash,sessionVersion FROM users WHERE id=91302",
          )
        )[0],
      ).toEqual({
        email: "binding-http@example.test",
        passwordHash: "MEMBER_HASH",
        sessionVersion: 4,
      });
    } finally {
      if (existsSync(entry)) unlinkSync(entry);
      rmdirSync(directory);
    }
  }, 30_000);
});
