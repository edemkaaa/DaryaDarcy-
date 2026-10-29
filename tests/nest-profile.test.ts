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
import * as profileWrites from "../apps/backend/src/profile/profile-writes";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import sharp from "sharp";
import { drizzle } from "drizzle-orm/mysql2";
import type { User } from "../packages/database/src/schema";
import type { AppRouter } from "../apps/backend/src/routers";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { SessionService } from "../apps/backend/src/identity/session.service";
import { sdk } from "../apps/backend/src/_core/sdk";
import * as db from "../apps/backend/src/db";
import * as platformDb from "../apps/backend/src/platform-db";
import * as storage from "../apps/backend/src/storage";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "../apps/backend/src/_core/context";
import { TrpcService } from "../apps/backend/src/_core/trpc.service";
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
import { ForbiddenError } from "../packages/shared/src/_core/errors";

// Real HTTP, validation, authorization and photo decoder; only session lookup,
// SQL and external storage are substituted. No real JWT/MySQL/S3 acceptance.
describe("profile use cases over native HTTP", () => {
  let app: INestApplication;
  let sessions: SessionService;
  let base: string;
  let actor: User | null;
  let photo: string;
  const member: User = {
    id: 9900,
    openId: "synthetic-profile-member",
    name: null,
    email: null,
    phone: null, contactPhone: null,
    passwordHash: null,
    sessionVersion: 0, profileRevision: 0,
    loginMethod: null,
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
  const client = () =>
    createTRPCProxyClient<AppRouter>({
      links: [httpLink({ url: base + "/api/trpc", transformer: superjson })],
    });
  const avatarInput = () => ({
    base64: photo,
    filename: "../../client.html",
    mimeType: "text/html",
  });
  const operations = [
    {
      name: "update" as const,
      run: () => client().profile.update.mutate({ expectedRevision: 0, name: "synthetic name" }),
    },
    {
      name: "uploadAvatar" as const,
      run: () => client().profile.uploadAvatar.mutate(avatarInput()),
    },
    {
      name: "requestAccountDeletion" as const,
      run: () => client().profileExtras.requestAccountDeletion.mutate(),
    },
  ];
  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", "");
    photo = (
      await sharp({
        create: { width: 12, height: 8, channels: 3, background: "red" },
      })
        .withExif({ IFD0: { Artist: "synthetic private author" } })
        .jpeg()
        .toBuffer()
    ).toString("base64");
    app = await createBackendApplication();
    sessions = app.get(SessionService);
    await app.listen(0, "127.0.0.1");
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  beforeEach(() => {
    actor = { ...member };
    vi.spyOn(db,"getDb").mockResolvedValue({} as never);
    vi.spyOn(sessions, "optionalUser").mockImplementation(async () => actor);
    vi.spyOn(sdk, "authenticateRequest").mockImplementation(async () => {
      if (!actor) throw ForbiddenError("synthetic missing identity");
      return actor;
    });
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
  });

  it.each(["update", "uploadAvatar", "requestAccountDeletion"] as const)(
    "%s preserves the explicitly supplied profile service's refusal",
    async (method) => {
      let received: unknown;
      const unexpected = async () => {
        throw new Error("unexpected profile operation");
      };
      const profiles = {
        update: unexpected,
        uploadAvatar: unexpected,
        requestAccountDeletion: unexpected,
        [method]: async (...args: unknown[]) => {
          received = args;
          throw new TRPCError({
            code: "CONFLICT",
            message: "synthetic supplied profile refusal",
          });
        },
      };
      // The old constructor ignores this last dependency. RED proves bypass
      // through a consumer result, not a missing service import or method.
      const composed: TrpcService = Reflect.construct(TrpcService, [
        app.get(ContentReadService),
        app.get(ContentWriteService),
        app.get(ContentCommentService),
        app.get(ContentUploadService),
        app.get(ClubCheckoutService),
        app.get(ClubSubscriptionService),
        sessions,
        app.get(NotificationsService),
        profiles,
        app.get(ModerationService),
        app.get(ShopService),
      ]);
      vi.spyOn(db, "updateUserProfile").mockResolvedValue(undefined);
      vi.spyOn(storage, "storagePut").mockImplementation(async (key) => ({
        key,
        url: "https://assets.example.test/legacy.webp",
      }));
      const caller = composed.router.createCaller({
        user: member,
        req: {},
        res: {},
      } as TrpcContext);
      const calls = {
        update: () => caller.profile.update({ expectedRevision: 0, name: "synthetic name" }),
        uploadAvatar: () => caller.profile.uploadAvatar(avatarInput()),
        requestAccountDeletion: () =>
          caller.profileExtras.requestAccountDeletion(),
      };
      await expect(calls[method]()).rejects.toMatchObject({
        code: "CONFLICT",
        message: "synthetic supplied profile refusal",
      });
      expect(received).toEqual(
        method === "update"
          ? [9900, { expectedRevision:0, name: "synthetic name" },0]
          : method === "uploadAvatar"
            ? [9900, photo, undefined]
            : [9900],
      );
    },
  );
  it("disabled recovery export remains unavailable without acquiring a broken database", async () => {
    vi.stubEnv("CONTENT_RECOVERY_EXPORT_ENABLED", "false");
    vi.spyOn(db, "getDb").mockRejectedValue(
      new Error("synthetic database failure"),
    );
    await expect(
      app
        .get(ProfileService)
        .recoveryExport(member, { kind: "post", limit: 25 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("enabled recovery export reports sanitized unavailability on database acquisition failure", async () => {
    vi.stubEnv("CONTENT_RECOVERY_EXPORT_ENABLED", "true");
    vi.spyOn(db, "getDb").mockRejectedValue(
      new Error("synthetic private database details"),
    );
    await expect(
      app
        .get(ProfileService)
        .recoveryExport(member, { kind: "post", limit: 25 }),
    ).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: "Экспорт временно недоступен",
    });
  });

  it.each(operations)(
    "$name uses the actual Nest-managed profile provider",
    async ({ name, run }) => {
      const profiles = app.get(ProfileService);
      vi.spyOn(db, "updateUserProfile").mockResolvedValue(undefined);
      vi.spyOn(platformDb, "requestAccountDeletion").mockResolvedValue(
        undefined,
      );
      vi.spyOn(storage, "storagePut").mockImplementation(async (key) => ({
        key,
        url: "https://assets.example.test/unexpected.webp",
      }));
      vi.spyOn(profiles, name).mockRejectedValue(
        new TRPCError({
          code: "CONFLICT",
          message: "synthetic native profile refusal",
        }),
      );
      await expect(run()).rejects.toMatchObject({
        message: "synthetic native profile refusal",
        data: { code: "CONFLICT", httpStatus: 409 },
      });
    },
  );

  it.each([
    {
      name: "partial",
      input: { name: "  synthetic name  ", userId: 9999, role: "admin" },
      want: { name: "synthetic name" },
    },
    {
      name: "all fields",
      input: {
        name: "synthetic",
        gender: "female" as const,
        avatarUrl: "https://assets.example.test/chosen.webp",
      },
      want: {
        name: "synthetic",
        gender: "female",
        avatarUrl: "https://assets.example.test/chosen.webp",
      },
    },
    { name: "empty", input: {}, want: {} },
  ])(
    "preserves a $name update and session ownership",
    async ({ input, want }) => {
      let received: unknown;
      vi.spyOn(profileWrites, "saveProfile").mockImplementation(async (...args) => {
        received = args; return Object.keys(want).length ? 1 : 0;
      });
      expect(await client().profile.update.mutate({expectedRevision:0,...(input)})).toMatchObject({
        success: true,
      });
      expect(received).toEqual([{},9900,0,{expectedRevision:0,...want}]);
    },
  );

  it.each([
    { label: "ASCII TEXT boundary", name: "n".repeat(65_535) },
    { label: "UTF-8 TEXT boundary", name: "я".repeat(32_767) + "a" },
  ])("accepts a name at the $label", async ({ name }) => {
    const persist = vi
      .spyOn(profileWrites, "saveProfile")
      .mockResolvedValue(1);
    expect(await client().profile.update.mutate({ expectedRevision: 0, name })).toMatchObject({
      success: true,
    });
    expect(persist).toHaveBeenCalledExactlyOnceWith({},member.id,0,{expectedRevision:0,name});
  });

  it.each([
    "http://assets.example.test/avatar.webp",
    "https://assets.example.test/avatar.webp",
  ])("preserves supported avatar URL %s", async (avatarUrl) => {
    const persist = vi
      .spyOn(profileWrites, "saveProfile")
      .mockResolvedValue(1);
    expect(await client().profile.update.mutate({ expectedRevision: 0, avatarUrl })).toMatchObject({
      success: true,
    });
    expect(persist).toHaveBeenCalledExactlyOnceWith({},member.id,0,{expectedRevision:0,avatarUrl});
  });

  it("returns the same explicit public profile through REST and tRPC", async () => {
    actor = {
      ...member,
      name: "synthetic profile",
      email: "profile@example.invalid",
      passwordHash: "private hash",
      sessionVersion: 17,
      blockedReason: "private moderation note",
      accountDeletionRequestedAt: new Date(1),
      futurePrivateColumn: "must never become public",
    } as User;
    const expected = {
      profileRevision: 0,
      id: member.id,
      openId: member.openId,
      name: "synthetic profile",
      email: "profile@example.invalid",
      phone: null,
      loginMethod: null,
      gender: null,
      avatarUrl: null,
      lastSignedIn: new Date(0).toISOString(),
      role: "user",
    };
    const rest = await fetch(base + "/api/auth/me");
    expect(rest.status).toBe(200);
    expect(await rest.json()).toEqual({ user: expected });
    expect(await client().auth.me.query()).toEqual(expected);
  });

  it("keeps guest profile responses unchanged in both APIs", async () => {
    actor = null;
    const rest = await fetch(base + "/api/auth/me");
    expect(rest.status).toBe(200);
    expect(await rest.json()).toEqual({ user: null });
    expect(await client().auth.me.query()).toBeNull();
  });

  it("stores a sanitized avatar in the actor's folder before updating its URL", async () => {
    vi.spyOn(db, "getDb").mockResolvedValue(drizzle.mock());
    const effects: string[] = [];
    let stored:
      | { key: string; bytes: Buffer; mime: string | undefined }
      | undefined;
    let updated: unknown;
    vi.spyOn(storage, "storagePut").mockImplementation(
      async (key, bytes, mime) => {
        effects.push("upload");
        stored = { key, bytes: Buffer.from(bytes), mime };
        return { key, url: "https://assets.example.test/sanitized.webp" };
      },
    );
    vi.spyOn(db, "updateUserProfile").mockImplementation(async (...args) => {
      effects.push("profile");
      updated = args;
    });
    const input = {
      ...avatarInput(),
      userId: 9999,
      url: "https://wrong.example.test/client",
    };
    expect(await client().profile.uploadAvatar.mutate(input)).toEqual({
      url: "https://assets.example.test/sanitized.webp",
    });
    expect(effects).toEqual(["upload", "profile"]);
    expect(updated).toEqual([
      9900,
      { avatarUrl: "https://assets.example.test/sanitized.webp" },
    ]);
    expect(stored?.key).toMatch(/^avatars\/9900\/[0-9a-f-]{36}\.webp$/);
    expect(stored?.mime).toBe("image/webp");
    const metadata = await sharp(stored!.bytes).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.exif).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
  });

  it("records the actor's deletion request without immediately deleting an account", async () => {
    let received: unknown;
    vi.spyOn(platformDb, "requestAccountDeletion").mockImplementation(
      async (id) => {
        received = id;
      },
    );
    expect(
      await client().profileExtras.requestAccountDeletion.mutate(),
    ).toEqual({ ok: true });
    expect(received).toBe(9900);
  });

  it.each([
    { name: "guest", user: null, code: "UNAUTHORIZED", status: 401 },
    {
      name: "blocked member",
      user: { ...member, blockedAt: new Date(0) },
      code: "FORBIDDEN",
      status: 403,
    },
  ])(
    "refuses every profile operation for $name before side effects",
    async (fixture) => {
      actor = fixture.user;
      const effects: string[] = [];
      vi.spyOn(db, "updateUserProfile").mockImplementation(async () => {
        effects.push("update");
      });
      vi.spyOn(platformDb, "requestAccountDeletion").mockImplementation(
        async () => {
          effects.push("deletion");
        },
      );
      vi.spyOn(storage, "storagePut").mockImplementation(async (key) => {
        effects.push("storage");
        return { key, url: "https://assets.example.test/unexpected.webp" };
      });
      for (const { run } of [operations[0], operations[2]]) {
        await expect(run()).rejects.toMatchObject({
          data: { code: fixture.code, httpStatus: fixture.status },
        });
      }
      // Upload admission refuses before tRPC parses the body, so its existing
      // raw HTTP response (not a tRPC envelope) is the correct contract.
      const upload = await fetch(base + "/api/trpc/profile.uploadAvatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      expect(upload.status).toBe(fixture.status);
      expect(await upload.json()).toEqual({
        error: fixture.user ? "Нет доступа" : "Нужно войти",
      });
      expect(effects).toEqual([]);
    },
  );

  it.each([
    {
      name: "empty name",
      run: () => client().profile.update.mutate({ expectedRevision: 0, name: "" }),
    },
    {
      name: "whitespace-only name",
      run: () => client().profile.update.mutate({ expectedRevision: 0, name: " \t\n " }),
    },
    {
      name: "name exceeding TEXT bytes",
      run: () => client().profile.update.mutate({ expectedRevision: 0, name: "n".repeat(65_536) }),
    },
    {
      name: "multibyte name exceeding TEXT bytes",
      run: () => client().profile.update.mutate({ expectedRevision: 0, name: "я".repeat(32_768) }),
    },
    ...[
      "javascript:alert(1)",
      "data:image/png;base64,AA==",
      "file:///tmp/avatar.png",
    ].map((avatarUrl) => ({
      name: "non-HTTP avatar " + avatarUrl.split(":")[0],
      run: () => client().profile.update.mutate({ expectedRevision: 0, avatarUrl }),
    })),
    {
      name: "avatar URL exceeding TEXT bytes",
      run: () =>
        client().profile.update.mutate({ expectedRevision: 0,
          avatarUrl: "https://example.invalid/" + "a".repeat(65_535),
        }),
    },
    {
      name: "invalid gender",
      run: () =>
        client().profile.update.mutate({ expectedRevision: 0, gender: "other" as "female" }),
    },
    {
      name: "invalid avatar URL",
      run: () => client().profile.update.mutate({ expectedRevision: 0, avatarUrl: "not a URL" }),
    },
    {
      name: "short photo",
      run: () =>
        client().profile.uploadAvatar.mutate({ ...avatarInput(), base64: "x" }),
    },
    {
      name: "invalid photo bytes",
      run: () =>
        client().profile.uploadAvatar.mutate({
          ...avatarInput(),
          base64: Buffer.from("<html>synthetic</html>").toString("base64"),
        }),
    },
  ])("rejects $name before persistence/storage", async ({ run }) => {
    vi.spyOn(db, "getDb").mockResolvedValue(drizzle.mock());
    const effects: string[] = [];
    vi.spyOn(db, "updateUserProfile").mockImplementation(async () => {
      effects.push("update");
    });
    vi.spyOn(storage, "storagePut").mockImplementation(async (key) => {
      effects.push("storage");
      return { key, url: "https://assets.example.test/unexpected.webp" };
    });
    await expect(run()).rejects.toMatchObject({
      data: { code: "BAD_REQUEST", httpStatus: 400 },
    });
    expect(effects).toEqual([]);
  });

  it.each(["update", "avatar storage", "avatar profile", "deletion"] as const)(
    "does not return success or leak internal details after a %s failure",
    async (failure) => {
      vi.spyOn(db, "getDb").mockResolvedValue(drizzle.mock());
      const effects: string[] = [];
      vi.spyOn(profileWrites,"saveProfile").mockImplementation(async()=>{effects.push("update");throw new Error("synthetic SQL detail");});
      vi.spyOn(storage, "storagePut").mockImplementation(async (key) => {
        effects.push("storage");
        if (failure === "avatar storage")
          throw new Error("synthetic private storage detail");
        return { key, url: "https://assets.example.test/sanitized.webp" };
      });
      vi.spyOn(db, "updateUserProfile").mockImplementation(async () => {
        effects.push("update");
        throw new Error("synthetic private SQL detail");
      });
      vi.spyOn(platformDb, "requestAccountDeletion").mockImplementation(
        async () => {
          effects.push("deletion");
          throw new Error("synthetic private SQL detail");
        },
      );
      const run =
        failure === "update"
          ? operations[0].run
          : failure === "deletion"
            ? operations[2].run
            : operations[1].run;
      await expect(run()).rejects.toMatchObject({
        ...(failure === "update" ? {data:{code:"SERVICE_UNAVAILABLE",httpStatus:503}} : {message:"Внутренняя ошибка сервера",data:{code:"INTERNAL_SERVER_ERROR",httpStatus:500}}),
      });
      expect(effects).toEqual(
        failure === "avatar storage"
          ? ["storage"]
          : failure === "avatar profile"
            ? ["storage", "update"]
            : [failure],
      );
    },
  );

  it.each([
    { name: "nonempty profile", input: { name: "synthetic name" } },
    { name: "empty profile", input: {} },
  ])(
    "refuses a $name update when no database is available",
    async ({ input }) => {
      vi.spyOn(db,"getDb").mockResolvedValue(null);
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      await expect(client().profile.update.mutate({expectedRevision:0,...(input)})).rejects.toMatchObject(
        {
          data: { code: "SERVICE_UNAVAILABLE", httpStatus: 503 },
        },
      );
    },
  );

  it("does not upload an avatar when no database client is available", async () => {
    vi.spyOn(db,"getDb").mockResolvedValue(null);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const uploaded: string[] = [];
    vi.spyOn(storage, "storagePut").mockImplementation(async (key) => {
      uploaded.push(key);
      return { key, url: "https://assets.example.test/unpersisted.webp" };
    });
    await expect(operations[1].run()).rejects.toMatchObject({
      message: "Внутренняя ошибка сервера",
      data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
    });
    expect(uploaded).toEqual([]);
  });

  it("does not upload an avatar when database client acquisition rejects", async () => {
    vi.spyOn(db, "getDb").mockRejectedValue(
      new Error("synthetic private database configuration detail"),
    );
    const effects: string[] = [];
    vi.spyOn(storage, "storagePut").mockImplementation(async (key) => {
      effects.push("storage");
      return { key, url: "https://assets.example.test/unpersisted.webp" };
    });
    await expect(operations[1].run()).rejects.toMatchObject({
      message: "Внутренняя ошибка сервера",
      data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
    });
    expect(effects).toEqual([]);
  });
  it("keeps deletion-request failure when no database is available", async () => {
    await expect(operations[2].run()).rejects.toMatchObject({
      message: "Внутренняя ошибка сервера",
      data: { httpStatus: 500 },
    });
  });
});
