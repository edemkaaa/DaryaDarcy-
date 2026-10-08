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
import type { ClubPayment, User } from "../packages/database/src/schema";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { SessionService } from "../apps/backend/src/identity/session.service";
import type { AppRouter } from "../apps/backend/src/routers";
import * as db from "../apps/backend/src/db";
import { TrpcService } from "../apps/backend/src/_core/trpc.service";
import { ContentReadService } from "../apps/backend/src/content/content-read.service";
import { ContentWriteService } from "../apps/backend/src/content/content-write.service";
import { ContentCommentService } from "../apps/backend/src/content/content-comment.service";
import { ContentUploadService } from "../apps/backend/src/content/content-upload.service";
import { ClubCheckoutService } from "../apps/backend/src/billing/club-checkout.service";
import { ClubSubscriptionService } from "../apps/backend/src/billing/club-subscription.service";
import type { TrpcContext } from "../apps/backend/src/_core/context";
import { NotificationsService } from "../apps/backend/src/notifications/notifications.service";
import { TRPCError } from "@trpc/server";
import { ProfileService } from "../apps/backend/src/profile/profile.service";
import { ModerationService } from "../apps/backend/src/moderation/moderation.service";
import { ShopService } from "../apps/backend/src/shop/shop.service";

// Native HTTP/authorization plus explicit composition callers; session lookup
// and the selected provider or persistence boundary are doubled. No JWT/SQL or
// real device/provider-delivery acceptance.
describe("notifications over native HTTP", () => {
  let application: INestApplication;
  let sessions: SessionService;
  let notificationsService: NotificationsService;
  let content: ContentReadService;
  let base: string;
  let actor: User | null;
  const member: User = {
    id: 9600,
    openId: "synthetic-notifications-member",
    role: "user",
    name: null,
    email: null,
    phone: null,
    passwordHash: null,
    sessionVersion: 0,
    loginMethod: null,
    gender: null,
    avatarUrl: null,
    blockedAt: null,
    blockedReason: null,
    accountDeletionRequestedAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    lastSignedIn: new Date(0),
  };
  const client = () =>
    createTRPCProxyClient<AppRouter>({
      links: [httpLink({ url: base + "/api/trpc", transformer: superjson })],
    });
  const operations = [
    {
      name: "registerToken",
      method: "registerToken" as const,
      helper: "registerPushToken" as const,
      run: () =>
        client().notifications.registerToken.mutate({
          token: "synthetic-token",
        }),
      want: { success: true },
    },
    {
      name: "marketingConsent",
      method: "marketingConsent" as const,
      helper: "hasMarketingPushConsent" as const,
      run: () => client().notifications.marketingConsent.query(),
      want: {
        enabled: false,
        label:
          "Получать новости, новые публикации, акции и предложения DARYADARCY",
        version: "2026-08-1",
      },
    },
    {
      name: "setMarketingConsent",
      method: "setMarketingConsent" as const,
      helper: "logPushConsentEvent" as const,
      run: () =>
        client().notifications.setMarketingConsent.mutate({ enabled: false }),
      want: { success: true, enabled: false },
    },
    {
      name: "purgeUserPushData",
      method: "purgeUserPushData" as const,
      helper: "deletePushTokensForUser" as const,
      run: () => client().admin.purgeUserPushData.mutate({ userId: 9601 }),
      want: { success: true },
    },
  ];
  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", "");
    application = await createBackendApplication();
    sessions = application.get(SessionService);
    notificationsService = application.get(NotificationsService);
    content = application.get(ContentReadService);
    await application.listen(0, "127.0.0.1");
    base = `http://127.0.0.1:${(application.getHttpServer().address() as AddressInfo).port}`;
  });
  beforeEach(() => {
    actor = { ...member };
    vi.spyOn(sessions, "optionalUser").mockImplementation(async () => actor);
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await application?.close();
    vi.unstubAllEnvs();
  });

  describe("latest publication visibility", () => {
    const feed = { id: 9701, text: "synthetic public announcement" };
    const club = { id: 9702, text: "synthetic private announcement" };
    const active: ClubPayment = {
      id: 9703,
      userId: member.id,
      orderId: "synthetic-latest-subscription",
      email: null,
      sum: null,
      status: "paid",
      paidAt: new Date(0),
      expiresAt: new Date("2099-01-01T00:00:00Z"),
      cancelAtPeriodEnd: false,
      cancelledAt: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };

    it("uses the actual injected content provider's latest outcome", async () => {
      let received: unknown;
      const want = {
        feedId: 9801,
        feedText: "synthetic supplied feed",
        clubId: null,
        clubText: "",
      };
      const descriptor = Object.getOwnPropertyDescriptor(
        content,
        "latestNotification",
      );
      // The pre-migration adapter ignores this method, so RED is a response
      // mismatch through native HTTP, not a missing-method/import failure.
      Object.defineProperty(content, "latestNotification", {
        configurable: true,
        value: async (user: User | null) => {
          received = user;
          return want;
        },
      });
      try {
        expect(await client().notifications.latest.query()).toEqual(want);
        expect(received).toEqual(member);
      } finally {
        if (descriptor)
          Object.defineProperty(content, "latestNotification", descriptor);
        else Reflect.deleteProperty(content, "latestNotification");
      }
    });

    it("preserves the actual injected content provider's latest refusal", async () => {
      const descriptor = Object.getOwnPropertyDescriptor(
        content,
        "latestNotification",
      );
      Object.defineProperty(content, "latestNotification", {
        configurable: true,
        value: async () => {
          throw new TRPCError({
            code: "CONFLICT",
            message: "synthetic latest refusal",
          });
        },
      });
      try {
        await expect(
          client().notifications.latest.query(),
        ).rejects.toMatchObject({
          message: "synthetic latest refusal",
          data: { code: "CONFLICT", httpStatus: 409 },
        });
      } finally {
        if (descriptor)
          Object.defineProperty(content, "latestNotification", descriptor);
        else Reflect.deleteProperty(content, "latestNotification");
      }
    });

    it.each([
      {
        name: "guest",
        user: null,
        subscribed: true,
        order: ["feed"],
        allowed: false,
      },
      {
        name: "unpaid member",
        user: member,
        subscribed: false,
        order: ["feed", "subscription:9600"],
        allowed: false,
      },
      {
        name: "paid member",
        user: member,
        subscribed: true,
        order: ["feed", "subscription:9600", "club"],
        allowed: true,
      },
      {
        name: "admin",
        user: { ...member, role: "admin" as const },
        subscribed: false,
        order: ["feed", "club"],
        allowed: true,
      },
      {
        name: "moderator",
        user: { ...member, role: "moderator" as const },
        subscribed: false,
        order: ["feed", "club"],
        allowed: true,
      },
      {
        name: "blocked paid member",
        user: { ...member, blockedAt: new Date(0) },
        subscribed: true,
        order: ["feed"],
        allowed: false,
      },
      {
        name: "blocked admin",
        user: { ...member, role: "admin" as const, blockedAt: new Date(0) },
        subscribed: true,
        order: ["feed"],
        allowed: false,
      },
      {
        name: "blocked moderator",
        user: { ...member, role: "moderator" as const, blockedAt: new Date(0) },
        subscribed: true,
        order: ["feed"],
        allowed: false,
      },
    ])(
      "keeps public/club boundaries and read ordering for $name",
      async (fixture) => {
        actor = fixture.user;
        const reads: string[] = [];
        vi.spyOn(db, "getLatestPublishedPost").mockImplementation(
          async (target) => {
            reads.push(target);
            return target === "feed" ? feed : club;
          },
        );
        vi.spyOn(db, "getActiveClubSubscription").mockImplementation(
          async (id) => {
            reads.push(`subscription:${id}`);
            return fixture.subscribed ? active : undefined;
          },
        );
        expect(await client().notifications.latest.query()).toEqual({
          feedId: feed.id,
          feedText: feed.text,
          clubId: fixture.allowed ? club.id : null,
          clubText: fixture.allowed ? club.text : "",
        });
        expect(reads).toEqual(fixture.order);
      },
    );

    it.each([
      {
        name: "both missing",
        feed: undefined,
        club: undefined,
        want: { feedId: null, feedText: "", clubId: null, clubText: "" },
      },
      {
        name: "feed missing",
        feed: undefined,
        club,
        want: {
          feedId: null,
          feedText: "",
          clubId: club.id,
          clubText: club.text,
        },
      },
      {
        name: "club missing",
        feed,
        club: undefined,
        want: {
          feedId: feed.id,
          feedText: feed.text,
          clubId: null,
          clubText: "",
        },
      },
      {
        name: "zero IDs and empty text",
        feed: { id: 0, text: "" },
        club: { id: 0, text: "" },
        want: { feedId: 0, feedText: "", clubId: 0, clubText: "" },
      },
    ])("preserves nullish defaults: $name", async (fixture) => {
      actor = { ...member, role: "admin" };
      vi.spyOn(db, "getLatestPublishedPost").mockImplementation(
        async (target) => (target === "feed" ? fixture.feed : fixture.club),
      );
      expect(await client().notifications.latest.query()).toEqual(fixture.want);
    });

    it("keeps empty content defaults without a database", async () => {
      expect(await client().notifications.latest.query()).toEqual({
        feedId: null,
        feedText: "",
        clubId: null,
        clubText: "",
      });
    });

    it.each(["feed", "subscription", "club"] as const)(
      "fails safely on a %s read without partial content",
      async (failure) => {
        const reads: string[] = [];
        vi.spyOn(db, "getLatestPublishedPost").mockImplementation(
          async (target) => {
            reads.push(target);
            if (target === failure)
              throw new Error("synthetic private database detail");
            return target === "feed" ? feed : club;
          },
        );
        vi.spyOn(db, "getActiveClubSubscription").mockImplementation(
          async () => {
            reads.push("subscription");
            if (failure === "subscription")
              throw new Error("synthetic private database detail");
            return active;
          },
        );
        const response = await fetch(base + "/api/trpc/notifications.latest");
        expect(response.status).toBe(500);
        const body = await response.text();
        expect(body).toContain("Внутренняя ошибка сервера");
        expect(body).not.toContain("synthetic private database detail");
        expect(body).not.toContain(feed.text);
        expect(body).not.toContain(club.text);
        expect(body).not.toContain('"stack"');
        expect(reads).toEqual(
          failure === "feed"
            ? ["feed"]
            : failure === "subscription"
              ? ["feed", "subscription"]
              : ["feed", "subscription", "club"],
        );
      },
    );
  });

  it.each([
    {
      name: "registerToken",
      want: { success: false },
      argument: [{ token: "synthetic-token" }, 9600],
    },
    {
      name: "marketingConsent",
      want: {
        enabled: true,
        label: "synthetic supplied label",
        version: "synthetic supplied version",
      },
      argument: [9600],
    },
    {
      name: "setMarketingConsent",
      want: { success: false, enabled: true },
      argument: [9600, { enabled: false }],
    },
    { name: "purgeUserPushData", want: { success: false }, argument: [9601] },
  ])(
    "$name uses the supplied notification service, not hidden/global state",
    async ({ name, want, argument }) => {
      let received: unknown;
      const unexpected = async () => {
        throw new Error("unexpected notification operation");
      };
      const notifications = {
        registerToken: unexpected,
        marketingConsent: unexpected,
        setMarketingConsent: unexpected,
        purgeUserPushData: unexpected,
        [name]: async (...args: unknown[]) => {
          received = args;
          return want;
        },
      };
      // Extra constructor dependency is ignored by the old code: RED exercises
      // real composition behavior rather than a missing class/method import.
      const composed: TrpcService = Reflect.construct(TrpcService, [
        application.get(ContentReadService),
        application.get(ContentWriteService),
        application.get(ContentCommentService),
        application.get(ContentUploadService),
        application.get(ClubCheckoutService),
        application.get(ClubSubscriptionService),
        sessions,
        notifications,
        application.get(ProfileService),
        application.get(ModerationService),
        application.get(ShopService),
      ]);
      const caller = composed.router.createCaller({
        user: { ...member, role: "admin" },
        req: {},
        res: {},
      } as TrpcContext);
      const results = {
        registerToken: () =>
          caller.notifications.registerToken({ token: "synthetic-token" }),
        marketingConsent: () => caller.notifications.marketingConsent(),
        setMarketingConsent: () =>
          caller.notifications.setMarketingConsent({ enabled: false }),
        purgeUserPushData: () =>
          caller.admin.purgeUserPushData({ userId: 9601 }),
      };
      expect(await results[name as keyof typeof results]()).toEqual(want);
      expect(received).toEqual(argument);
    },
  );

  it.each(operations)(
    "$name preserves a native service refusal",
    async ({ method, run }) => {
      actor = { ...member, role: "admin" };
      vi.spyOn(notificationsService, method).mockRejectedValue(
        new TRPCError({
          code: "CONFLICT",
          message: "synthetic notification refusal",
        }),
      );
      await expect(run()).rejects.toMatchObject({
        message: "synthetic notification refusal",
        data: { code: "CONFLICT", httpStatus: 409 },
      });
    },
  );

  it.each([
    {
      name: "guest",
      authenticated: false,
      input: { token: "synthetic-guest-token" },
      want: ["synthetic-guest-token", undefined, undefined],
    },
    {
      name: "member",
      authenticated: true,
      input: {
        token: "  synthetic-member-token  ",
        platform: "web",
        userId: 123,
      },
      want: ["  synthetic-member-token  ", 9600, "web"],
    },
  ])(
    "registers a $name device using session ownership, not client ownership",
    async ({ authenticated, input, want }) => {
      actor = authenticated ? { ...member } : null;
      let received: unknown;
      vi.spyOn(db, "registerPushToken").mockImplementation(async (...args) => {
        received = args;
      });
      expect(await client().notifications.registerToken.mutate(input)).toEqual({
        success: true,
      });
      expect(received).toEqual(want);
    },
  );

  it.each([true, false])(
    "reads the actor's marketing consent (%s)",
    async (enabled) => {
      let received: unknown;
      vi.spyOn(db, "hasMarketingPushConsent").mockImplementation(async (id) => {
        received = id;
        return enabled;
      });
      expect(await client().notifications.marketingConsent.query()).toEqual({
        enabled,
        label:
          "Получать новости, новые публикации, акции и предложения DARYADARCY",
        version: "2026-08-1",
      });
      expect(received).toBe(9600);
    },
  );

  it.each([
    {
      input: {
        enabled: true,
        platform: "ios",
        userId: 123,
        version: "client-version",
      },
      want: [
        9600,
        "marketing",
        "granted",
        "ios",
        "2026-08-1",
        "Получать новости, новые публикации, акции и предложения DARYADARCY",
      ],
    },
    {
      input: { enabled: false },
      want: [
        9600,
        "marketing",
        "revoked",
        undefined,
        "2026-08-1",
        "Получать новости, новые публикации, акции и предложения DARYADARCY",
      ],
    },
  ])(
    "appends the matching consent event with server-owned actor and legal copy (%#)",
    async ({ input, want }) => {
      let received: unknown;
      vi.spyOn(db, "logPushConsentEvent").mockImplementation(
        async (...args) => {
          received = args;
        },
      );
      expect(
        await client().notifications.setMarketingConsent.mutate(input),
      ).toEqual({ success: true, enabled: input.enabled });
      expect(received).toEqual(want);
    },
  );

  it("purges the requested user's tokens, not the administrator's tokens", async () => {
    actor = { ...member, role: "admin" };
    let received: unknown;
    vi.spyOn(db, "deletePushTokensForUser").mockImplementation(async (id) => {
      received = id;
    });
    expect(
      await client().admin.purgeUserPushData.mutate({ userId: 9601 }),
    ).toEqual({ success: true });
    expect(received).toBe(9601);
  });

  it("keeps marketing disabled by default when no database is available", async () => {
    expect(await operations[1].run()).toEqual(operations[1].want);
  });

  it.each([
    { name: "guest token registration", user: null, run: operations[0].run },
    { name: "member token registration", user: member, run: operations[0].run },
    {
      name: "consent grant",
      user: member,
      run: () =>
        client().notifications.setMarketingConsent.mutate({ enabled: true }),
    },
    { name: "consent revocation", user: member, run: operations[2].run },
    {
      name: "administrator token purge",
      user: { ...member, role: "admin" as const },
      run: operations[3].run,
    },
  ])(
    "rejects $name instead of reporting success when no database is available",
    async ({ user, run }) => {
      actor = user;
      await expect(run()).rejects.toMatchObject({
        message: "Внутренняя ошибка сервера",
        data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
      });
    },
  );

  it.each(operations)(
    "does not turn a $name persistence failure into success",
    async ({ helper, run }) => {
      actor = { ...member, role: "admin" };
      vi.spyOn(db, helper).mockRejectedValue(
        new Error("synthetic private persistence error"),
      );
      await expect(run()).rejects.toMatchObject({
        message: "Внутренняя ошибка сервера",
        data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
      });
    },
  );

  it.each([
    {
      name: "empty token",
      run: () => client().notifications.registerToken.mutate({ token: "" }),
    },
    {
      name: "nonboolean consent",
      run: () =>
        client().notifications.setMarketingConsent.mutate({
          enabled: "yes" as unknown as boolean,
        }),
    },
    {
      name: "nonnumeric purge ID",
      run: () =>
        client().admin.purgeUserPushData.mutate({
          userId: "9601" as unknown as number,
        }),
    },
  ])("rejects $name before persistence", async ({ run }) => {
    actor = { ...member, role: "admin" };
    const effects: string[] = [];
    vi.spyOn(db, "registerPushToken").mockImplementation(async () => {
      effects.push("register");
    });
    vi.spyOn(db, "logPushConsentEvent").mockImplementation(async () => {
      effects.push("consent");
    });
    vi.spyOn(db, "deletePushTokensForUser").mockImplementation(async () => {
      effects.push("purge");
    });
    await expect(run()).rejects.toMatchObject({
      data: { code: "BAD_REQUEST", httpStatus: 400 },
    });
    expect(effects).toEqual([]);
  });

  it.each([
    { access: "guest", actor: null, code: "UNAUTHORIZED", httpStatus: 401 },
    {
      access: "blocked member",
      actor: { ...member, blockedAt: new Date(0) },
      code: "FORBIDDEN",
      httpStatus: 403,
    },
  ])("refuses both consent operations for $access", async (fixture) => {
    actor = fixture.actor;
    const effects: string[] = [];
    vi.spyOn(db, "hasMarketingPushConsent").mockImplementation(async () => {
      effects.push("read");
      return false;
    });
    vi.spyOn(db, "logPushConsentEvent").mockImplementation(async () => {
      effects.push("write");
    });
    for (const run of [
      () => client().notifications.marketingConsent.query(),
      () =>
        client().notifications.setMarketingConsent.mutate({ enabled: true }),
    ]) {
      await expect(run()).rejects.toMatchObject({
        data: { code: fixture.code, httpStatus: fixture.httpStatus },
      });
    }
    expect(effects).toEqual([]);
  });

  it.each(["guest", "user", "moderator", "blocked-admin"] as const)(
    "refuses administrator token purge for %s",
    async (access) => {
      actor =
        access === "guest"
          ? null
          : {
              ...member,
              role: access === "blocked-admin" ? "admin" : access,
              blockedAt: access === "blocked-admin" ? new Date(0) : null,
            };
      const deleted: number[] = [];
      vi.spyOn(db, "deletePushTokensForUser").mockImplementation(async (id) => {
        deleted.push(id);
      });
      await expect(
        client().admin.purgeUserPushData.mutate({ userId: 9601 }),
      ).rejects.toMatchObject({
        data: {
          code: access === "guest" ? "UNAUTHORIZED" : "FORBIDDEN",
          httpStatus: access === "guest" ? 401 : 403,
        },
      });
      expect(deleted).toEqual([]);
    },
  );
});
