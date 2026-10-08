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
import { openContentTestDatabase } from "./helpers/content-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { getDb } from "../apps/backend/src/db";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import type { AppRouter } from "../apps/backend/src/routers";

// Global SQL maintenance needs its own fresh disposable DB, never parallel publishers.
describe.skipIf(
  !testDatabaseUrl || process.env.BACKEND_MEDIA_NAMES_ACCEPTANCE !== "1",
)("raw-camera filename cleanup over HTTP/JWT/MySQL", () => {
  let conn: Connection, app: INestApplication, base: string;
  const fixtures: [string | null, string | null][] = [
    ["IMG_1234.jpg", null],
    ["DSC-42.jpg", null],
    ["VID 7.mp4", null],
    ["MOV8.mov", null],
    ["PXL_9.jpg", null],
    ["Screenshot_1.png", null],
    ["Photo2.jpg", null],
    ["Video-3.mp4", null],
    ["Guide.pdf", "Guide.pdf"],
    ["IMG_notes.pdf", "IMG_notes.pdf"],
    ["prefix_IMG_123.jpg", "prefix_IMG_123.jpg"],
    ["IMG__123.jpg", "IMG__123.jpg"],
    ["Photoalbum.pdf", "Photoalbum.pdf"],
    ["", ""],
    [null, null],
  ];
  beforeAll(async () => {
    conn = await openContentTestDatabase();
    const [existing] = await conn.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS count FROM post_media",
    );
    expect(Number(existing[0].count), "Run alone on a new disposable DB").toBe(
      0,
    );
    vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
    vi.stubEnv("JWT_SECRET", "media-names-synthetic-secret-32");
    app = await createBackendApplication();
    await app.listen(0, "127.0.0.1");
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  async function cleanup() {
    await conn.query("DROP TRIGGER IF EXISTS media_names_refusal");
    await conn.query("DELETE FROM post_media WHERE id BETWEEN 8480 AND 8494");
    await conn.query("DELETE FROM posts WHERE id IN (8480,8481)");
    await conn.query("DELETE FROM users WHERE id BETWEEN 8480 AND 8482");
  }
  beforeEach(async () => {
    await cleanup();
    await conn.query(
      "INSERT INTO users (id,openId,role,sessionVersion) VALUES (8480,'media-names-admin','admin',0),(8481,'media-names-member','user',0),(8482,'media-names-moderator','moderator',0)",
    );
    await conn.query(
      "INSERT INTO posts (id,text,photos,tags) VALUES (8480,'First',JSON_ARRAY(),JSON_ARRAY()),(8481,'Second',JSON_ARRAY(),JSON_ARRAY())",
    );
    for (const [index, [filename]] of fixtures.entries()) {
      await conn.query(
        "INSERT INTO post_media (id,postId,type,url,filename,mimeType,fileSize,duration,sortOrder) VALUES (?,?, 'document',?,?, 'application/pdf',42,12,?)",
        [
          8480 + index,
          8480 + (index % 2),
          `https://example.invalid/${index}.pdf`,
          filename,
          index,
        ],
      );
    }
  });
  afterEach(async () => {
    await conn.query("DROP TRIGGER IF EXISTS media_names_refusal");
  });
  afterAll(async () => {
    await app?.close();
    if (conn) {
      await cleanup();
      await conn.end();
    }
    await (
      (await getDb()) as unknown as { $client: { end(): Promise<void> } }
    )?.$client.end();
    vi.unstubAllEnvs();
  });
  function client(actor: "admin" | "member" | "moderator" | null = "admin") {
    return createTRPCProxyClient<AppRouter>({
      links: [
        httpLink({
          url: `${base}/api/trpc`,
          transformer: superjson,
          headers: async () =>
            actor
              ? {
                  Authorization: `Bearer ${await sdk.createSessionToken(`media-names-${actor}`, { sessionVersion: 0 })}`,
                }
              : {},
        }),
      ],
    });
  }
  async function rows() {
    const [result] = await conn.query<RowDataPacket[]>(
      "SELECT id,postId,type,url,filename,mimeType,fileSize,duration,sortOrder,createdAt FROM post_media WHERE id BETWEEN 8480 AND 8494 ORDER BY id",
    );
    return result;
  }
  it("clears only recognized camera names across posts without changing attachment metadata", async () => {
    const before = await rows();
    expect(await client().admin.cleanupMediaNames.mutate()).toEqual({
      ok: true,
    });
    expect(await rows()).toEqual(
      before.map((row, index) => ({ ...row, filename: fixtures[index][1] })),
    );
  });
  it("retains the same rows on repeated cleanup", async () => {
    await client().admin.cleanupMediaNames.mutate();
    const before = await rows();
    expect(await client().admin.cleanupMediaNames.mutate()).toEqual({
      ok: true,
    });
    expect(await rows()).toEqual(before);
  });
  it("rolls back the SQL statement if a later matching row refuses an update", async () => {
    const before = await rows();
    await conn.query(`CREATE TRIGGER media_names_refusal BEFORE UPDATE ON post_media FOR EACH ROW
        BEGIN IF OLD.id=8481 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic private filename failure'; END IF; END`);
    await expect(
      client().admin.cleanupMediaNames.mutate(),
    ).rejects.toMatchObject({
      message: "Внутренняя ошибка сервера",
      data: { httpStatus: 500 },
    });
    expect(await rows()).toEqual(before);
  });
  it.each([null, "member", "moderator"] as const)(
    "refuses %s without changing filenames",
    async (actor) => {
      const before = await rows();
      await expect(
        client(actor).admin.cleanupMediaNames.mutate(),
      ).rejects.toMatchObject({ data: { httpStatus: actor ? 403 : 401 } });
      expect(await rows()).toEqual(before);
    },
  );
  it("refuses a blocked administrator without changing filenames", async () => {
    await conn.query(
      "UPDATE users SET blockedAt=CURRENT_TIMESTAMP WHERE id=8480",
    );
    const before = await rows();
    await expect(
      client().admin.cleanupMediaNames.mutate(),
    ).rejects.toMatchObject({ data: { httpStatus: 401 } });
    expect(await rows()).toEqual(before);
  });
});
