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
import type { User } from "../packages/database/src/schema";
import type { AppRouter } from "../apps/backend/src/routers";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { SessionService } from "../apps/backend/src/identity/session.service";
import * as comments from "../apps/backend/src/content/comments";
import * as platformDb from "../apps/backend/src/platform-db";
import { TRPCError } from "@trpc/server";
import { TrpcService } from "../apps/backend/src/_core/trpc.service";
import type { TrpcContext } from "../apps/backend/src/_core/context";
import { ContentReadService } from "../apps/backend/src/content/content-read.service";
import { ContentWriteService } from "../apps/backend/src/content/content-write.service";
import { ContentCommentService } from "../apps/backend/src/content/content-comment.service";
import { ContentUploadService } from "../apps/backend/src/content/content-upload.service";
import { ClubCheckoutService } from "../apps/backend/src/billing/club-checkout.service";
import { ClubSubscriptionService } from "../apps/backend/src/billing/club-subscription.service";
import { NotificationsService } from "../apps/backend/src/notifications/notifications.service";
import { ProfileService } from "../apps/backend/src/profile/profile.service";
import { ModerationService } from "../apps/backend/src/moderation/moderation.service";
import { ShopService } from "../apps/backend/src/shop/shop.service";

// Real HTTP/router schemas and authorization; identity and persistence doubled.
// No real JWT, SQL mutations or durable audit acceptance.
describe("moderation ID inputs over native HTTP", () => {
  let app: INestApplication;
  let base: string;
  let actor: User | null;
  let sessions: SessionService;
  let effects: unknown[];
  const moderator: User = {
    id: 9810,
    openId: "synthetic-moderation-actor",
    role: "moderator",
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
  const client = () =>
    /* Создаёт настоящий локальный tRPC-клиент с SuperJSON для проверки Nest-маршрутизации. */ createTRPCProxyClient<AppRouter>({
      links: [httpLink({ url: base + "/api/trpc", transformer: superjson })],
    });
  // Таблица операций отделяет проверяемый target от доверенного actor: одинаковые правила ID и ролей проверяются для удаления, жалоб и блокировок.
  const operations = [
    {
      name: "dismiss report",
      validId: 9811,
      run: (id: number) =>
        /* Передаёт выбранный ID процедуре отклонения жалобы. */ client().moderation.dismissCommentReport.mutate({ reportId: id }),
      want: [["dismiss", { id: 9810, sessionVersion: 0 }, 9811]],
    },
    {
      name: "delete comment without report",
      validId: 9811,
      run: (id: number) =>
        /* Передаёт выбранный ID удалению комментария без привязки к жалобе. */ client().moderation.deleteReportedComment.mutate({ commentId: id }),
      want: [["delete", { id: 9810, sessionVersion: 0 }, 9811]],
    },
    {
      name: "delete comment with report",
      validId: 9812,
      run: (id: number) =>
        /* Передаёт выбранный ID жалобы вместе с фиксированным комментарием. */ client().moderation.deleteReportedComment.mutate({
          commentId: 9811,
          reportId: id,
        }),
      want: [["delete", { id: 9810, sessionVersion: 0 }, 9811]],
    },
    {
      name: "block user",
      validId: 9811,
      run: (id: number) =>
        /* Передаёт выбранный ID блокировки и проверяемую причину с внешними пробелами. */ client().moderation.blockUser.mutate({
          userId: id,
          reason: "  synthetic reason  ",
        }),
      want: [["block", { id: 9810, sessionVersion: 0 }, 9811, "synthetic reason"]],
    },
    {
      name: "unblock user",
      validId: 9811,
      run: (id: number) =>
        /* Передаёт выбранный ID разблокировки. */ client().moderation.unblockUser.mutate({ userId: id }),
      want: [["unblock", { id: 9810, sessionVersion: 0 }, 9811]],
    },
  ];
  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", "");
    app = await createBackendApplication();
    sessions = app.get(SessionService);
    await app.listen(0, "127.0.0.1");
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  beforeEach(() => {
    actor = { ...moderator };
    effects = [];
    vi.spyOn(sessions, "optionalUser").mockImplementation(async () => actor);
    vi.spyOn(platformDb, "dismissCommentReport").mockImplementation(
      async (actorId, id) => {
        effects.push(["dismiss", actorId, id]);
      },
    );
    vi.spyOn(platformDb, "deleteReportedComment").mockImplementation(
      async (actorId, id) => {
        effects.push(["delete", actorId, id]);
      },
    );
    vi.spyOn(platformDb, "logAdminAction").mockImplementation(async (input) => {
      effects.push(["audit", input]);
    });
    vi.spyOn(platformDb, "blockUser").mockImplementation(async (...args) => {
      effects.push(["block", ...args]);
    });
    vi.spyOn(platformDb, "unblockUser").mockImplementation(async (...args) => {
      effects.push(["unblock", ...args]);
    });
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
  });

  it.each([
    { method: "listCommentReports", want: [moderator] },
    { method: "dismissCommentReport", want: [{ id: 9810, sessionVersion: 0 }, 9811] },
    { method: "deleteReportedComment", want: [{ id: 9810, sessionVersion: 0 }, 9811] },
    { method: "blockUser", want: [{ id: 9810, sessionVersion: 0 }, 9811, "synthetic reason"] },
    { method: "unblockUser", want: [{ id: 9810, sessionVersion: 0 }, 9811] },
  ])(
    "$method preserves the explicitly supplied service's refusal",
    async ({ method, want }) => {
      // Сценарий: Явно переданный сервис модерации определяет результат; роутер не обходит его прямым SQL.

      let received: unknown;
      const unexpected = async () => {
        // Падает при любом обращении не к выбранной подменённой операции модерации.

        throw new Error("unexpected moderation operation");
      };
      const moderation = {
        listCommentReports: unexpected,
        dismissCommentReport: unexpected,
        deleteReportedComment: unexpected,
        blockUser: unexpected,
        unblockUser: unexpected,
        [method]: async (...args: unknown[]) => {
          // Передаёт произвольные аргументы в выбранный отказующий провайдер, сохраняя их для сверки.

          received = args;
          throw new TRPCError({
            code: "CONFLICT",
            message: "synthetic supplied moderation refusal",
          });
        },
      };
      // Before migration the final dependency is ignored. The mismatch in the
      // consumer result proves bypass, rather than a missing class/import error.
      const composed: TrpcService = Reflect.construct(TrpcService, [
        app.get(ContentReadService),
        app.get(ContentWriteService),
        app.get(ContentCommentService),
        app.get(ContentUploadService),
        app.get(ClubCheckoutService),
        app.get(ClubSubscriptionService),
        sessions,
        app.get(NotificationsService),
        app.get(ProfileService),
        moderation,
        app.get(ShopService),
      ]);
      const caller = composed.router.createCaller({
        user: moderator,
        req: {},
        res: {},
      } as TrpcContext);
      const calls: Record<string, () => Promise<unknown>> = {
        listCommentReports: () => /* Вызывает чтение жалоб через собранный tRPC-контекст. */ caller.moderation.listCommentReports(),
        dismissCommentReport: () =>
          /* Вызывает отклонение жалобы через собранный tRPC-контекст. */ caller.moderation.dismissCommentReport({ reportId: 9811 }),
        deleteReportedComment: () =>
          /* Вызывает удаление комментария через собранный tRPC-контекст. */ caller.moderation.deleteReportedComment({
            commentId: 9811,
            reportId: 9812,
          }),
        blockUser: () =>
          /* Вызывает блокировку через собранный tRPC-контекст. */ caller.moderation.blockUser({
            userId: 9811,
            reason: "  synthetic reason  ",
          }),
        unblockUser: () => /* Вызывает разблокировку через собранный tRPC-контекст. */ caller.moderation.unblockUser({ userId: 9811 }),
      };
      await expect(calls[method]()).rejects.toMatchObject({
        code: "CONFLICT",
        message: "synthetic supplied moderation refusal",
      });
      expect(received).toEqual(want);
      expect(effects).toEqual([]);
    },
  );

  it.each([
    {
      method: "listCommentReports" as const,
      run: () => /* Запускает HTTP-чтение жалоб через фактический Nest-провайдер. */ client().moderation.listCommentReports.query(),
    },
    {
      method: "dismissCommentReport" as const,
      run: () =>
        /* Запускает HTTP-отклонение жалобы через фактический Nest-провайдер. */ client().moderation.dismissCommentReport.mutate({ reportId: 9811 }),
    },
    {
      method: "deleteReportedComment" as const,
      run: () =>
        /* Запускает HTTP-удаление комментария через фактический Nest-провайдер. */ client().moderation.deleteReportedComment.mutate({ commentId: 9811 }),
    },
    {
      method: "blockUser" as const,
      run: () =>
        /* Запускает HTTP-блокировку через фактический Nest-провайдер. */ client().moderation.blockUser.mutate({
          userId: 9811,
          reason: "synthetic reason",
        }),
    },
    {
      method: "unblockUser" as const,
      run: () => /* Запускает HTTP-разблокировку через фактический Nest-провайдер. */ client().moderation.unblockUser.mutate({ userId: 9811 }),
    },
  ])(
    "$method uses the actual Nest-managed provider",
    async ({ method, run }) => {
      // Сценарий: HTTP-маршрут использует фактический Nest-managed провайдер и сохраняет доменный отказ.

      vi.spyOn(app.get(ModerationService), method).mockRejectedValue(
        new TRPCError({
          code: "CONFLICT",
          message: "synthetic native moderation refusal",
        }),
      );
      await expect(run()).rejects.toMatchObject({
        message: "synthetic native moderation refusal",
        data: { code: "CONFLICT", httpStatus: 409 },
      });
      expect(effects).toEqual([]);
    },
  );

  it.each(["moderator", "admin"] as const)(
    "returns the bounded inbox for %s",
    async (role) => {
      // Сценарий: Модератор и администратор читают ограниченный inbox с переданным actor.

      actor = { ...moderator, role };
      let received: unknown;
      const rows: comments.CommentReportInboxRow[] = [
        {
          id: 9812,
          commentId: 9811,
          reason: "synthetic report",
          createdAt: new Date(0),
          commentText: "synthetic comment",
          commentPhotos: null,
          postId: 9813,
          authorUserId: 9814,
          authorName: null,
          reporterUserId: 9815,
          reporterName: null,
          canBlockAuthor: true,
        },
      ];
      vi.spyOn(comments, "listCommentReports").mockImplementation(
        async (...args) => {
          received = args;
          return rows;
        },
      );
      expect(await client().moderation.listCommentReports.query()).toEqual(
        rows,
      );
      expect(received).toEqual([100, actor]);
    },
  );

  it.each([
    { name: "guest", user: null, code: "UNAUTHORIZED", status: 401 },
    {
      name: "member",
      user: { ...moderator, role: "user" as const },
      code: "FORBIDDEN",
      status: 403,
    },
    {
      name: "blocked moderator",
      user: { ...moderator, blockedAt: new Date(0) },
      code: "FORBIDDEN",
      status: 403,
    },
  ])(
    "refuses the inbox to a $name before reading reports",
    async ({ user, code, status }) => {
      // Сценарий: Гость, участник и заблокированный модератор отклоняются до чтения жалоб.

      actor = user;
      let entered = false;
      vi.spyOn(comments, "listCommentReports").mockImplementation(async () => {
        entered = true;
        return [];
      });
      await expect(
        client().moderation.listCommentReports.query(),
      ).rejects.toMatchObject({ data: { code, httpStatus: status } });
      expect(entered).toBe(false);
    },
  );

  it.each([
    {
      helper: "dismissCommentReport" as const,
      reject: () =>
        /* Инъецирует приватную SQL-ошибку на границе отклонения жалобы. */ vi
          .spyOn(platformDb, "dismissCommentReport")
          .mockRejectedValue(new Error("synthetic private SQL detail")),
      run: () =>
        /* Запускает отклонение жалобы после инъекции отказа хранилища. */ client().moderation.dismissCommentReport.mutate({ reportId: 9811 }),
    },
    {
      helper: "deleteReportedComment" as const,
      reject: () =>
        /* Инъецирует приватную SQL-ошибку на границе удаления комментария. */ vi
          .spyOn(platformDb, "deleteReportedComment")
          .mockRejectedValue(new Error("synthetic private SQL detail")),
      run: () =>
        /* Запускает удаление комментария после инъекции отказа хранилища. */ client().moderation.deleteReportedComment.mutate({ commentId: 9811 }),
    },
  ])(
    "does not audit or return success when $helper fails",
    async ({ reject, run }) => {
      // Сценарий: Отказ удаления или отклонения жалобы не превращается в успех и не создаёт аудит.

      reject();
      await expect(run()).rejects.toMatchObject({
        message: "Внутренняя ошибка сервера",
        data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
      });
      expect(effects).toEqual([]);
    },
  );

  it.each([
    {
      helper: "blockUser" as const,
      run: () =>
        /* Запускает блокировку для проверки отсутствия ложного успеха. */ client().moderation.blockUser.mutate({
          userId: 9811,
          reason: "synthetic reason",
        }),
    },
    {
      helper: "unblockUser" as const,
      run: () => /* Запускает разблокировку для проверки отсутствия ложного успеха. */ client().moderation.unblockUser.mutate({ userId: 9811 }),
    },
  ])("does not return success when $helper fails", async ({ helper, run }) => {
    // Сценарий: Отказ блокировки либо разблокировки не возвращает успешный ответ.

    vi.spyOn(platformDb, helper).mockRejectedValue(
      new Error("synthetic private SQL detail"),
    );
    await expect(run()).rejects.toMatchObject({
      message: "Внутренняя ошибка сервера",
      data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
    });
  });

  it("uses the session actor, not a client-supplied deletion actor", async () => {
    // Сценарий: Автор удаления берётся из сессии, а не клиентского actorUserId.

    expect(
      await client().moderation.deleteReportedComment.mutate({
        commentId: 9811,
        actorUserId: 9999,
      } as { commentId: number }),
    ).toEqual({ ok: true });
    expect(effects).toEqual([["delete", { id: 9810, sessionVersion: 0 }, 9811]]);
  });

  it("uses the session actor, not a client-supplied dismissal actor", async () => {
    // Сценарий: Автор отклонения жалобы берётся из сессии, а не клиентского actorUserId.

    expect(
      await client().moderation.dismissCommentReport.mutate({
        reportId: 9811,
        actorUserId: 9999,
      } as { reportId: number }),
    ).toEqual({ ok: true });
    expect(effects).toEqual([["dismiss", { id: 9810, sessionVersion: 0 }, 9811]]);
  });

  describe.each(operations)("$name", ({ run, validId, want }) => {
    it.each([
      { name: "zero", id: 0 },
      { name: "negative", id: -1 },
      { name: "fractional", id: 1.5 },
      { name: "unsafe integer", id: 9007199254740992 },
    ])("rejects a $name ID before any mutation or audit", async ({ id }) => {
      // Сценарий: Нулевой, отрицательный, дробный и небезопасный ID отклоняется до записи или аудита.

      await expect(run(id)).rejects.toMatchObject({
        data: { code: "BAD_REQUEST", httpStatus: 400 },
      });
      expect(effects).toEqual([]);
    });

    it.each(["moderator", "admin"] as const)(
      "preserves a valid %s operation's target and actor",
      async (role) => {
        // Сценарий: Разрешённая операция сохраняет правильные target и actor для обеих административных ролей.

        actor = { ...moderator, role };
        expect(await run(validId)).toEqual({ ok: true });
        expect(effects).toEqual(want);
      },
    );

    it.each([
      { name: "guest", user: null, code: "UNAUTHORIZED", status: 401 },
      {
        name: "member",
        user: { ...moderator, role: "user" as const },
        code: "FORBIDDEN",
        status: 403,
      },
      {
        name: "blocked moderator",
        user: { ...moderator, blockedAt: new Date(0) },
        code: "FORBIDDEN",
        status: 403,
      },
    ])("refuses $name before side effects", async ({ user, code, status }) => {
      // Сценарий: Проверка доступа предшествует любому побочному эффекту операции.

      actor = user;
      await expect(run(validId)).rejects.toMatchObject({
        data: { code, httpStatus: status },
      });
      expect(effects).toEqual([]);
    });
  });
});
