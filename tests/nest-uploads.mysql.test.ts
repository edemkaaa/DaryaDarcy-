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

// Only storage transport is replaced; image processing, sessions and SQL are real.
const storage = vi.hoisted(() => ({
  writes: [] as { key: string; bytes: Buffer; mime: string }[],
  fail: false,
}));
vi.mock("../apps/backend/src/storage", () => ({
  storagePut: async (key: string, bytes: Buffer, mime: string) => {
    if (storage.fail) throw new Error("PRIVATE_STORAGE_CREDENTIAL fixture");
    storage.writes.push({ key, bytes, mime });
    return { key, url: "https://assets.example.test/native-upload" };
  },
}));

describe.skipIf(!testDatabaseUrl)(
  "native admin uploads over HTTP/JWT/MySQL",
  () => {
    let application: INestApplication,
      conn: Connection,
      base: string,
      bearer: string;
    const client = (token?: string) =>
      createTRPCProxyClient<AppRouter>({
        links: [
          httpLink({
            url: base + "/api/trpc",
            transformer: superjson,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }),
        ],
      });
    const media = {
      base64: "Zml4dHVyZQ==",
      filename: "lesson.mp3",
      mimeType: "audio/mpeg",
      type: "audio" as const,
      postId: 9010,
    };
    const photo = {
      base64: Buffer.from("<html>not a JPEG</html>").toString("base64"),
      filename: "photo.jpg",
      mimeType: "image/jpeg",
    };
    const rows = async () => {
      const [records] = await conn.query<RowDataPacket[]>(
        "SELECT id,postId,type,url,filename,mimeType,fileSize,duration,sortOrder FROM post_media WHERE postId=9010 ORDER BY id",
      );
      return records;
    };
    beforeAll(async () => {
      conn = await openContentTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "native-upload-fixture-secret-32-characters");
      vi.stubEnv("PUBLIC_APP_URL", "https://club.example.test");
      await conn.query(
        "INSERT INTO users (id,openId,role) VALUES (9010,'native-upload-admin','admin')",
      );
      await conn.query(
        "INSERT INTO posts (id,text,photos,tags,status,published) VALUES (9010,'upload fixture',JSON_ARRAY(),JSON_ARRAY(),'draft',FALSE)",
      );
      application = await createBackendApplication();
      await application.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(application.getHttpServer().address() as AddressInfo).port}`;
      bearer = await sdk.createSessionToken("native-upload-admin", {
        sessionVersion: 0,
      });
    });
    beforeEach(async () => {
      storage.writes.length = 0;
      storage.fail = false;
      await conn.query(
        "UPDATE users SET role='admin',blockedAt=NULL,sessionVersion=0 WHERE id=9010",
      );
      await conn.query("DELETE FROM post_media WHERE postId=9010");
    });
    afterAll(async () => {
      await application?.close();
      if (conn) {
        await conn.query("DELETE FROM post_media WHERE postId=9010");
        await conn.query("DELETE FROM posts WHERE id=9010");
        await conn.query("DELETE FROM users WHERE id=9010");
        await conn.end();
      }
      await (
        (await getDb()) as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    it("stores server-owned WebP with orientation applied and metadata removed", async () => {
      const bytes = await sharp({
        create: { width: 12, height: 8, channels: 3, background: "red" },
      })
        .withMetadata({ orientation: 6 })
        .withExif({ IFD0: { Artist: "private fixture" } })
        .jpeg()
        .toBuffer();
      expect(
        await client(bearer).admin.uploadPhoto.mutate({
          base64: bytes.toString("base64"),
          filename: "../../secret.html",
          mimeType: "text/html",
        }),
      ).toEqual({ url: "https://assets.example.test/native-upload" });
      expect(storage.writes).toHaveLength(1);
      const write = storage.writes[0];
      expect(write.key).toMatch(/^feed\/photos\/[a-f0-9-]{36}\.webp$/);
      expect(write.mime).toBe("image/webp");
      expect(await sharp(write.bytes).metadata()).toMatchObject({
        format: "webp",
        width: 8,
        height: 12,
      });
      const metadata = await sharp(write.bytes).metadata();
      expect(metadata.exif).toBeUndefined();
      expect(metadata.orientation).toBeUndefined();
      expect(await rows()).toEqual([]);
    });
    it.each([
      "PGh0bWw+bm90IGEgSlBFRzwvaHRtbD4=",
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString(
        "base64",
      ),
      "YWJj!",
    ])(
      "rejects unsafe image bytes %s without storage or SQL effects",
      async (base64) => {
        await expect(
          client(bearer).admin.uploadPhoto.mutate({ ...photo, base64 }),
        ).rejects.toMatchObject({
          data: { code: "BAD_REQUEST", httpStatus: 400 },
        });
        expect(storage.writes).toEqual([]);
        expect(await rows()).toEqual([]);
      },
    );
    it.each([
      ["audio", "audio", "audio/mpeg", "lesson.mp3"],
      ["video", "videos", "video/mp4", "lesson.mp4"],
      ["document", "documents", "application/pdf", "lesson.pdf"],
    ] as const)(
      "stores %s and its complete association before returning",
      async (type, folder, mimeType, filename) => {
        const response = await client(bearer).admin.uploadMedia.mutate({
          ...media,
          type,
          mimeType,
          filename,
          duration: 42,
        });
        expect(response).toEqual({
          url: "https://assets.example.test/native-upload",
          mediaId: expect.any(Number),
        });
        expect(storage.writes).toHaveLength(1);
        expect(storage.writes[0].key).toMatch(
          new RegExp(`^feed/${folder}/[a-f0-9-]{36}$`),
        );
        expect(storage.writes[0].bytes).toEqual(Buffer.from("fixture"));
        expect(storage.writes[0].mime).toBe(mimeType);
        expect(await rows()).toEqual([
          {
            id: response.mediaId,
            postId: 9010,
            type,
            url: "https://assets.example.test/native-upload",
            filename,
            mimeType,
            fileSize: 7,
            duration: 42,
            sortOrder: 0,
          },
        ]);
      },
    );
    it.each(["IMG_1234.mp3", ""])(
      "suppresses raw filename %s and defaults duration",
      async (filename) => {
        const response = await client(bearer).admin.uploadMedia.mutate({
          ...media,
          filename,
        });
        expect(storage.writes[0].key).toMatch(/^feed\/audio\/[a-f0-9-]{36}$/);
        expect(await rows()).toEqual([
          {
            id: response.mediaId,
            postId: 9010,
            type: "audio",
            url: "https://assets.example.test/native-upload",
            filename: null,
            mimeType: "audio/mpeg",
            fileSize: 7,
            duration: null,
            sortOrder: 0,
          },
        ]);
      },
    );
    it("keeps standalone uploads unassociated for absent or zero postId", async () => {
      const { postId: _postId, ...standalone } = media;
      for (const input of [standalone, { ...standalone, postId: 0 }])
        expect(await client(bearer).admin.uploadMedia.mutate(input)).toEqual({
          url: "https://assets.example.test/native-upload",
          mediaId: undefined,
        });
      expect(storage.writes).toHaveLength(2);
      expect(await rows()).toEqual([]);
    });
    it.each([
      "",
      "Zml4dHVyZQ",
      "Zml4dHVyZQ==!",
      "Zml4\ndHVyZQ==",
      "Zml4dHVyZQ====",
      "data:audio/mpeg;base64,Zml4dHVyZQ==",
      "-_8=",
      "Zh==",
      "====",
    ])(
      "rejects malformed media base64 %j before storing or associating",
      async (base64) => {
        await expect(
          client(bearer).admin.uploadMedia.mutate({ ...media, base64 }),
        ).rejects.toMatchObject({
          data: { code: "BAD_REQUEST", httpStatus: 400 },
        });
        expect(storage.writes).toEqual([]);
        expect(await rows()).toEqual([]);
      },
    );
    it.each([
      ["Zg==", "f"],
      ["Zm8=", "fo"],
      ["Zm9v", "foo"],
    ])("preserves canonical media padding for %s", async (base64, text) => {
      await client(bearer).admin.uploadMedia.mutate({ ...media, base64 });
      expect(storage.writes[0].bytes).toEqual(Buffer.from(text));
      expect(await rows()).toMatchObject([{ fileSize: text.length }]);
    });
    it.each([
      "../../private/file.mp3?token=x#part",
      "C:\\private\\lesson.mp3",
      "Урок #1 ?.mp3",
    ])("keeps filename %s out of the object key", async (filename) => {
      await client(bearer).admin.uploadMedia.mutate({ ...media, filename });
      expect(storage.writes[0].key).toMatch(/^feed\/audio\/[a-f0-9-]{36}$/);
      // Display metadata remains separate from object identity, as before.
      expect(await rows()).toMatchObject([{ filename }]);
    });
    it("does not overwrite same-name uploads within one millisecond", async () => {
      const now = vi.spyOn(Date, "now").mockReturnValue(Date.now());
      try {
        const responses = await Promise.all(
          ["first", "second"].map((text) =>
            client(bearer).admin.uploadMedia.mutate({
              ...media,
              base64: Buffer.from(text).toString("base64"),
            }),
          ),
        );
        expect(storage.writes).toHaveLength(2);
        expect(new Set(storage.writes.map((write) => write.key)).size).toBe(2);
        expect(
          new Set(responses.map((response) => response.mediaId)).size,
        ).toBe(2);
        expect(await rows()).toHaveLength(2);
      } finally {
        now.mockRestore();
      }
    });
    it.each([
      ["role='user'", 403],
      ["role='moderator'", 403],
      ["blockedAt=NOW()", 401],
      ["sessionVersion=1", 401],
    ] as const)(
      "rechecks live identity after %s before either upload",
      async (patch, httpStatus) => {
        await conn.query(`UPDATE users SET ${patch} WHERE id=9010`);
        // The pre-parser guard returns plain HTTP JSON, not a tRPC envelope.
        for (const method of ["uploadPhoto", "uploadMedia"]) {
          const response = await fetch(`${base}/api/trpc/admin.${method}`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${bearer}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              json: method === "uploadPhoto" ? photo : media,
            }),
          });
          expect(response.status).toBe(httpStatus);
          expect(await response.json()).toEqual({
            error: httpStatus === 401 ? "Нужно войти" : "Нет доступа",
          });
        }
        expect(storage.writes).toEqual([]);
        expect(await rows()).toEqual([]);
      },
    );
    it("denies anonymous uploads before allocating an oversized body", async () => {
      for (const method of ["uploadPhoto", "uploadMedia"]) {
        const response = await fetch(`${base}/api/trpc/admin.${method}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: "x".repeat(300_000) }),
        });
        expect(response.status).toBe(401);
      }
      expect(storage.writes).toEqual([]);
      expect(await rows()).toEqual([]);
    });
    it("does not create an association or leak details after external storage fails", async () => {
      storage.fail = true;
      await expect(
        client(bearer).admin.uploadMedia.mutate(media),
      ).rejects.toMatchObject({
        message: "Внутренняя ошибка сервера",
        data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
      });
      expect(storage.writes).toEqual([]);
      expect(await rows()).toEqual([]);
    });
    it("reports SQL failure rather than returning a successful uploaded association", async () => {
      await conn.query(
        `CREATE TRIGGER backend_test_upload_failure BEFORE INSERT ON post_media FOR EACH ROW BEGIN IF NEW.postId=9010 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PRIVATE_SQL_FAILURE fixture'; END IF; END`,
      );
      try {
        await expect(
          client(bearer).admin.uploadMedia.mutate(media),
        ).rejects.toMatchObject({
          message: "Внутренняя ошибка сервера",
          data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
        });
        expect(await rows()).toEqual([]);
        // Current API leaves a stored object after failed association; cleanup is separate.
        expect(storage.writes).toHaveLength(1);
      } finally {
        await conn.query("DROP TRIGGER backend_test_upload_failure");
      }
    });
  },
);
