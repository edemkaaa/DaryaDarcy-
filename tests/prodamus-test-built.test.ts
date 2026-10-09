import { expect, it } from "vitest";
import { build } from "esbuild";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { resolve, join } from "node:path";

it("compiled test process fails closed without configuration and exposes only the selected POST boundaries", async () => {
  const directory = mkdtempSync(resolve(".tmp-prodamus-test-"));
  const entry = join(directory, "runtime.mjs");
  let child: ReturnType<typeof spawn> | undefined;
  try {
    await build({
      entryPoints: ["apps/backend/src/billing/prodamus-test.index.ts"],
      platform: "node",
      packages: "external",
      bundle: true,
      format: "esm",
      outfile: entry,
    });
    const disabled = spawnSync(process.execPath, [entry], {
      encoding: "utf8",
      timeout: 5000,
      env: { NODE_ENV: "production", PRODAMUS_TEST_SECRET: "PRIVATE_FIXTURE" },
    });
    expect(disabled.status).toBe(1);
    expect(disabled.stdout).toBe("");
    expect(disabled.stderr).toBe("Prodamus test startup failed\n");
    child = spawn(process.execPath, [entry], {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        NODE_ENV: "production",
        PORT: "0",
        DATABASE_URL: "",
        PUBLIC_APP_URL: "https://daryadarcy.dev.reeskeen.ru",
        PRODAMUS_TEST_ENABLED: "true",
        PRODAMUS_TEST_PAYFORM_URL: "https://testpage1.payform.ru",
        PRODAMUS_TEST_SECRET: "a".repeat(64),
        YOOKASSA_TEST_ENABLED: "false",
      },
    });
    const base = await new Promise<string>((done, fail) => {
      let output = "";
      const timeout = setTimeout(
        () => fail(new Error("Test listener failed to start")),
        5000,
      );
      child!.stdout!.on("data", (chunk) => {
        output += String(chunk);
        const match = /Prodamus TEST listening on (\d+)/.exec(output);
        if (match) {
          clearTimeout(timeout);
          done(`http://127.0.0.1:${match[1]}`);
        }
      });
      child!.once("exit", () => {
        clearTimeout(timeout);
        fail(new Error("Test listener exited before readiness"));
      });
    });
    for (const [method, path] of [
      ["GET", "/api/launch-config"],
      ["POST", "/api/prodamus/webhook"],
      ["POST", "/api/trpc/admin.users"],
    ])
      expect((await fetch(base + path, { method })).status).toBe(404);
    const unsigned = await fetch(base + "/api/prodamus/test/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(unsigned.status).toBe(400);
    expect(unsigned.headers.get("set-cookie")).toBeNull();
    const result = await fetch(base + "/api/prodamus/test/result", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "83be933e-a277-41f3-801d-45771c12b051",
      },
      body: JSON.stringify({ token: "unknown" }),
    });
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({
      state: "unknown",
      nextAction: null,
      emailStatus: null,
    });
    expect(result.headers.get("set-cookie")).toBeNull();
    expect((await fetch(base + "/api/prodamus/test/result")).status).toBe(404);
  } finally {
    if (child && child.exitCode === null) {
      const stopped = new Promise<void>((done) =>
        child!.once("exit", () => done()),
      );
      child.kill("SIGTERM");
      await stopped;
    }
    rmSync(entry, { force: true });
    rmdirSync(directory);
  }
});
