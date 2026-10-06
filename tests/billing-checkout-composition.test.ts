import { afterEach, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { createAppRouter } from "../apps/backend/src/routers";
import { ContentReadService } from "../apps/backend/src/content/content-read.service";
import { ContentWriteService } from "../apps/backend/src/content/content-write.service";
import { ContentCommentService } from "../apps/backend/src/content/content-comment.service";
import { ContentUploadService } from "../apps/backend/src/content/content-upload.service";
import type { TrpcContext } from "../apps/backend/src/_core/context";

afterEach(() => vi.unstubAllEnvs());

function caller(checkout: {
  createCheckout: (
    user: TrpcContext["user"],
    input?: { email?: string; plan?: "monthly" | "semiannual" },
  ) => Promise<{ url: string; user: null }>;
}) {
  return createAppRouter(
    new ContentReadService(),
    new ContentWriteService(),
    new ContentCommentService(),
    new ContentUploadService(),
    checkout,
  ).createCaller({ user: null, req: {}, res: {} } as TrpcContext);
}

it("routes checkout through the supplied service instead of global billing state", async () => {
  // A direct/global DB path fails here; the actual consumer result proves DI.
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("PRODAMUS_SECRET", "");
  const checkout = caller({
    async createCheckout(user, input) {
      expect(user).toBeNull();
      expect(input).toEqual({
        email: "guest@example.test",
        plan: "semiannual",
      });
      return {
        url: "https://fixture.payform.ru/?order_id=injected",
        user: null,
      };
    },
  });
  expect(
    await checkout.club.createCheckout({
      email: "guest@example.test",
      plan: "semiannual",
    }),
  ).toEqual({
    url: "https://fixture.payform.ru/?order_id=injected",
    user: null,
  });
});

it("preserves the service failure code at the checkout boundary", async () => {
  vi.stubEnv("DATABASE_URL", "");
  const checkout = caller({
    async createCheckout() {
      throw new TRPCError({
        code: "CONFLICT",
        message: "synthetic checkout rejection",
      });
    },
  });
  await expect(
    checkout.club.createCheckout({ email: "guest@example.test" }),
  ).rejects.toMatchObject({
    code: "CONFLICT",
    message: "synthetic checkout rejection",
  });
});

it("rejects malformed checkout input before entering the service", async () => {
  const checkout = caller({
    async createCheckout() {
      throw new Error("must not reach billing service");
    },
  });
  await expect(
    checkout.club.createCheckout({ email: "invalid" }),
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
});
