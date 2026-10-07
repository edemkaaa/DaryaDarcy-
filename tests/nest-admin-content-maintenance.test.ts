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
import { TRPCError } from "@trpc/server";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import type { User } from "../packages/database/src/schema";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { ContentWriteService } from "../apps/backend/src/content/content-write.service";
import { SessionService } from "../apps/backend/src/identity/session.service";
import type { AppRouter } from "../apps/backend/src/routers";

// Native HTTP/composition/auth middleware; only session lookup and the selected
// content provider are doubled. This does not claim JWT or MySQL acceptance.
describe("native admin content maintenance service boundary", () => {
  let application: INestApplication;
  let writes: ContentWriteService;
  let sessions: SessionService;
  let base: string;
  let actor: User | null;
  const administrator: User = {
    id: 9300,
    openId: "synthetic-content-maintenance-admin",
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
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    lastSignedIn: new Date("2026-01-01T00:00:00Z"),
  };
  const client = () =>
    createTRPCProxyClient<AppRouter>({
      links: [httpLink({ url: base + "/api/trpc", transformer: superjson })],
    });
  const operations = [
    {
      method: "deletePost" as const,
      invoke: () => client().admin.deletePost.mutate({ id: 9301 }),
      want: undefined,
      argument: 9301,
    },
    {
      method: "deleteMedia" as const,
      invoke: () => client().admin.deleteMedia.mutate({ id: 9302 }),
      want: undefined,
      argument: 9302,
    },
    {
      method: "cleanupMediaNames" as const,
      invoke: () => client().admin.cleanupMediaNames.mutate(),
      want: { ok: true },
      argument: undefined,
    },
  ];

  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", "");
    application = await createBackendApplication();
    writes = application.get(ContentWriteService);
    sessions = application.get(SessionService);
    await application.listen(0, "127.0.0.1");
    base = `http://127.0.0.1:${(application.getHttpServer().address() as AddressInfo).port}`;
  });
  beforeEach(() => {
    actor = { ...administrator };
    vi.spyOn(sessions, "optionalUser").mockImplementation(async () => actor);
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await application?.close();
    vi.unstubAllEnvs();
  });

  it.each(operations)(
    "$method returns the injected content provider's outcome, not a direct SQL outcome",
    async ({ method, invoke, want, argument }) => {
      // Define the new seam on the existing instance so RED exercises the old
      // production route rather than failing because a method does not exist.
      const original = Object.getOwnPropertyDescriptor(writes, method);
      Object.defineProperty(writes, method, {
        configurable: true,
        value: async (id?: number) => {
          if (id !== argument) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "wrong resource",
            });
          }
          return want;
        },
      });
      try {
        expect(await invoke()).toEqual(want);
      } finally {
        if (original) Object.defineProperty(writes, method, original);
        else Reflect.deleteProperty(writes, method);
      }
    },
  );

  it.each(operations)(
    "$method preserves a domain refusal from the injected provider",
    async ({ method, invoke }) => {
      const original = Object.getOwnPropertyDescriptor(writes, method);
      Object.defineProperty(writes, method, {
        configurable: true,
        value: async () => {
          throw new TRPCError({
            code: "CONFLICT",
            message: "synthetic content refusal",
          });
        },
      });
      try {
        await expect(invoke()).rejects.toMatchObject({
          message: "synthetic content refusal",
          data: { code: "CONFLICT", httpStatus: 409 },
        });
      } finally {
        if (original) Object.defineProperty(writes, method, original);
        else Reflect.deleteProperty(writes, method);
      }
    },
  );

  describe.each([
    {
      access: "guest",
      role: null,
      blocked: false,
      code: "UNAUTHORIZED",
      status: 401,
    },
    {
      access: "member",
      role: "user",
      blocked: false,
      code: "FORBIDDEN",
      status: 403,
    },
    {
      access: "moderator",
      role: "moderator",
      blocked: false,
      code: "FORBIDDEN",
      status: 403,
    },
    {
      access: "blocked administrator",
      role: "admin",
      blocked: true,
      code: "FORBIDDEN",
      status: 403,
    },
  ] as const)("$access", ({ role, blocked, code, status }) => {
    it.each(operations)("cannot execute $method", async ({ invoke }) => {
      actor = role
        ? { ...administrator, role, blockedAt: blocked ? new Date() : null }
        : null;
      await expect(invoke()).rejects.toMatchObject({
        data: { code, httpStatus: status },
      });
    });
  });

  it.each(["deletePost", "deleteMedia"] as const)(
    "%s rejects a malformed ID before doing content work",
    async (method) => {
      await expect(
        client().admin[method].mutate({ id: "9301" as unknown as number }),
      ).rejects.toMatchObject({
        data: { code: "BAD_REQUEST", httpStatus: 400 },
      });
    },
  );

  it.each(["deletePost", "deleteMedia"] as const)(
    "%s with the real provider does not announce success without a database",
    async (method) => {
      await expect(
        client().admin[method].mutate({ id: 9301 }),
      ).rejects.toMatchObject({
        message: "Внутренняя ошибка сервера",
        data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
      });
    },
  );
  it("keeps cleanup's existing no-database no-op response", async () => {
    expect(await client().admin.cleanupMediaNames.mutate()).toEqual({
      ok: true,
    });
  });
});
