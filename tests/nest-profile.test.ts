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
import sharp from "sharp";
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
    phone: null,
    passwordHash: null,
    sessionVersion: 0,
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
      run: () => client().profile.update.mutate({ name: "synthetic name" }),
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
    vi.spyOn(sessions, "optionalUser").mockImplementation(async () => actor);
    vi.spyOn(sdk, "authenticateRequest").mockImplementation(async () => {
      if (!actor) throw new Error("synthetic missing identity");
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
        update: () => caller.profile.update({ name: "synthetic name" }),
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
          ? [9900, { name: "synthetic name" }]
          : method === "uploadAvatar"
            ? [9900, photo]
            : [9900],
      );
    },
  );

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
      want: { name: "  synthetic name  " },
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
      vi.spyOn(db, "updateUserProfile").mockImplementation(async (...args) => {
        received = args;
      });
      expect(await client().profile.update.mutate(input)).toEqual({
        success: true,
      });
      expect(received).toEqual([9900, want]);
    },
  );

  it("stores a sanitized avatar in the actor's folder before updating its URL", async () => {
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
      run: () => client().profile.update.mutate({ name: "" }),
    },
    {
      name: "invalid gender",
      run: () =>
        client().profile.update.mutate({ gender: "other" as "female" }),
    },
    {
      name: "invalid avatar URL",
      run: () => client().profile.update.mutate({ avatarUrl: "not a URL" }),
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
      const effects: string[] = [];
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
        message: "Внутренняя ошибка сервера",
        data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
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
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      await expect(client().profile.update.mutate(input)).rejects.toMatchObject(
        {
          message: "Внутренняя ошибка сервера",
          data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
        },
      );
    },
  );

  it("does not return an avatar URL when its profile cannot be persisted", async () => {
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
    // Upload-before-write is unchanged; compensation remains a separate task.
    expect(uploaded).toHaveLength(1);
    expect(uploaded[0]).toMatch(/^avatars\/9900\/[0-9a-f-]{36}\.webp$/);
  });
  it("keeps deletion-request failure when no database is available", async () => {
    await expect(operations[2].run()).rejects.toMatchObject({
      message: "Внутренняя ошибка сервера",
      data: { httpStatus: 500 },
    });
  });
});
