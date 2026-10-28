import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import { TRPCError } from "@trpc/server";
import { createAppRouter } from "../apps/backend/src/routers";
import { ContentReadService } from "../apps/backend/src/content/content-read.service";
import { ContentWriteService } from "../apps/backend/src/content/content-write.service";
import { ContentCommentService } from "../apps/backend/src/content/content-comment.service";
import { ContentUploadService } from "../apps/backend/src/content/content-upload.service";
import { ClubCheckoutService } from "../apps/backend/src/billing/club-checkout.service";
import { ClubSubscriptionService } from "../apps/backend/src/billing/club-subscription.service";
import { NotificationsService } from "../apps/backend/src/notifications/notifications.service";
import { ProfileService } from "../apps/backend/src/profile/profile.service";
import { ModerationService } from "../apps/backend/src/moderation/moderation.service";
import * as capabilities from "../apps/backend/src/launch/capabilities";
import type { TrpcContext } from "../apps/backend/src/_core/context";
import type { User } from "../packages/database/src/schema";
import type { AppRouter } from "../apps/backend/src/routers";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { ShopService } from "../apps/backend/src/shop/shop.service";
import { SessionService } from "../apps/backend/src/identity/session.service";
import * as db from "../apps/backend/src/db";

const buyer: User = {
  id: 7,
  openId: "shop-composition-fixture",
  email: "buyer@example.test",
  name: null,
  phone: null,
  passwordHash: null,
  sessionVersion: 0, profileRevision: 0,
  loginMethod: "email",
  gender: null,
  avatarUrl: null,
  role: "user",
  blockedAt: null,
  blockedReason: null,
  accountDeletionRequestedAt: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  lastSignedIn: new Date(0),
};

beforeEach(() => vi.stubEnv("DATABASE_URL", ""));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function caller(actor: User | null = buyer) {
  const refusal = async (user: User | null, productId: string) => {
    expect(user?.id).toBe(7);
    expect(productId).toBe("digital-1");
    throw new TRPCError({ code: "CONFLICT", message: "supplied shop refusal" });
  };
  const billing = {
    checkout: new ClubCheckoutService(),
    subscriptions: new ClubSubscriptionService(),
    shop: { owned: refusal, createCheckout: refusal },
  };
  return createAppRouter(
    new ContentReadService(),
    new ContentWriteService(),
    new ContentCommentService(),
    new ContentUploadService(),
    billing,
    new NotificationsService(),
    new ProfileService(),
    new ModerationService(),
  ).createCaller({ user: actor, req: {}, res: {} } as TrpcContext);
}

it.each(["owned", "createCheckout"] as const)(
  "root composition honors the supplied shop %s service",
  async (method) => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("PUBLIC_APP_URL", "");
    // Exercise dormant checkout wiring, not a runtime capability change.
    vi.spyOn(capabilities, "requireCapability").mockImplementation(() => {});
    await expect(
      caller().shop[method]({ productId: "digital-1" }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "supplied shop refusal",
    });
  },
);

it("disabled shop checkout refuses before entering the supplied service", async () => {
  await expect(
    caller().shop.createCheckout({ productId: "digital-1" }),
  ).rejects.toMatchObject({
    code: "FORBIDDEN",
    message: "Функция пока недоступна",
  });
});
it.each([
  { name: "guest", actor: null, code: "UNAUTHORIZED" },
  {
    name: "blocked",
    actor: { ...buyer, blockedAt: new Date(0) },
    code: "FORBIDDEN",
  },
])("$name cannot reach shop checkout", async ({ actor, code }) => {
  vi.spyOn(capabilities, "requireCapability").mockImplementation(() => {});
  await expect(
    caller(actor).shop.createCheckout({ productId: "digital-1" }),
  ).rejects.toMatchObject({ code });
});

