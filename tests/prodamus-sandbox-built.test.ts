import { expect, it } from "vitest";
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

it("compiled ESM keeps diagnostic signature verification separate from live settlement", async () => {
  const directory = mkdtempSync(resolve(".tmp-prodamus-sandbox-"));
  const entry = join(directory, "application.mjs");
  try {
    await build({
      stdin: {
        resolveDir: process.cwd(),
        loader: "ts",
        contents: `
          import { createBackendApplication } from "./apps/backend/src/_core/application";
          import { ClubSettlementService } from "./apps/backend/src/billing/club-settlement.service";
          import { createHmac } from "node:crypto";
          const app = await createBackendApplication();
          try {
            await app.listen(0, "127.0.0.1");
            const base = "http://127.0.0.1:" + app.getHttpServer().address().port;
            let calls = 0;
            app.get(ClubSettlementService).settle = async () => { calls++; throw Error("Diagnostic reached settlement"); };
            const raw = '{"currency":"rub","customer_email":"prodamus-demo@example.test","demo_mode":"1","domain":"testpage1.payform.ru","order_id":"300155","order_num":"dd-demo-83be933e-a277-41f3-801d-45771c12b051","payment_status":"success","sum":"790.00"}';
            const options = { method: "POST", body: raw, headers: { "Content-Type": "application/json", Sign: createHmac("sha256", "a".repeat(64)).update(raw).digest("hex") } };
            const diagnostic = await fetch(base + "/api/prodamus/sandbox/webhook", options);
            const ack = await diagnostic.json();
            const ordinary = await fetch(base + "/api/prodamus/webhook", options);
            console.log("SANDBOX_RESULT:" + JSON.stringify({ status: diagnostic.status, ack, cookie: diagnostic.headers.get("set-cookie"), ordinaryStatus: ordinary.status, calls }));
          } finally { await app.close(); }
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
      timeout: 10_000,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        NODE_ENV: "production",
        DATABASE_URL: "",
        PUBLIC_APP_URL: "https://daryadarcy.dev.reeskeen.ru",
        PRODAMUS_SECRET: "a".repeat(64),
        PRODAMUS_SANDBOX_ENABLED: "true",
        PRODAMUS_SANDBOX_SECRET: "a".repeat(64),
        PRODAMUS_SANDBOX_SYS: "daryadarcy",
        PRODAMUS_SANDBOX_PAYFORM_URL: "https://testpage1.payform.ru",
        PRODAMUS_SANDBOX_ORDER_ID:
          "dd-demo-83be933e-a277-41f3-801d-45771c12b051",
      },
    });
    const line = output
      .split("\n")
      .find((value) => value.startsWith("SANDBOX_RESULT:"));
    expect(line).toBeDefined();
    expect(JSON.parse(line!.slice("SANDBOX_RESULT:".length))).toEqual({
      status: 200,
      ack: {
        mode: "demo",
        accessGranted: false,
        notificationVerified: true,
        paymentStatus: "success",
      },
      cookie: null,
      ordinaryStatus: 400,
      calls: 0,
    });
  } finally {
    rmSync(entry, { force: true });
    rmdirSync(directory);
  }
});

it("compiled standalone composition verifies callbacks without loading application effect ports", async () => {
  const directory = mkdtempSync(resolve(".tmp-prodamus-isolated-"));
  const entry = join(directory, "application.mjs");
  try {
    const result = await build({
      stdin: {
        resolveDir: process.cwd(),
        loader: "ts",
        contents: String.raw`
          import Module from "node:module";
          import { createProdamusSandboxApplication } from "./apps/backend/src/billing/prodamus-sandbox.application";
          import { createHmac } from "node:crypto";
          const load = Module._load;
          Module._load = function (name, ...args) {
            if (/^(mysql2|drizzle-orm|nodemailer|axios|@aws-sdk|@trpc)(\/|$)/.test(name))
              throw Error("Forbidden external effect dependency");
            return load.call(this, name, ...args);
          };
          const app = await createProdamusSandboxApplication();
          try {
            await app.listen(0, "127.0.0.1");
            const base = "http://127.0.0.1:" + app.getHttpServer().address().port;
            const raw = '{"currency":"rub","customer_email":"prodamus-demo@example.test","demo_mode":"1","domain":"testpage1.payform.ru","order_id":"300155","order_num":"dd-demo-83be933e-a277-41f3-801d-45771c12b051","payment_status":"success","sum":"790.00"}';
            const response = await fetch(base + "/api/prodamus/sandbox/webhook", { method: "POST", body: raw, headers: { "Content-Type": "application/json", Sign: createHmac("sha256", "a".repeat(64)).update(raw).digest("hex") } });
            const live = await fetch(base + "/api/prodamus/webhook", { method: "POST" });
            console.log("ISOLATED_RESULT:" + JSON.stringify({ status: response.status, ack: await response.json(), cookie: response.headers.get("set-cookie"), liveStatus: live.status }));
          } finally { await app.close(); }
        `,
      },
      platform: "node",
      packages: "external",
      bundle: true,
      format: "esm",
      outfile: entry,
      metafile: true,
    });
    // Enforce the no-effects dependency boundary, including bundled local modules.
    expect(
      Object.keys(result.metafile!.inputs).filter((name) =>
        /apps\/backend\/src\/(db|platform-db|prodamus)\.ts$|apps\/backend\/src\/(identity|jobs)\/|apps\/backend\/src\/app\.module\.ts$/.test(
          name,
        ),
      ),
    ).toEqual([]);
    expect(
      Object.values(result.metafile!.outputs)
        .flatMap((output) => output.imports)
        .map((value) => value.path)
        .filter((name) =>
          /^(mysql2|drizzle-orm|nodemailer|axios|@aws-sdk|@trpc)(\/|$)/.test(
            name,
          ),
        ),
    ).toEqual([]);
    const output = execFileSync(process.execPath, [entry], {
      cwd: tmpdir(),
      encoding: "utf8",
      timeout: 10_000,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        NODE_ENV: "production",
        PUBLIC_APP_URL: "https://daryadarcy.dev.reeskeen.ru",
        PRODAMUS_SANDBOX_ENABLED: "true",
        PRODAMUS_SANDBOX_SECRET: "a".repeat(64),
        PRODAMUS_SANDBOX_SYS: "daryadarcy",
        PRODAMUS_SANDBOX_PAYFORM_URL: "https://testpage1.payform.ru",
        PRODAMUS_SANDBOX_ORDER_ID:
          "dd-demo-83be933e-a277-41f3-801d-45771c12b051",
      },
    });
    const line = output
      .split("\n")
      .find((value) => value.startsWith("ISOLATED_RESULT:"));
    expect(line).toBeDefined();
    expect(JSON.parse(line!.slice("ISOLATED_RESULT:".length))).toEqual({
      status: 200,
      ack: {
        mode: "demo",
        accessGranted: false,
        notificationVerified: true,
        paymentStatus: "success",
      },
      cookie: null,
      liveStatus: 404,
    });
  } finally {
    rmSync(entry, { force: true });
    rmdirSync(directory);
  }
});
