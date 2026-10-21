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
import type { Connection, RowDataPacket } from "mysql2/promise";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import sharp from "sharp";
import { openContentTestDatabase } from "./helpers/content-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import type { AppRouter } from "../apps/backend/src/routers";
import { sdk } from "../apps/backend/src/_core/sdk";
import { getDb } from "../apps/backend/src/db";
import { mp3Fixture } from "./helpers/media-fixtures";

const storage = vi.hoisted(() => ({ put: vi.fn() }));
vi.mock("../apps/backend/src/storage", () => ({ storagePut: storage.put }));

// HTTP/JWT/SQL/photo processing are real; only the external storage is doubled.
// Media type policy now has its own direct regression suite; the retired public
// endpoints must not succeed just to exercise that policy.
describe.skipIf(!testDatabaseUrl)(
  "public cover purpose and retired legacy uploads over HTTP/JWT/MySQL",
  () => {
    let conn: Connection,
      app: INestApplication,
      base: string,
      token: string,
      photo: string;
    let ownsFixtures = false;
    const client = () =>
      createTRPCProxyClient<AppRouter>({
        links: [
          httpLink({
            url: base + "/api/trpc",
            transformer: superjson,
            headers: { authorization: `Bearer ${token}` },
          }),
        ],
      });
    const post = (procedure: string, input: unknown) =>
      fetch(`${base}/api/trpc/${procedure}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ json: input }),
      });
    const rows = async () => {
      const [records] = await conn.query<RowDataPacket[]>(
        "SELECT * FROM post_media WHERE postId=9010 ORDER BY id",
      );
      return records;
    };
    beforeAll(async () => {
      conn = await openContentTestDatabase();
      const [existing] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM users WHERE id=9010 UNION ALL SELECT id FROM posts WHERE id=9010",
      );
      if (existing.length || (await rows()).length)
        throw new Error("Upload fixture IDs occupied");
      await conn.query(
        "INSERT INTO users(id,openId,role,sessionVersion) VALUES (9010,'native-upload-admin','admin',0)",
      );
      ownsFixtures = true;
      await conn.query(
        "INSERT INTO posts(id,text,photos,tags,status,published) VALUES(9010,'synthetic',JSON_ARRAY(),JSON_ARRAY(),'draft',FALSE)",
      );
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "native-upload-fixture-secret-32-characters");
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
      token = await sdk.createSessionToken("native-upload-admin", {
        sessionVersion: 0,
      });
      photo = (
        await sharp({
          create: { width: 12, height: 8, channels: 3, background: "red" },
        })
          .withMetadata({ orientation: 6 })
          .jpeg()
          .toBuffer()
      ).toString("base64");
    });
    beforeEach(async () => {
      storage.put.mockReset().mockResolvedValue({
        key: "synthetic-cover",
        url: "https://assets.example.test/cover.webp",
      });
      await conn.query(
        "UPDATE users SET role='admin',blockedAt=NULL,sessionVersion=0 WHERE id=9010",
      );
    });
    afterAll(async () => {
      await app?.close();
      if (ownsFixtures) {
        await conn.query("DELETE FROM post_media WHERE postId=9010");
        await conn.query("DELETE FROM posts WHERE id=9010");
        await conn.query(
          "DELETE FROM users WHERE id=9010 AND openId='native-upload-admin'",
        );
      }
      await conn?.end();
      if (app)
        await (
          (await getDb()) as unknown as { $client: { end(): Promise<void> } }
        )?.$client.end();
      vi.unstubAllEnvs();
    });
    it("normalizes an explicitly public cover without creating post attachments", async () => {
      expect(
        await client().admin.uploadPhoto.mutate({
          base64: photo,
          filename: "../../cover.jpg",
          purpose: "publicCover",
        }),
      ).toEqual({ url: "https://assets.example.test/cover.webp" });
      expect(storage.put).toHaveBeenCalledTimes(1);
      const [key, bytes, mime] = storage.put.mock.calls[0];
      expect(key).toMatch(/^covers\/[a-f0-9-]{36}\.webp$/);
      expect(mime).toBe("image/webp");
      const metadata = await sharp(bytes).metadata();
      expect(metadata).toMatchObject({ format: "webp", width: 8, height: 12 });
      expect(metadata.exif).toBeUndefined();
      expect(await rows()).toEqual([]);
    });
    it("refuses missing purpose without a storage write", async () => {
      await expect(
        client().admin.uploadPhoto.mutate({
          base64: photo,
          filename: "x.jpg",
        } as never),
      ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } });
      expect(storage.put).not.toHaveBeenCalled();
    });
    it.each(["audio", "video", "document"] as const)(
      "retired %s media cannot create an object or association",
      async (type) => {
        const response = await post("admin.uploadMedia", {
          base64: mp3Fixture.toString("base64"),
          filename: "x",
          type,
          mimeType: "audio/mpeg",
          postId: 9010,
        });
        expect(response.status).toBe(404);
        expect(storage.put).not.toHaveBeenCalled();
        expect(await rows()).toEqual([]);
      },
    );
    it("unpaid member cannot use legacy public comment upload", async () => {
      await conn.query("UPDATE users SET role='user' WHERE id=9010");
      const response = await post("club.uploadCommentPhoto", {
        base64: photo,
        filename: "x.jpg",
      });
      expect(response.status).toBe(404);
      expect(storage.put).not.toHaveBeenCalled();
    });
    it.each(["user", "moderator"])(
      "%s cannot create public covers",
      async (role) => {
        await conn.query("UPDATE users SET role=? WHERE id=9010", [role]);
        const response = await post("admin.uploadPhoto", {
          base64: photo,
          filename: "x.jpg",
          purpose: "publicCover",
        });
        expect(response.status).toBe(403);
        expect(storage.put).not.toHaveBeenCalled();
      },
    );
    it("cover storage failure remains a generic server error without an association", async () => {
      storage.put.mockRejectedValue(new Error("PRIVATE_STORAGE_FAILURE"));
      await expect(
        client().admin.uploadPhoto.mutate({
          base64: photo,
          filename: "x.jpg",
          purpose: "publicCover",
        }),
      ).rejects.toMatchObject({
        message: "Внутренняя ошибка сервера",
        data: { httpStatus: 500 },
      });
      expect(await rows()).toEqual([]);
    });
  },
);
