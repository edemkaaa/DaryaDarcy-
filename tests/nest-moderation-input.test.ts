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
      want: [
        ["dismiss", 9811],
        [
          "audit",
          {
            actorUserId: 9810,
            action: "dismiss_comment_report",
            targetType: "comment_report",
            targetId: 9811,
          },
        ],
      ],
    },
    {
      name: "delete comment without report",
      validId: 9811,
      run: (id: number) =>
        client().moderation.deleteReportedComment.mutate({ commentId: id }),
      want: [
        ["delete", 9811],
        [
          "audit",
          {
            actorUserId: 9810,
            action: "delete_reported_comment",
            targetType: "comment",
            targetId: 9811,
          },
        ],
      ],
    },
    {
      name: "delete comment with report",
      validId: 9812,
      run: (id: number) =>
        client().moderation.deleteReportedComment.mutate({
          commentId: 9811,
          reportId: id,
        }),
      want: [
        ["delete", 9811],
        [
          "audit",
          {
            actorUserId: 9810,
            action: "delete_reported_comment",
            targetType: "comment",
            targetId: 9811,
          },
        ],
      ],
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
    vi.spyOn(comments, "dismissCommentReport").mockImplementation(
      async (id) => {
        effects.push(["dismiss", id]);
      },
    );
    vi.spyOn(comments, "deleteCommentAndReports").mockImplementation(
      async (id) => {
        effects.push(["delete", id]);
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
