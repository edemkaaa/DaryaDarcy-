import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { ClubCheckoutService } from "../apps/backend/src/billing/club-checkout.service";
import type { AppRouter } from "../apps/backend/src/routers";
import { TRPCError } from "@trpc/server";

let application: INestApplication;
let base: string;
let checkout: ClubCheckoutService;
const client = () =>
  createTRPCProxyClient<AppRouter>({
    links: [httpLink({ url: base + "/api/trpc", transformer: superjson })],
  });

beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("PRODAMUS_SECRET", "");
  application = await createBackendApplication();
  checkout = application.get(ClubCheckoutService);
  await application.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${(application.getHttpServer().address() as AddressInfo).port}`;
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await application?.close();
  vi.unstubAllEnvs();
});

it("the live HTTP adapter uses its Nest-managed checkout provider", async () => {
  // Replacement is solely the billing boundary: real HTTP, tRPC and Zod remain.
  vi.spyOn(checkout, "createCheckout").mockImplementation(
    async (actor, input) => {
      expect(actor).toBeNull();
      expect(input).toEqual({
        email: "guest@example.test",
        plan: "semiannual",
      });
      return {
        url: "https://fixture.payform.ru/?order_id=nest-provider",
        user: null,
      };
    },
  );
  expect(
    await client().club.createCheckout.mutate({
      email: "guest@example.test",
      plan: "semiannual",
    }),
  ).toEqual({
    url: "https://fixture.payform.ru/?order_id=nest-provider",
    user: null,
  });
});

it("HTTP checkout validation rejects malformed input before provider work", async () => {
  vi.spyOn(checkout, "createCheckout").mockImplementation(async () => {
    throw new TRPCError({ code: "CONFLICT", message: "validation bypassed" });
  });
  await expect(
    client().club.createCheckout.mutate({ email: "invalid" }),
  ).rejects.toMatchObject({
    data: { code: "BAD_REQUEST", httpStatus: 400 },
  });
});

it("preserves checkout failure semantics over the real HTTP transport", async () => {
  vi.spyOn(checkout, "createCheckout").mockImplementation(async () => {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "synthetic billing refusal",
    });
  });
  await expect(
    client().club.createCheckout.mutate({ email: "guest@example.test" }),
  ).rejects.toMatchObject({
    data: { code: "FORBIDDEN", httpStatus: 403 },
    message: "synthetic billing refusal",
  });
});
