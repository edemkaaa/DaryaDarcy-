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
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { SessionService } from "../apps/backend/src/identity/session.service";
import type { AppRouter } from "../apps/backend/src/routers";
import type { User } from "../packages/database/src/schema";
import * as db from "../apps/backend/src/db";

// Native HTTP, schemas and service; only identity lookup and persistence are doubled.
describe("admin content write validation before persistence", () => {
  let app: INestApplication;
  let base: string;
  const actor: User = {
    id: 9912,
    openId: "content-validation-admin",
    role: "admin",
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
      links: [
        httpLink({
          url: base + "/api/trpc",
          transformer: superjson,
        }),
      ],
    });
  const post = { text: "Valid body", photos: [], tags: [], published: false };
  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", "");
    app = await createBackendApplication();
    await app.listen(0, "127.0.0.1");
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  beforeEach(() => {
    vi.spyOn(app.get(SessionService), "optionalUser").mockResolvedValue(actor);
    vi.spyOn(db, "createPostWithVideos").mockResolvedValue(9913);
    vi.spyOn(db, "savePostEdit").mockResolvedValue(undefined);
    vi.spyOn(db, "createArticle").mockResolvedValue(9914);
    vi.spyOn(db, "updateArticle").mockResolvedValue(undefined);
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
  });

  for (const field of ["scheduledAt", "publishedAt"] as const) {
    it.each([
      "not-a-date",
      "2026-02-30T10:00:00Z",
      "2026-13-01",
      "2039-01-01T00:00:00Z",
      "1969-12-31T23:59:59Z",
    ])(
      `rejects invalid/out-of-storage-range ${field} %s on create and update`,
      async (date) => {
        for (const result of [
          () => client().admin.createPost.mutate({ ...post, [field]: date }),
          () => client().admin.updatePost.mutate({ id: 9913, [field]: date }),
        ])
          await expect(result()).rejects.toMatchObject({
            data: { code: "BAD_REQUEST", httpStatus: 400 },
          });
        expect(db.createPostWithVideos).not.toHaveBeenCalled();
        expect(db.savePostEdit).not.toHaveBeenCalled();
      },
    );
  }
  it.each([1.5, -1.5, 2_147_483_648, -2_147_483_649])(
    "rejects sortOrder %s for both post/article writes",
    async (sortOrder) => {
      for (const run of [
        () => client().admin.createPost.mutate({ ...post, sortOrder }),
        () => client().admin.updatePost.mutate({ id: 9913, sortOrder }),
        () =>
          client().admin.createArticle.mutate({
            title: "Article",
            sections: [],
            sortOrder,
          }),
        () => client().admin.updateArticle.mutate({ id: 9914, sortOrder }),
      ])
        await expect(run()).rejects.toMatchObject({
          data: { code: "BAD_REQUEST", httpStatus: 400 },
        });
      for (const write of [
        db.createPostWithVideos,
        db.savePostEdit,
        db.createArticle,
        db.updateArticle,
      ]) {
        expect(write).not.toHaveBeenCalled();
      }
    },
  );
  it.each([-2_147_483_648, -1, 0, 2_147_483_647])(
    "preserves valid signed SQL INT order %s",
    async (sortOrder) => {
      expect(
        await client().admin.createPost.mutate({ ...post, sortOrder }),
      ).toBe(9913);
      expect(
        await client().admin.updateArticle.mutate({ id: 9914, sortOrder }),
      ).toEqual({ ok: true });
      expect(db.createPostWithVideos).toHaveBeenCalledWith(
        expect.objectContaining({ sortOrder }),
        [],
        expect.anything(),
      );
      expect(db.updateArticle).toHaveBeenCalledWith(9914, { sortOrder }, actor);
    },
  );
  it.each([
    null,
    "",
    "2026-10-21",
    "2026-10-21T09:00:00.000Z",
    "2026-10-21T12:00:00+03:00",
    "2026-10-21 09:00:00",
  ])("preserves existing nullable/valid date input %s", async (publishedAt) => {
    expect(
      await client().admin.updatePost.mutate({ id: 9913, publishedAt }),
    ).toEqual({ success: true });
    expect(db.savePostEdit).toHaveBeenCalledWith(
      9913,
      {
        publishedAt: publishedAt ? new Date(publishedAt) : null,
      },
      undefined,
      expect.anything(),
    );
  });
});
