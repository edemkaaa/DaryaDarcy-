import { expect, it } from "vitest";
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

it("compiled ESM wires the Nest checkout service and fails closed without provider configuration", async () => {
  const directory = mkdtempSync(resolve(".tmp-nest-billing-"));
  const entry = join(directory, "application.mjs");
  try {
    // Production bundle flags, but no env loader, listener bootstrap or jobs.
    await build({
      stdin: {
        resolveDir: process.cwd(),
        loader: "ts",
        contents: `
          import { createBackendApplication } from "./apps/backend/src/_core/application";
          import { ClubCheckoutService } from "./apps/backend/src/billing/club-checkout.service";
          import { createTRPCProxyClient, httpLink } from "@trpc/client";
          import superjson from "superjson";
          const application = await createBackendApplication();
          try {
            await application.listen(0, "127.0.0.1");
            const base = "http://127.0.0.1:" + application.getHttpServer().address().port;
            const client = createTRPCProxyClient({ links: [httpLink({url: base + "/api/trpc", transformer: superjson})] });
            const checkout = application.get(ClubCheckoutService);
            let realError;
            try { await client.club.createCheckout.mutate({ email: "guest@example.test" }); }
            catch(error) { realError = { code: error.data.code, status: error.data.httpStatus }; }
            checkout.createCheckout = async (actor, input) => {
              if (actor !== null || input.email !== "guest@example.test" || input.plan !== "semiannual") throw Error("Wrong checkout arguments");
              return { url: "https://fixture.payform.ru/?order_id=built-provider", user: null };
            };
            const injected = await client.club.createCheckout.mutate({ email: "guest@example.test", plan: "semiannual" });
            console.log("CHECKOUT_RESULTS:" + JSON.stringify({realError, injected}));
          } finally { await application.close(); }
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
      env: {
        NODE_ENV: "production",
        DATABASE_URL: "",
        PRODAMUS_SECRET: "",
        PUBLIC_APP_URL: "https://club.example.test",
      },
      encoding: "utf8",
      timeout: 10_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const result = output
      .split("\n")
      .find((line) => line.startsWith("CHECKOUT_RESULTS:"));
    expect(result).toBeDefined();
    expect(JSON.parse(result!.slice("CHECKOUT_RESULTS:".length))).toEqual({
      realError: { code: "PRECONDITION_FAILED", status: 412 },
      injected: {
        url: "https://fixture.payform.ru/?order_id=built-provider",
        user: null,
      },
    });
  } finally {
    rmSync(entry, { force: true });
    rmdirSync(directory);
  }
}, 15_000);
