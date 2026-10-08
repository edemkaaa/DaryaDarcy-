import { expect, it } from "vitest";
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

it("compiled ESM wires Nest billing providers and retains fail-closed configuration and authorization", async () => {
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
          import { ClubSubscriptionService } from "./apps/backend/src/billing/club-subscription.service";
          import { ShopService } from "./apps/backend/src/shop/shop.service";
          import { SessionService } from "./apps/backend/src/identity/session.service";
          import { PRODAMUS_WEBHOOK_HANDLER } from "./apps/backend/src/billing/prodamus-webhook.controller";
          import { createHmac } from "node:crypto";
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
            const subscriptions = application.get(ClubSubscriptionService);
            const sessions = application.get(SessionService);
            sessions.optionalUser = async () => null;
            subscriptions.subscription = async (actor) => {
              if (actor !== null) throw Error("Wrong subscription actor");
              return { subscribed: false, expiresAt: null, cancelAtPeriodEnd: false, isOwner: false, monthlyPrice: "1250" };
            };
            const status = await client.club.subscription.query();
            subscriptions.cancel = async () => { throw Error("Guest must not reach cancellation"); };
            let anonymousError;
            try { await client.club.cancel.mutate(); }
            catch(error) { anonymousError = { code: error.data.code, status: error.data.httpStatus }; }
            const member = {
              id: 7, openId: "built-fixture", email: "member@example.test", name: null,
              phone: null, passwordHash: null, sessionVersion: 0, loginMethod: "email", gender: null,
              avatarUrl: null, role: "user", blockedAt: null, blockedReason: null,
              accountDeletionRequestedAt: null, createdAt: new Date(0), updatedAt: new Date(0), lastSignedIn: new Date(0)
            };
            sessions.optionalUser = async () => member;
            const shop = application.get(ShopService);
            shop.owned = async (actor, productId) => {
              if (actor.id !== 7 || productId !== "digital-1") throw Error("Wrong shop ownership arguments");
              return { owned: true };
            };
            const shopOwned = await client.shop.owned.query({ productId: "digital-1" });
            shop.createCheckout = async () => { throw Error("Disabled shop must not reach checkout"); };
            let shopDisabled;
            try { await client.shop.createCheckout.mutate({ productId: "digital-1" }); }
            catch(error) { shopDisabled = { code: error.data.code, status: error.data.httpStatus }; }
            subscriptions.claimPending = async (id) => {
              if (id !== 7) throw Error("Wrong claim actor");
              return { granted: true, orderId: "club-7-confirmed" };
            };
            subscriptions.cancel = async (id) => {
              if (id !== 7) throw Error("Wrong cancellation actor");
              return { ok: true, expiresAt: new Date("2026-11-01T00:00:00Z") };
            };
            const claimed = await client.club.claimPending.mutate();
            const cancelled = await client.club.cancel.mutate();
            if (!(cancelled.expiresAt instanceof Date)) throw Error("Date serialization lost");
            const unsigned = await fetch(base + "/api/prodamus/webhook", {method: "POST", body: "payment_status=pending"});
            const unsignedWebhook = { status: unsigned.status, body: await unsigned.text() };
            process.env.PRODAMUS_SECRET = "compiled-webhook-fixture-key";
            const signature = createHmac("sha256", "compiled-webhook-fixture-key").update('{"payment_status":"pending"}').digest("hex");
            const signed = await fetch(base + "/api/prodamus/webhook?payment_status=pending", {headers: {Sign: signature}});
            const signedWebhook = { status: signed.status, body: await signed.text() };
            const webhook = application.get(PRODAMUS_WEBHOOK_HANDLER);
            webhook.handle = async (request, response) => {
              if (!Buffer.isBuffer(request.body) || request.body.toString("utf8") !== "raw-compiled-fixture") throw Error("Original webhook bytes lost");
              response.status(202).send("compiled native ingress");
            };
            const forwarded = await fetch(base + "/api/prodamus/webhook", {method: "POST", body: "raw-compiled-fixture"});
            const injectedWebhook = { status: forwarded.status, body: await forwarded.text() };
            console.log("BILLING_RESULTS:" + JSON.stringify({realError, injected, status, anonymousError, claimed, cancelled, unsignedWebhook, signedWebhook, injectedWebhook, shopOwned, shopDisabled}));
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
      .find((line) => line.startsWith("BILLING_RESULTS:"));
    expect(result).toBeDefined();
    expect(JSON.parse(result!.slice("BILLING_RESULTS:".length))).toEqual({
      realError: { code: "PRECONDITION_FAILED", status: 412 },
      injected: {
        url: "https://fixture.payform.ru/?order_id=built-provider",
        user: null,
      },
      status: {
        subscribed: false,
        expiresAt: null,
        cancelAtPeriodEnd: false,
        isOwner: false,
        monthlyPrice: "1250",
      },
      anonymousError: { code: "UNAUTHORIZED", status: 401 },
      claimed: { granted: true, orderId: "club-7-confirmed" },
      cancelled: { ok: true, expiresAt: "2026-11-01T00:00:00.000Z" },
      unsignedWebhook: { status: 400, body: "signature incorrect" },
      signedWebhook: { status: 200, body: "ignored" },
      injectedWebhook: { status: 202, body: "compiled native ingress" },
      shopOwned: { owned: true },
      shopDisabled: { code: "FORBIDDEN", status: 403 },
    });
  } finally {
    rmSync(entry, { force: true });
    rmdirSync(directory);
  }
}, 15_000);
