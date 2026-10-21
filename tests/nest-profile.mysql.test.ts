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
import type { Connection, RowDataPacket } from "mysql2/promise";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { getDb } from "../apps/backend/src/db";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import type { AppRouter } from "../apps/backend/src/routers";
import { ProfileService } from "../apps/backend/src/profile/profile.service";

describe.skipIf(!testDatabaseUrl)(
  "profile persistence through real HTTP, JWT and disposable SQL",
  () => {
    let conn: Connection;
    let app: INestApplication;
    let base: string;
    beforeAll(async () => {
      conn = await openTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "profile-http-synthetic-secret-32");
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    });
    beforeEach(async () => {
      await conn.query("DROP TRIGGER IF EXISTS profile_http_write_refusal");
      await conn.query("DELETE FROM users WHERE id IN (8441,8442)");
      await conn.query(`INSERT INTO users (id,openId,name,email,role,gender,avatarUrl,sessionVersion,passwordHash) VALUES
      (8441,'profile-http-8441','Original','profile-one@example.invalid','user','female','https://example.invalid/old.webp',4,'synthetic-hash'),
      (8442,'profile-http-8442','Other','profile-two@example.invalid','user','male',NULL,0,NULL)`);
    });
    afterEach(async () => {
      vi.restoreAllMocks();
      await conn.query("DROP TRIGGER IF EXISTS profile_http_write_refusal");
    });
    afterAll(async () => {
      await app?.close();
      await conn?.query("DELETE FROM users WHERE id IN (8441,8442)");
      await conn?.end();
      const database = await getDb();
      await (
        database as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    async function authorization() {
      return `Bearer ${await sdk.createSessionToken("profile-http-8441", { sessionVersion: 4 })}`;
    }
    function client(authenticated = true, dropAcknowledgement = false) {
      return createTRPCProxyClient<AppRouter>({
        links: [
          httpLink({
            url: `${base}/api/trpc`,
            transformer: superjson,
            headers: async () =>
              !authenticated
                ? {}
                : {
                    Authorization: await authorization(),
                  },
            fetch: async (url, options) => {
              const response = await fetch(url, options);
              if (
                dropAcknowledgement &&
                String(url).includes("profile.update")
              ) {
                await response.text();
                throw new TypeError("synthetic lost profile acknowledgement");
              }
              return response;
            },
          }),
        ],
      });
    }
    async function users() {
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT id,name,email,role,gender,avatarUrl,sessionVersion,passwordHash,blockedAt,accountDeletionRequestedAt FROM users WHERE id IN (8441,8442) ORDER BY id",
      );
      return rows;
    }
    it("stores only profile fields for the session user despite a forged target or role", async () => {
      const before = await users();
      expect(
        await client().profile.update.mutate({
          name: "Updated",
          gender: "male",
          avatarUrl: "https://example.invalid/new.webp",
          userId: 8442,
          role: "admin",
          email: "forged@example.invalid",
        } as { name: string; gender: "male"; avatarUrl: string }),
      ).toEqual({ success: true });
      expect(await users()).toEqual([
        {
          id: 8441,
          name: "Updated",
          email: "profile-one@example.invalid",
          role: "user",
          gender: "male",
          avatarUrl: "https://example.invalid/new.webp",
          sessionVersion: 4,
          passwordHash: "synthetic-hash",
          blockedAt: null,
          accountDeletionRequestedAt: null,
        },
        before[1],
      ]);
    });
    it("keeps omitted fields on a partial patch", async () => {
      await client().profile.update.mutate({ name: "Name only" });
      const result = await users();
      expect(result[0]).toMatchObject({
        name: "Name only",
        gender: "female",
        avatarUrl: "https://example.invalid/old.webp",
        sessionVersion: 4,
      });
      expect(result[1]).toMatchObject({
        name: "Other",
        gender: "male",
        avatarUrl: null,
      });
    });
    it("accepts repeated identical profile writes for an existing account", async () => {
      expect(
        await client().profile.update.mutate({ name: "Original" }),
      ).toEqual({ success: true });
      expect(
        await client().profile.update.mutate({ name: "Original" }),
      ).toEqual({ success: true });
      expect((await users())[0].name).toBe("Original");
    });
    it.each([
      { label: "ASCII boundary", name: "n".repeat(65_535) },
      { label: "multibyte boundary", name: "😀".repeat(16_383) + "abc" },
    ])(
      "persists a valid $label name without SQL truncation",
      async ({ name }) => {
        const before = await users();
        expect(await client().profile.update.mutate({ name })).toEqual({
          success: true,
        });
        const after = await users();
        expect(after[0]).toEqual({ ...before[0], name });
        expect(after[1]).toEqual(before[1]);
      },
    );
    it.each([
      { label: "whitespace name", input: { name: " \t\n " } },
      { label: "oversized ASCII name", input: { name: "n".repeat(65_536) } },
      { label: "oversized UTF-8 name", input: { name: "😀".repeat(16_384) } },
      {
        label: "javascript avatar",
        input: { avatarUrl: "javascript:alert(1)" },
      },
      {
        label: "data avatar",
        input: { avatarUrl: "data:image/png;base64,AA==" },
      },
      { label: "file avatar", input: { avatarUrl: "file:///tmp/avatar.png" } },
      {
        label: "oversized avatar",
        input: { avatarUrl: "https://example.invalid/" + "a".repeat(65_535) },
      },
    ])("rejects $label with HTTP 400 and unchanged SQL", async ({ input }) => {
      const before = await users();
      await expect(client().profile.update.mutate(input)).rejects.toMatchObject(
        {
          data: { code: "BAD_REQUEST", httpStatus: 400 },
        },
      );
      expect(await users()).toEqual(before);
    });
    it("recovers the committed profile via REST after the client loses the write response", async () => {
      const before = await users();
      await expect(
        client(true, true).profile.update.mutate({
          name: "  Updated profile  ",
          gender: "male",
        }),
      ).rejects.toThrow("synthetic lost profile acknowledgement");
      const rest = await fetch(base + "/api/auth/me", {
        headers: { Authorization: await authorization() },
      });
      expect(rest.status).toBe(200);
      const { user } = await rest.json();
      expect(user).toMatchObject({
        id: 8441,
        name: "Updated profile",
        gender: "male",
        avatarUrl: before[0].avatarUrl,
      });
      expect(await client().auth.me.query()).toEqual(user);
      expect(Object.keys(user).sort()).toEqual(
        [
          "id",
          "openId",
          "name",
          "email",
          "phone",
          "loginMethod",
          "gender",
          "avatarUrl",
          "lastSignedIn",
          "role",
        ].sort(),
      );
      expect(await users()).toEqual([
        { ...before[0], name: "Updated profile", gender: "male" },
        before[1],
      ]);
    });
    it.each([
      {
        name: "profile field",
        run: (service: ProfileService) =>
          service.update(8441, { name: "Gone" }),
      },
      {
        name: "avatar URL persistence",
        run: (service: ProfileService) =>
          service.update(8441, {
            avatarUrl: "https://example.invalid/gone.webp",
          }),
      },
      {
        name: "deletion request",
        run: (service: ProfileService) => service.requestAccountDeletion(8441),
      },
    ])(
      "refuses false success for a missing account's $name",
      async ({ run }) => {
        // Exercise the post-authentication persistence boundary directly, without
        // claiming a native HTTP race or uploading an object to external storage.
        await conn.query("DELETE FROM users WHERE id=8441");
        const before = await users();
        await expect(run(app.get(ProfileService))).rejects.toThrow();
        expect(await users()).toEqual(before);
      },
    );
    it("preserves the existing no-op success for an empty patch", async () => {
      const before = await users();
      expect(await client().profile.update.mutate({})).toEqual({
        success: true,
      });
      expect(await users()).toEqual(before);
    });
    it.each([
      {
        name: "profile field",
        input: { name: "Gone after authentication" },
      },
      {
        name: "avatar URL",
        input: { avatarUrl: "https://example.invalid/gone.webp" },
      },
      { name: "deletion request", input: null },
    ])(
      "returns a safe HTTP error when the account disappears before persisting $name",
      async ({ input }) => {
        const before = await users();
        const service = app.get(ProfileService);
        // Deterministically place a real SQL deletion after JWT authentication
        // but before the canonical write. No authorization or SQL write is mocked.
        if (input) {
          const update = service.update.bind(service);
          vi.spyOn(service, "update").mockImplementation(async (id, patch) => {
            await conn.query("DELETE FROM users WHERE id=?", [id]);
            return update(id, patch);
          });
        } else {
          const request = service.requestAccountDeletion.bind(service);
          vi.spyOn(service, "requestAccountDeletion").mockImplementation(
            async (id) => {
              await conn.query("DELETE FROM users WHERE id=?", [id]);
              return request(id);
            },
          );
        }
        const result = input
          ? client().profile.update.mutate(input)
          : client().profileExtras.requestAccountDeletion.mutate();
        await expect(result).rejects.toMatchObject({
          message: "Внутренняя ошибка сервера",
          data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
        });
        expect(await users()).toEqual([before[1]]);
      },
    );
    it("records a repeatable deletion request only for the session account without erasing it", async () => {
      const before = await users();
      expect(
        await client().profileExtras.requestAccountDeletion.mutate(),
      ).toEqual({ ok: true });
      expect(await users()).toEqual([
        { ...before[0], accountDeletionRequestedAt: expect.any(Date) },
        before[1],
      ]);
      expect(
        await client().profileExtras.requestAccountDeletion.mutate(),
      ).toEqual({ ok: true });
      expect(await users()).toEqual([
        { ...before[0], accountDeletionRequestedAt: expect.any(Date) },
        before[1],
      ]);
    });
    it.each([
      {
        name: "profile update",
        run: () => client(false).profile.update.mutate({ name: "Forbidden" }),
      },
      {
        name: "deletion request",
        run: () => client(false).profileExtras.requestAccountDeletion.mutate(),
      },
    ])(
      "refuses unauthenticated $name without changing either account",
      async ({ run }) => {
        const before = await users();
        await expect(run()).rejects.toMatchObject({
          data: { code: "UNAUTHORIZED", httpStatus: 401 },
        });
        expect(await users()).toEqual(before);
      },
    );
    it.each([
      {
        name: "profile update",
        run: () => client().profile.update.mutate({ name: "Rejected" }),
      },
      {
        name: "deletion request",
        run: () => client().profileExtras.requestAccountDeletion.mutate(),
      },
    ])(
      "does not report success or expose SQL when $name fails to persist",
      async ({ run }) => {
        const before = await users();
        await conn.query(`CREATE TRIGGER profile_http_write_refusal BEFORE UPDATE ON users FOR EACH ROW
      BEGIN IF NEW.id=8441 AND (
        NOT (NEW.name <=> OLD.name) OR
        NOT (NEW.accountDeletionRequestedAt <=> OLD.accountDeletionRequestedAt)
      ) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic profile SQL failure'; END IF; END`);
        await expect(run()).rejects.toMatchObject({
          message: "Внутренняя ошибка сервера",
          data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
        });
        expect(await users()).toEqual(before);
      },
    );
  },
);
