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
import * as capabilities from "../apps/backend/src/launch/capabilities";
import * as rateLimit from "../apps/backend/src/_core/request-rate-limit";

// Native HTTP/authorization plus explicit composition callers; session lookup
// and the selected provider or persistence boundary are doubled. No JWT/SQL or
// real device/provider-delivery acceptance. Capability/quota admission is tested
// separately in push-registration-security; these cases isolate composition.
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
    phone: null, contactPhone: null,
    passwordHash: null,
    sessionVersion: 0, profileRevision: 0,
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
  const pushActor = expect.objectContaining({
    id: member.id,
    openId: member.openId,
    sessionVersion: member.sessionVersion,
  });
  const client = () =>
    /* Создаёт настоящий локальный tRPC-клиент для проверки Nest-композиции уведомлений. */ createTRPCProxyClient<AppRouter>({
      links: [httpLink({ url: base + "/api/trpc", transformer: superjson })],
    });
  const operations = [
    {
      name: "registerToken",
      method: "registerToken" as const,
      helper: "registerPushToken" as const,
      run: () =>
        /* Вызывает регистрацию синтетического push-токена. */ client().notifications.registerToken.mutate({
          token: "ExpoPushToken[synthetic-token]",
        }),
      want: { success: true },
    },
    {
      name: "marketingConsent",
      method: "marketingConsent" as const,
      helper: "hasMarketingPushConsent" as const,
      run: () => /* Читает согласие на маркетинговые уведомления. */ client().notifications.marketingConsent.query(),
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
        /* Отзывает согласие через серверную процедуру. */ client().notifications.setMarketingConsent.mutate({ enabled: false }),
      want: { success: true, enabled: false },
    },
    {
      name: "purgeUserPushData",
      method: "purgeUserPushData" as const,
      helper: "deletePushTokensForUser" as const,
      run: () => /* Вызывает административную очистку токенов выбранного пользователя. */ client().admin.purgeUserPushData.mutate({ userId: 9601 }),
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
  // Capability и квоты здесь намеренно допускают запрос: этот набор проверяет композицию сервисов, права actor и persistence; admission покрыт отдельным набором.
  beforeEach(() => {
    vi.spyOn(capabilities, "requireCapability").mockImplementation(() => {});
    vi.spyOn(rateLimit, "checkRequestRateLimit").mockResolvedValue({ ok: true });
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
      contactPhone: null,
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
      // Сценарий: Latest-ответ определяется фактически внедрённым ContentReadService.

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
          // Возвращает заданный latest-результат внедрённого сервиса, фиксируя переданного пользователя.

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
      // Сценарий: Доменный отказ фактически внедрённого latest-провайдера сохраняется через HTTP.

      const descriptor = Object.getOwnPropertyDescriptor(
        content,
        "latestNotification",
      );
      Object.defineProperty(content, "latestNotification", {
        configurable: true,
        value: async () => {
          // Отказывает внедрённому latest-чтению доменным CONFLICT.

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
        // Сценарий: Роль, блокировка и подписка определяют видимость клубного анонса и порядок чтений.

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
      // Сценарий: Отсутствующие публикации используют nullish-defaults, сохраняя даже нулевой ID и пустой текст.

      actor = { ...member, role: "admin" };
      vi.spyOn(db, "getLatestPublishedPost").mockImplementation(
        async (target) => (target === "feed" ? fixture.feed : fixture.club),
      );
      expect(await client().notifications.latest.query()).toEqual(fixture.want);
    });

    it("keeps empty content defaults without a database", async () => {
      // Сценарий: Существующий контракт без БД сохраняет пустые latest-значения.

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
        // Сценарий: Сбой feed/subscription/club не возвращает частичный закрытый текст или SQL-детали.

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
      argument: [{ token: "ExpoPushToken[synthetic-token]" }, pushActor],
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
      argument: [pushActor, { enabled: false }],
    },
    {
      name: "purgeUserPushData",
      want: { success: false },
      argument: [9601, pushActor],
    },
  ])(
    "$name uses the supplied notification service, not hidden/global state",
    async ({ name, want, argument }) => {
      // Сценарий: Явно переданный сервис уведомлений получает actor и определяет результат без скрытого глобального состояния.

      let received: unknown;
      const unexpected = async () => {
        // Падает при обходном вызове не выбранной операции уведомлений.

        throw new Error("unexpected notification operation");
      };
      const notifications = {
        registerToken: unexpected,
        marketingConsent: unexpected,
        setMarketingConsent: unexpected,
        purgeUserPushData: unexpected,
        [name]: async (...args: unknown[]) => {
          // Фиксирует аргументы выбранной операции и возвращает предписанный результат сервиса.

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
          /* Вызывает регистрацию токена через явно собранный tRPC-контекст. */ caller.notifications.registerToken({
            token: "ExpoPushToken[synthetic-token]",
          }),
        marketingConsent: () => /* Вызывает чтение согласия через явно собранный tRPC-контекст. */ caller.notifications.marketingConsent(),
        setMarketingConsent: () =>
          /* Вызывает изменение согласия через явно собранный tRPC-контекст. */ caller.notifications.setMarketingConsent({ enabled: false }),
        purgeUserPushData: () =>
          /* Вызывает очистку токенов через явно собранный tRPC-контекст. */ caller.admin.purgeUserPushData({ userId: 9601 }),
      };
      expect(await results[name as keyof typeof results]()).toEqual(want);
      expect(received).toEqual(argument);
    },
  );

  it.each(operations)(
    "$name preserves a native service refusal",
    async ({ method, run }) => {
      // Сценарий: Отказ фактического Nest-сервиса не теряется в HTTP-адаптере.

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
      input: { token: "ExpoPushToken[synthetic-guest-token]" },
      want: ["ExpoPushToken[synthetic-guest-token]", undefined, undefined],
    },
    {
      name: "member",
      authenticated: true,
      input: {
        token: "ExpoPushToken[synthetic-member-token]",
        platform: "web",
        userId: 123,
      },
      want: ["ExpoPushToken[synthetic-member-token]", pushActor, "web"],
    },
  ])(
    "registers a $name device using session ownership, not client ownership",
    async ({ authenticated, input, want }) => {
      // Сценарий: Собственность push-токена берётся из сессии, не из клиентского userId; capability/quota здесь отдельно подменены.

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
      // Сценарий: Маркетинговое согласие читается только для actor.

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
        pushActor,
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
        pushActor,
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
      // Сценарий: Событие согласия получает серверные actor, версию и текст, игнорируя клиентскую подмену.

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
    // Сценарий: Администратор удаляет токены выбранного пользователя, а не собственные.

    actor = { ...member, role: "admin" };
    let received: unknown;
    vi.spyOn(db, "deletePushTokensForUser").mockImplementation(
      async (...args) => {
        received = args;
      },
    );
    expect(
      await client().admin.purgeUserPushData.mutate({ userId: 9601 }),
    ).toEqual({ success: true });
    expect(received).toEqual([9601, pushActor]);
  });

  it("keeps marketing disabled by default when no database is available", async () => {
    // Сценарий: При отсутствии БД маркетинговое согласие остаётся выключенным по умолчанию.

    expect(await operations[1].run()).toEqual(operations[1].want);
  });

  it.each([
    { name: "guest token registration", user: null, run: operations[0].run },
    { name: "member token registration", user: member, run: operations[0].run },
    {
      name: "consent grant",
      user: member,
      run: () =>
        /* Отправляет положительное согласие для проверки отказа записи без БД. */ client().notifications.setMarketingConsent.mutate({ enabled: true }),
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
      // Сценарий: Записи регистрации, согласия и очистки без БД не сообщают успех.

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
      // Сценарий: Ошибки persistence не превращаются в успешные ответы.

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
      run: () => /* Передаёт пустой push-токен для проверки входной схемы. */ client().notifications.registerToken.mutate({ token: "" }),
    },
    {
      name: "nonboolean consent",
      run: () =>
        /* Передаёт строку вместо boolean согласия. */ client().notifications.setMarketingConsent.mutate({
          enabled: "yes" as unknown as boolean,
        }),
    },
    {
      name: "nonnumeric purge ID",
      run: () =>
        /* Передаёт строковый userId вместо числового ID очистки. */ client().admin.purgeUserPushData.mutate({
          userId: "9601" as unknown as number,
        }),
    },
  ])("rejects $name before persistence", async ({ run }) => {
    // Сценарий: Неверные token/boolean/userId отклоняются до persistence.

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
    // Сценарий: Оба действия согласия закрыты гостю и заблокированному пользователю до чтения/записи.

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
      // Сценарий: Очистка токенов доступна только незаблокированному администратору.

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
