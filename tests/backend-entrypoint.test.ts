import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build, type Metafile } from "esbuild";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, rmSync, rmdirSync } from "node:fs";
import { createServer, type AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { once } from "node:events";

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
