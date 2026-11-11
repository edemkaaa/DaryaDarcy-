/** Два Nest-приложения проверяют app-scoped TEST checkout/webhook/result через настоящий HTTP. */
import { afterEach, expect, it, vi } from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { ProdamusTestClubService } from "../apps/backend/src/billing/prodamus-test-club.service";
import * as db from "../apps/backend/src/db";
import type { AppRouter } from "../apps/backend/src/routers";

/** Снимаем identity/provider spies и TEST env. */
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

/** Оба app настраиваются до первого запроса; каждый должен использовать свой service, сохранить raw webhook bytes и нейтральный no-cookie result, без настоящих платежей/БД. */
it("TEST checkout, webhook and return use their own app's billing provider through native HTTP", async () => {
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("PRODAMUS_TEST_ENABLED", "true");
  vi.stubEnv("YOOKASSA_TEST_ENABLED", "false");
  // Only identity lookup and provider behavior are replaced. Transport, Zod,
  // checkout's input rules and module composition remain real.
  vi.spyOn(db, "getUserByEmail").mockResolvedValue(undefined);
  const apps: INestApplication[] = [];
  try {
    for (const label of ["first", "second"]) {
      const app = await createBackendApplication();
      apps.push(app);
      const billing = app.get(ProdamusTestClubService);
      vi.spyOn(billing, "createCheckout").mockImplementation(
        async (email, existing, plan, key, phone, actor) => {
          expect({ email, existing, plan, key, phone, actor }).toEqual({
            email: "guest@example.test",
            existing: undefined,
            plan: "monthly",
            key: undefined,
            phone: "+79991234567",
            actor: null,
          });
          return {
            url: `https://testpage1.payform.ru/?order_id=${label}`,
            user: null,
          };
        },
      );
      vi.spyOn(billing, "notification").mockImplementation(
        async (raw, sign) => {
          expect(Buffer.isBuffer(raw)).toBe(true);
          expect(String(raw)).toBe('{"fixture":true}');
          expect(sign).toBe("fixture-signature");
          return { status: 200, body: label };
        },
      );
      vi.spyOn(billing, "result").mockImplementation(async (token) => {
        expect(token).toBe(`proof-${label}`);
        return { state: "unknown", nextAction: null, emailStatus: null };
      });
      await app.listen(0, "127.0.0.1");
    }
    // Configure both before requesting either, detecting shared global binding.
    for (const [index, label] of ["first", "second"].entries()) {
      const base = `http://127.0.0.1:${(apps[index].getHttpServer().address() as AddressInfo).port}`;
      const client = createTRPCProxyClient<AppRouter>({
        links: [httpLink({ url: base + "/api/trpc", transformer: superjson })],
      });
      expect(
        await client.club.createCheckout.mutate({
          email: "guest@example.test",
          contactPhone: "+79991234567",
        }),
      ).toEqual({
        url: `https://testpage1.payform.ru/?order_id=${label}`,
        user: null,
      });
      const webhook = await fetch(base + "/api/prodamus/test/webhook", {
        method: "POST",
        body: '{"fixture":true}',
        headers: {
          "Content-Type": "application/json",
          Sign: "fixture-signature",
        },
      });
      expect(webhook.status).toBe(200);
      expect(await webhook.text()).toBe(label);
      expect(webhook.headers.get("set-cookie")).toBeNull();
      const result = await fetch(base + "/api/prodamus/test/result", {
        method: "POST",
        body: JSON.stringify({ token: `proof-${label}` }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `83be933e-a277-41f3-801d-45771c12b05${index}`,
        },
      });
      expect(result.status).toBe(200);
      expect(await result.json()).toEqual({
        state: "unknown",
        nextAction: null,
        emailStatus: null,
      });
      expect(result.headers.get("cache-control")).toBe("no-store");
      expect(result.headers.get("set-cookie")).toBeNull();
    }
  } finally {
    await Promise.all(apps.map((app) => app.close()));
  }
});
