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
      name: "dismiss report",
      validId: 9811,
      run: (id: number) =>
        client().moderation.dismissCommentReport.mutate({ reportId: id }),
      want: [["dismiss", 9810, 9811]],
    },
    {
      name: "delete comment without report",
      validId: 9811,
      run: (id: number) =>
        client().moderation.deleteReportedComment.mutate({ commentId: id }),
      want: [["delete", 9810, 9811]],
    },
    {
      name: "delete comment with report",
      validId: 9812,
      run: (id: number) =>
        client().moderation.deleteReportedComment.mutate({
          commentId: 9811,
          reportId: id,
        }),
      want: [["delete", 9810, 9811]],
    },
    {
      name: "block user",
      validId: 9811,
      run: (id: number) =>
        client().moderation.blockUser.mutate({
          userId: id,
          reason: "  synthetic reason  ",
        }),
      want: [["block", 9810, 9811, "synthetic reason"]],
    },
    {
      name: "unblock user",
      validId: 9811,
      run: (id: number) =>
        client().moderation.unblockUser.mutate({ userId: id }),
      want: [["unblock", 9810, 9811]],
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
    { method: "listCommentReports", want: [] },
    { method: "dismissCommentReport", want: [9810, 9811] },
    { method: "deleteReportedComment", want: [9810, 9811] },
    { method: "blockUser", want: [9810, 9811, "synthetic reason"] },
    { method: "unblockUser", want: [9810, 9811] },
  ])(
    "$method preserves the explicitly supplied service's refusal",
    async ({ method, want }) => {
      let received: unknown;
      const unexpected = async () => {
        throw new Error("unexpected moderation operation");
      };
      const moderation = {
        listCommentReports: unexpected,
        dismissCommentReport: unexpected,
        deleteReportedComment: unexpected,
        blockUser: unexpected,
        unblockUser: unexpected,
        [method]: async (...args: unknown[]) => {
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
        listCommentReports: () => caller.moderation.listCommentReports(),
        dismissCommentReport: () =>
          caller.moderation.dismissCommentReport({ reportId: 9811 }),
        deleteReportedComment: () =>
          caller.moderation.deleteReportedComment({
            commentId: 9811,
            reportId: 9812,
          }),
        blockUser: () =>
          caller.moderation.blockUser({
            userId: 9811,
            reason: "  synthetic reason  ",
          }),
        unblockUser: () => caller.moderation.unblockUser({ userId: 9811 }),
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
      run: () => client().moderation.listCommentReports.query(),
    },
    {
      method: "dismissCommentReport" as const,
      run: () =>
        client().moderation.dismissCommentReport.mutate({ reportId: 9811 }),
    },
    {
      method: "deleteReportedComment" as const,
      run: () =>
        client().moderation.deleteReportedComment.mutate({ commentId: 9811 }),
    },
    {
      method: "blockUser" as const,
      run: () =>
        client().moderation.blockUser.mutate({
          userId: 9811,
          reason: "synthetic reason",
        }),
    },
    {
      method: "unblockUser" as const,
      run: () => client().moderation.unblockUser.mutate({ userId: 9811 }),
    },
  ])(
    "$method uses the actual Nest-managed provider",
    async ({ method, run }) => {
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
      expect(received).toEqual([100]);
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
        vi
          .spyOn(platformDb, "dismissCommentReport")
          .mockRejectedValue(new Error("synthetic private SQL detail")),
      run: () =>
        client().moderation.dismissCommentReport.mutate({ reportId: 9811 }),
    },
    {
      helper: "deleteReportedComment" as const,
      reject: () =>
        vi
          .spyOn(platformDb, "deleteReportedComment")
          .mockRejectedValue(new Error("synthetic private SQL detail")),
      run: () =>
        client().moderation.deleteReportedComment.mutate({ commentId: 9811 }),
    },
  ])(
    "does not audit or return success when $helper fails",
    async ({ reject, run }) => {
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
        client().moderation.blockUser.mutate({
          userId: 9811,
          reason: "synthetic reason",
        }),
    },
    {
      helper: "unblockUser" as const,
      run: () => client().moderation.unblockUser.mutate({ userId: 9811 }),
    },
  ])("does not return success when $helper fails", async ({ helper, run }) => {
    vi.spyOn(platformDb, helper).mockRejectedValue(
      new Error("synthetic private SQL detail"),
    );
    await expect(run()).rejects.toMatchObject({
      message: "Внутренняя ошибка сервера",
      data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
    });
  });

  it("uses the session actor, not a client-supplied deletion actor", async () => {
    expect(
      await client().moderation.deleteReportedComment.mutate({
        commentId: 9811,
        actorUserId: 9999,
      } as { commentId: number }),
    ).toEqual({ ok: true });
    expect(effects).toEqual([["delete", 9810, 9811]]);
  });

  it("uses the session actor, not a client-supplied dismissal actor", async () => {
    expect(
      await client().moderation.dismissCommentReport.mutate({
        reportId: 9811,
        actorUserId: 9999,
      } as { reportId: number }),
    ).toEqual({ ok: true });
    expect(effects).toEqual([["dismiss", 9810, 9811]]);
  });

  describe.each(operations)("$name", ({ run, validId, want }) => {
    it.each([
      { name: "zero", id: 0 },
      { name: "negative", id: -1 },
      { name: "fractional", id: 1.5 },
      { name: "unsafe integer", id: 9007199254740992 },
    ])("rejects a $name ID before any mutation or audit", async ({ id }) => {
      await expect(run(id)).rejects.toMatchObject({
        data: { code: "BAD_REQUEST", httpStatus: 400 },
      });
      expect(effects).toEqual([]);
    });

    it.each(["moderator", "admin"] as const)(
      "preserves a valid %s operation's target and actor",
      async (role) => {
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
      actor = user;
      await expect(run(validId)).rejects.toMatchObject({
        data: { code, httpStatus: status },
      });
      expect(effects).toEqual([]);
    });
  });
});
