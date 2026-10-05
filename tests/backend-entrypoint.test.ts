import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build, type Metafile } from "esbuild";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, rmSync, rmdirSync } from "node:fs";
import { createServer, type AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { once } from "node:events";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../apps/backend/src/routers";

// The executable reads this legacy absolute env path. Never let a test read
// deployment credentials; the importable application tests do not load env files.
describe.skipIf(existsSync("/var/www/daryadarcy/.env"))(
  "built backend executable",
  () => {
    let buildDir: string;
    let runtimeDir: string;
    let entry: string;
    let metafile: Metafile;

    beforeAll(async () => {
      buildDir = mkdtempSync(resolve(".tmp-nest-build-"));
      runtimeDir = mkdtempSync(join(tmpdir(), "daryadarcy-nest-runtime-"));
      mkdirSync(join(runtimeDir, "cwd"));
      entry = join(buildDir, "index.mjs");
      const result = await build({
        entryPoints: [resolve("apps/backend/src/_core/index.ts")],
        platform: "node",
        packages: "external",
        bundle: true,
        format: "esm",
        outfile: entry,
        metafile: true,
      });
      metafile = result.metafile!;
    });
    afterAll(() => {
      if (entry) rmSync(entry, { force: true });
      if (buildDir) rmdirSync(buildDir);
      if (runtimeDir) {
        rmdirSync(join(runtimeDir, "cwd"));
        rmdirSync(runtimeDir);
      }
    });
    function start(port: number) {
      return spawn(process.execPath, [entry], {
        cwd: join(runtimeDir, "cwd"),
        stdio: ["ignore", "pipe", "pipe"],
        // Do not inherit the shell's database/provider credentials or project .env.
        env: {
          NODE_ENV: "production",
          HOST: "127.0.0.1",
          PORT: String(port),
          DATABASE_URL: " ",
          JWT_SECRET: "isolated-built-runtime-test-secret",
          PUBLIC_APP_URL: "https://club.example.test",
          ENABLE_SMS_LOGIN: "false",
          ENABLE_PEN_PALS: "false",
        },
      });
    }
    async function stop(child: ChildProcess) {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const exited = once(child, "exit");
      child.kill("SIGKILL");
      await exited;
    }
    it("compiles the Nest composition into the actual production entrypoint", () => {
      expect(Object.keys(metafile.inputs)).toContain(
        "apps/backend/src/app.module.ts",
      );
      expect(Object.keys(metafile.inputs)).toContain(
        "apps/backend/src/_core/application.ts",
      );
    });
    it("starts the compiled Node artifact and keeps public HTTP contracts", async () => {
      const reservation = createServer();
      await new Promise<void>((resolve) =>
        reservation.listen(0, "127.0.0.1", resolve),
      );
      const port = (reservation.address() as AddressInfo).port;
      await new Promise<void>((resolve) => reservation.close(() => resolve()));
      const child = start(port);
      let output = "";
      child.stderr!.resume();
      try {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("Built server did not become ready")),
            10_000,
          );
          child.once("error", (error) => {
            clearTimeout(timeout);
            reject(error);
          });
          child.once("exit", () => {
            clearTimeout(timeout);
            reject(new Error("Built server exited before readiness"));
          });
          child.stdout!.on("data", (data) => {
            output += data.toString();
            if (
              output.includes(`[api] server listening on 127.0.0.1:${port}`)
            ) {
              clearTimeout(timeout);
              resolve();
            }
          });
        });
        const health = await fetch(`http://127.0.0.1:${port}/api/health`, {
          signal: AbortSignal.timeout(3000),
        });
        expect(await health.json()).toMatchObject({
          ok: true,
          timestamp: expect.any(Number),
        });
        const capabilities = await fetch(
          `http://127.0.0.1:${port}/api/capabilities`,
          { signal: AbortSignal.timeout(3000) },
        );
        expect(capabilities.status).toBe(200);
        expect(capabilities.headers.get("cache-control")).toBe("no-store");
        const settings = await fetch(
          `http://127.0.0.1:${port}/api/launch-config`,
          {
            signal: AbortSignal.timeout(3000),
          },
        );
        expect(settings.status).toBe(503);
        expect(await settings.json()).toEqual({ error: "Запрос недоступен" });
        expect(settings.headers.get("cache-control")).toBe("no-store");
        // A real call into the injected service: an undefined dependency would
        // be caught as HTTP 500, rather than the expected unauthenticated 401.
        const login = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "built-fixture@example.test",
            password: "not-a-password",
          }),
          signal: AbortSignal.timeout(3000),
        });
        expect(login.status).toBe(401);
        expect(await login.json()).toEqual({
          error: "Неверный email или пароль",
        });
        expect(login.headers.get("set-cookie")).toBeNull();
        const privateSettings = await fetch(
          `http://127.0.0.1:${port}/api/admin/launch-settings`,
          { signal: AbortSignal.timeout(3000) },
        );
        expect(privateSettings.status).toBe(401);
        expect(await privateSettings.text()).toBe("Unauthorized");
        expect(privateSettings.headers.get("cache-control")).toBe("no-store");
        const resend = await fetch(
          `http://127.0.0.1:${port}/api/admin/access-email/resend`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: 1 }),
            signal: AbortSignal.timeout(3000),
          },
        );
        expect(resend.status).toBe(403);
        expect(await resend.json()).toEqual({ error: "Запрос недоступен." });
        expect(resend.headers.get("cache-control")).toBe("no-store");
        const client = createTRPCProxyClient<AppRouter>({
          links: [
            httpLink({
              url: `http://127.0.0.1:${port}/api/trpc`,
              transformer: superjson,
            }),
          ],
        });
        expect(await client.auth.me.query()).toBeNull();
        // An undefined content/session injection or unbound context callback
        // returns INTERNAL_SERVER_ERROR, not these public/protected contracts.
        expect(await client.feed.getById.query({ id: 1 })).toBeUndefined();
        expect(await client.feed.list.query()).toEqual([]);
        expect(await client.feed.tags.query()).toEqual([]);
        expect(await client.feed.listPaginated.query({ cursor: null })).toEqual(
          {
            posts: [],
            nextCursor: null,
          },
        );
        await expect(
          client.feed.listPaginated.query({ limit: 1.5 }),
        ).rejects.toMatchObject({
          data: { code: "BAD_REQUEST", httpStatus: 400 },
        });
        expect(await client.videos.list.query()).toEqual([]);
        expect(await client.videos.getById.query({ id: 1 })).toBeUndefined();
        expect(await client.articles.list.query()).toEqual([]);
        expect(await client.articles.getById.query({ id: 1 })).toBeUndefined();
        await expect(client.feed.savedPosts.query()).rejects.toMatchObject({
          data: { code: "UNAUTHORIZED", httpStatus: 401 },
        });
        for (const write of [
          () =>
            client.admin.createPost.mutate({
              text: "Denied",
              photos: [],
              tags: [],
            }),
          () => client.admin.updatePost.mutate({ id: 1, text: "Denied" }),
          () => client.admin.confirmPost.mutate({ id: 1 }),
        ]) {
          await expect(write()).rejects.toMatchObject({
            data: { code: "UNAUTHORIZED", httpStatus: 401 },
          });
        }
      } finally {
        await stop(child);
      }
    }, 15_000);
    it("fails rather than silently switching the production port when it is occupied", async () => {
      const occupied = createServer();
      await new Promise<void>((resolve) =>
        occupied.listen(0, "127.0.0.1", resolve),
      );
      const child = start((occupied.address() as AddressInfo).port);
      child.stdout!.resume();
      child.stderr!.resume();
      try {
        const [code] = await once(child, "exit", {
          signal: AbortSignal.timeout(10_000),
        });
        expect(code).toBe(1);
      } finally {
        await stop(child);
        await new Promise<void>((resolve) => occupied.close(() => resolve()));
      }
    }, 15_000);
  },
);
