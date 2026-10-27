import { fork, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Connection, Pool, RowDataPacket } from "mysql2/promise";
import superjson from "superjson";
import sharp from "sharp";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { openContentTestDatabase } from "./helpers/content-mysql";
import { openPrivateUploadWire } from "./helpers/private-upload-wire";
import { sdk } from "../apps/backend/src/_core/sdk";
import { getDb } from "../apps/backend/src/db";

describe.skipIf(!testDatabaseUrl)("real executable shutdown", () => {
  let conn: Connection;
  beforeAll(async () => {
    conn = await openContentTestDatabase();
    vi.stubEnv("DATABASE_URL", testDatabaseUrl!); vi.stubEnv("JWT_SECRET", "shutdown-owned-synthetic-session-secret");
    await conn.query("INSERT INTO users(id,openId,role) VALUES (98770,'shutdown-fixture-admin','admin')");
  });
  afterAll(async () => {
    await conn?.query("DELETE FROM private_content_files WHERE actorUserId=98770");
    await conn?.query("DELETE FROM users WHERE id=98770"); await conn?.end();
    await ((await getDb()) as unknown as { $client: Pool })?.$client.end(); vi.unstubAllEnvs();
  });
  beforeEach(async () => { await conn.query("DELETE FROM private_content_files WHERE actorUserId=98770"); });
  it.each(["drain", "deadline"])("stops accepting requests and preserves the in-flight upload on %s", async mode => {
    const wire = await openPrivateUploadWire({ content: true });
    const cwd = await mkdtemp(resolve(tmpdir(), "daryadarcy-shutdown-"));
    const port = await new Promise<number>(done => {
      const server = createServer(); server.listen(0, "127.0.0.1", () => { const port = (server.address() as { port: number }).port; server.close(() => done(port)); });
    });
    const gate = wire.pausePut();
    let child: ChildProcess | undefined;
    let pending: Promise<Response> | undefined;
    try {
      const root = process.cwd();
      child = fork(resolve(root, "tests/helpers/api-main-process.ts"), [], {
        cwd, execArgv: ["--import", import.meta.resolve("tsx")], stdio: ["ignore", "pipe", "pipe", "ipc"],
        env: { PATH: process.env.PATH, NODE_ENV: "test", HOST: "127.0.0.1", PORT: String(port), TSX_TSCONFIG_PATH: resolve(root, "tsconfig.json"), DATABASE_URL: testDatabaseUrl, JWT_SECRET: "shutdown-owned-synthetic-session-secret", PRIVATE_CONTENT_FILES_ENABLED: "true", S3_ENDPOINT: wire.endpoint, S3_BUCKET: wire.bucket, S3_ACCESS_KEY: "shutdown-fixture", S3_SECRET_KEY: "shutdown-fixture-secret" },
      });
      let exit: { code: number | null; signal: string | null } | undefined;
      const exited = new Promise<void>(done => child!.once("exit", (code, signal) => { exit = { code, signal }; done(); }));
      await new Promise<void>((done, reject) => {
        const timer = setTimeout(() => reject(new Error("Executable startup timed out")), 10000);
        child!.once("message", () => { clearTimeout(timer); done(); });
        child!.once("exit", () => { clearTimeout(timer); reject(new Error("Executable startup exited")); });
      });
      const token = await sdk.createSessionToken("shutdown-fixture-admin", { sessionVersion: 0 });
      const photo = await sharp({ create: { width: 3, height: 2, channels: 3, background: "red" } }).png().toBuffer();
      pending = fetch(`http://127.0.0.1:${port}/api/trpc/admin.uploadPrivateContentFile`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: superjson.stringify({ usage: "postPhoto", filename: "synthetic.png", mimeType: "image/png", idempotencyKey: "shutdown-owned-intent-0001", base64: photo.toString("base64") }), signal: AbortSignal.timeout(15000) });
      // Handle a rejected connection even in the RED test where SIGTERM kills it.
      void pending.catch(() => {});
      await gate.entered;
      child.kill("SIGTERM");
      // A new connection must be refused while the accepted operation remains alive.
      await vi.waitFor(async () => {
        await expect(fetch(`http://127.0.0.1:${port}/api/health`, { headers: { connection: "close" } })).rejects.toThrow();
      }, { timeout: 1500 });
      expect(exit).toBeUndefined();
      if (mode === "drain") {
        gate.release();
        expect((await pending).status).toBe(200);
      }
      await exited; expect(exit).toEqual({ code: mode === "drain" ? 0 : 1, signal: null });
      if (mode === "deadline") expect(await pending.catch(() => null)).toBeNull();
      const [rows] = await conn.query<RowDataPacket[]>("SELECT state FROM private_content_files WHERE actorUserId=98770");
      expect(rows).toEqual([{ state: mode === "drain" ? "ready" : "pending" }]);
      expect(wire.objects.size).toBe(mode === "drain" ? 1 : 0);
    } finally {
      gate.release();
      if (child && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      await pending?.catch(() => {}); await wire.close(); await rm(cwd, { recursive: true, force: true });
    }
  }, 20000);
});
