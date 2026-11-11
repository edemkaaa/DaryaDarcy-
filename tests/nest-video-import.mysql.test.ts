import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import type { Connection } from "mysql2/promise";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import type { AppRouter } from "../apps/backend/src/routers";
import { sdk } from "../apps/backend/src/_core/sdk";
import { getDb } from "../apps/backend/src/db";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";

// Only outbound transport is intercepted; native HTTP/JWT/live SQL remain real.
const transport = vi.hoisted(() => ({ store: vi.fn() }));
vi.mock("../apps/backend/src/storage", () => ({ storagePut: transport.store }));
const httpFetch = globalThis.fetch;
/** Проверяет allowlist клиентской video URL на настоящем HTTP без скачивания или копирования внешнего содержимого. */
describe.skipIf(!testDatabaseUrl)(
  "native video URL policy over HTTP/JWT/MySQL",
  () => {
    let application: INestApplication,
      conn: Connection,
      base: string,
      bearer: string;
    const outbound = vi.fn(() => {
      throw new Error("Unexpected outbound fixture request");
    });
    /** Создаёт настоящий HTTP tRPC-клиент выбранного Bearer с сохранённым до подмены fetch. */
    const client = (token?: string) =>
      createTRPCProxyClient<AppRouter>({
        links: [
          httpLink({
            url: base + "/api/trpc",
            transformer: superjson,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            fetch: httpFetch,
          }),
        ],
      });
    /** Настраивает synthetic S3 namespace и собственного администратора, поднимает локальный API и перехватывает outbound. */
    beforeAll(async () => {
      conn = await openTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv(
        "JWT_SECRET",
        "native-video-import-fixture-secret-32-characters",
      );
      vi.stubEnv("PUBLIC_APP_URL", "https://club.example.test");
      vi.stubEnv("S3_ENDPOINT", "https://s3.example.test");
      vi.stubEnv("S3_BUCKET", "darcy");
      vi.stubGlobal("fetch", outbound);
      await conn.query(
        "INSERT INTO users (id,openId,role) VALUES (9030,'native-video-import-admin','admin')",
      );
      application = await createBackendApplication();
      await application.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(application.getHttpServer().address() as AddressInfo).port}`;
      bearer = await sdk.createSessionToken("native-video-import-admin", {
        sessionVersion: 0,
      });
    });
    /** Очищает spies и возвращает действующие admin-права и epoch. */
    beforeEach(async () => {
      outbound.mockClear();
      transport.store.mockReset();
      await conn.query(
        "UPDATE users SET role='admin',blockedAt=NULL,sessionVersion=0 WHERE id=9030",
      );
    });
    /** Закрывает API, удаляет своего пользователя и соединения и возвращает fetch и окружение. */
    afterAll(async () => {
      await application?.close();
      if (conn) {
        await conn.query("DELETE FROM users WHERE id=9030");
        await conn.end();
      }
      await (
        (await getDb()) as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    });
    /** Loopback, metadata, чужие origin/bucket, credentials, traversal и неподдерживаемые соцсети отклоняются до сети и storage. */
    it.each([
      "http://127.0.0.1/admin.mp4",
      "http://169.254.169.254/latest/meta-data/video.mp4",
      "https://evil.test/darcy/a.mp4",
      "https://s3.example.test.evil.test/darcy/a.mp4",
      "https://fixture:fixture@s3.example.test/darcy/a.mp4",
      "https://s3.example.test/other/a.mp4",
      "http://s3.example.test/darcy/a.mp4",
      "ftp://s3.example.test/darcy/a.mp4",
      "https://s3.example.test/darcy/%2e%2e/other/a.mp4",
      "https://www.instagram.com/reel/fixture/",
      "https://youtu.be/fixture",
      "https://www.tiktok.com/video/fixture",
      "https://fb.watch/fixture/",
      "not a valid URL",
    ])(
      "rejects client URL %s as BAD_REQUEST without outbound effects",
      async (url) => {
        await expect(
          client(bearer).admin.importVideoUrl.mutate({ url }),
        ).rejects.toMatchObject({
          data: { code: "BAD_REQUEST", httpStatus: 400 },
        });
        expect(outbound).not.toHaveBeenCalled();
        expect(transport.store).not.toHaveBeenCalled();
      },
    );
    /** Разрешённый S3 URL только нормализуется и возвращается без заявления о скачивании, проверке или копировании файла. */
    it.each([
      "https://s3.example.test/darcy/feed/a.mp4",
      "  https://s3.example.test/darcy/feed/a.mp4  ",
    ])("retains %s without claiming to copy or inspect it", async (url) => {
      expect(await client(bearer).admin.importVideoUrl.mutate({ url })).toEqual(
        { url: "https://s3.example.test/darcy/feed/a.mp4" },
      );
      expect(outbound).not.toHaveBeenCalled();
      expect(transport.store).not.toHaveBeenCalled();
    });
    /** Смена роли, блокировка или отзыв epoch запрещают import URL по прежней JWT до внешней работы. */
    it.each([
      ["role='user'", "FORBIDDEN", 403],
      ["role='moderator'", "FORBIDDEN", 403],
      ["blockedAt=NOW()", "UNAUTHORIZED", 401],
      ["sessionVersion=1", "UNAUTHORIZED", 401],
    ] as const)(
      "rechecks live identity after %s",
      async (patch, code, httpStatus) => {
        await conn.query(`UPDATE users SET ${patch} WHERE id=9030`);
        await expect(
          client(bearer).admin.importVideoUrl.mutate({
            url: "https://s3.example.test/darcy/feed/a.mp4",
          }),
        ).rejects.toMatchObject({ data: { code, httpStatus } });
        expect(outbound).not.toHaveBeenCalled();
        expect(transport.store).not.toHaveBeenCalled();
      },
    );
    /** Гостевой import URL получает 401 без fetch и storage. */
    it("denies anonymous URL imports", async () => {
      await expect(
        client().admin.importVideoUrl.mutate({
          url: "https://s3.example.test/darcy/feed/a.mp4",
        }),
      ).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED", httpStatus: 401 },
      });
      expect(outbound).not.toHaveBeenCalled();
      expect(transport.store).not.toHaveBeenCalled();
    });
  },
);