describe("shop service over native HTTP", () => {
  let application: INestApplication;
  let base: string;
  let shop: ShopService;
  let sessions: SessionService;
  const client = () =>
    createTRPCProxyClient<AppRouter>({
      links: [httpLink({ url: base + "/api/trpc", transformer: superjson })],
    });
  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", "");
    application = await createBackendApplication();
    shop = application.get(ShopService);
    sessions = application.get(SessionService);
    await application.listen(0, "127.0.0.1");
    base = `http://127.0.0.1:${(application.getHttpServer().address() as AddressInfo).port}`;
  });
  beforeEach(() => vi.spyOn(sessions, "optionalUser").mockResolvedValue(buyer));
  afterAll(async () => application?.close());

  it("ownership HTTP uses the application-scoped shop service", async () => {
    vi.spyOn(shop, "owned").mockImplementation(async (actor, productId) => {
      expect(actor?.id).toBe(7);
      expect(productId).toBe("digital-1");
      return { owned: true };
    });
    expect(await client().shop.owned.query({ productId: "digital-1" })).toEqual(
      { owned: true },
    );
  });
  it("dormant checkout HTTP uses the same shop service and session actor", async () => {
    vi.spyOn(capabilities, "requireCapability").mockImplementation(() => {});
    vi.spyOn(shop, "createCheckout").mockImplementation(
      async (actor, productId) => {
        expect(actor.id).toBe(7);
        expect(actor.email).toBe("buyer@example.test");
        expect(productId).toBe("digital-1");
        return { url: "https://fixture.payform.ru/?order_id=nest-shop" };
      },
    );
    expect(
      await client().shop.createCheckout.mutate({ productId: "digital-1" }),
    ).toEqual({
      url: "https://fixture.payform.ru/?order_id=nest-shop",
    });
  });
  it("native checkout stays disabled before provider work", async () => {
    vi.spyOn(shop, "createCheckout").mockImplementation(async () => {
      throw new Error("capability bypass");
    });
    await expect(
      client().shop.createCheckout.mutate({ productId: "digital-1" }),
    ).rejects.toMatchObject({ data: { code: "FORBIDDEN", httpStatus: 403 } });
  });
  it.each([
    { name: "guest", actor: null, code: "UNAUTHORIZED", httpStatus: 401 },
    {
      name: "blocked",
      actor: { ...buyer, blockedAt: new Date(0) },
      code: "FORBIDDEN",
      httpStatus: 403,
    },
  ])(
    "native $name checkout remains protected",
    async ({ actor, code, httpStatus }) => {
      vi.spyOn(sessions, "optionalUser").mockResolvedValue(actor);
      vi.spyOn(capabilities, "requireCapability").mockImplementation(() => {});
      vi.spyOn(shop, "createCheckout").mockImplementation(async () => {
        throw new Error("authorization bypass");
      });
      await expect(
        client().shop.createCheckout.mutate({ productId: "digital-1" }),
      ).rejects.toMatchObject({ data: { code, httpStatus } });
    },
  );
  it("guest ownership is false without accessing SQL", async () => {
    vi.spyOn(sessions, "optionalUser").mockResolvedValue(null);
    vi.spyOn(db, "userOwnsShopProduct").mockImplementation(async () => {
      throw new Error("guest SQL access");
    });
    expect(await client().shop.owned.query({ productId: "digital-1" })).toEqual(
      { owned: false },
    );
  });
  it("ownership lookup preserves session user ID and product", async () => {
    vi.spyOn(db, "userOwnsShopProduct").mockImplementation(
      async (userId, productId) => {
        expect(userId).toBe(7);
        expect(productId).toBe("digital-1");
        return true;
      },
    );
    expect(await client().shop.owned.query({ productId: "digital-1" })).toEqual(
      { owned: true },
    );
  });
  it("ownership SQL failure is not exposed as false success or a private error", async () => {
    vi.spyOn(db, "userOwnsShopProduct").mockRejectedValue(
      new Error("PRIVATE_SHOP_SQL_FAILURE"),
    );
    await expect(
      client().shop.owned.query({ productId: "digital-1" }),
    ).rejects.toMatchObject({
      data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
      message: "Внутренняя ошибка сервера",
    });
  });
  it.each(["owned", "createCheckout"] as const)(
    "native %s rejects malformed product input first",
    async (method) => {
      vi.spyOn(capabilities, "requireCapability").mockImplementation(() => {});
      vi.spyOn(shop, method).mockImplementation(async () => {
        throw new Error("validation bypass");
      });
      const input = { productId: 7 as unknown as string };
      await expect(
        method === "owned"
          ? client().shop.owned.query(input)
          : client().shop.createCheckout.mutate(input),
      ).rejects.toMatchObject({
        data: { code: "BAD_REQUEST", httpStatus: 400 },
      });
    },
  );
});
