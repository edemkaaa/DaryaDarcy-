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
