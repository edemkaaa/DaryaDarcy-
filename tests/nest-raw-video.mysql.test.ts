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
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import { getDb } from "../apps/backend/src/db";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import {
  mp4Fixture,
  movFixture,
  audioWebmFixture,
  mp3Fixture,
  wavFixture,
} from "./helpers/media-fixtures";
import {
  pdfFixture,
  docxFixture,
  zipFixture,
} from "./helpers/document-fixtures";

// Only provider transport is replaced: HTTP, raw parsing, JWT/live SQL and workers are real.
const storage = vi.hoisted(() => ({
  writes: [] as { key: string; bytes: Buffer; mime: string }[],
  fail: false,
}));
vi.mock("../apps/backend/src/storage", () => ({
  storagePut: async (key: string, bytes: Buffer, mime: string) => {
    if (storage.fail) throw new Error("PRIVATE_RAW_STORAGE fixture");
    storage.writes.push({ key, bytes, mime });
    return { key, url: "https://assets.example.test/native-raw-video" };
  },
}));

describe.skipIf(!testDatabaseUrl)(
  "native raw video upload over HTTP/JWT/MySQL",
  () => {
    let application: INestApplication,
      conn: Connection,
      base: string,
      bearer: string;
    async function upload(
      bytes: Buffer,
      mime: string | null = "video/mp4",
      token: string | null = bearer,
      filename = "lesson.mp4",
    ) {
      return fetch(
        `${base}/api/admin/upload-video?filename=${encodeURIComponent(filename)}`,
        {
          method: "POST",
          headers: {
            ...(mime === null ? {} : { "Content-Type": mime }),
            ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
          },
          body: new Uint8Array(bytes),
        },
      );
    }
    beforeAll(async () => {
      conn = await openTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "native-raw-video-fixture-secret-32-characters");
      vi.stubEnv("PUBLIC_APP_URL", "https://club.example.test");
      await conn.query(
        "INSERT INTO users (id,openId,role) VALUES (9020,'native-raw-video-admin','admin')",
      );
      application = await createBackendApplication();
      await application.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(application.getHttpServer().address() as AddressInfo).port}`;
      bearer = await sdk.createSessionToken("native-raw-video-admin", {
        sessionVersion: 0,
      });
    });
    beforeEach(async () => {
      storage.writes.length = 0;
      storage.fail = false;
      await conn.query(
        "UPDATE users SET role='admin',blockedAt=NULL,sessionVersion=0 WHERE id=9020",
      );
    });
    afterAll(async () => {
      await application?.close();
      if (conn) {
        await conn.query("DELETE FROM users WHERE id=9020");
        await conn.end();
      }
      await (
        (await getDb()) as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });

    it.each([
      ["HTML", Buffer.from("<html><script>fixture</script></html>")],
      ["SVG", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')],
      ["text", Buffer.from("not a video")],
      ["PDF", pdfFixture],
      ["DOCX", docxFixture],
      ["ZIP", zipFixture],
      ["MP3", mp3Fixture],
      ["WAV", wavFixture()],
      ["unrecognized binary", Buffer.from([0xff, 0x00, 0x12, 0x23])],
    ] as const)(
      "rejects %s bytes labelled as MP4 without a storage write",
      async (_name, bytes) => {
        const response = await upload(bytes);
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
          error: "Некорректный видеофайл",
        });
        expect(storage.writes).toEqual([]);
      },
    );

    it.each([
      "text/html",
      "image/svg+xml",
      "audio/mpeg",
      "application/json",
      "video/",
      "video/mp4;",
      'video/mp4; codecs="unclosed',
      "video/mp4; codecs=é",
    ])("rejects declared MIME %s even with valid MP4 bytes", async (mime) => {
      const response = await upload(mp4Fixture, mime);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "Некорректный видеофайл",
      });
      expect(storage.writes).toEqual([]);
    });

    it.each([
      ["MP4", mp4Fixture, "video/mp4", "video/mp4"],
      ["MP4 with absent header", mp4Fixture, null, "video/mp4"],
      [
        "MP4 picker fallback",
        mp4Fixture,
        "application/octet-stream",
        "video/mp4",
      ],
      ["mislabelled MP4", mp4Fixture, "video/webm", "video/mp4"],
      ["WebM container", audioWebmFixture, "video/webm", "video/webm"],
      [
        "mislabelled WebM container",
        audioWebmFixture,
        "video/mp4",
        "video/webm",
      ],
      [
        "normalized parameters",
        mp4Fixture,
        'VIDEO/MP4; codecs="avc1"',
        'video/mp4; codecs="avc1"',
      ],
      ["MOV", movFixture, "video/quicktime", "video/quicktime"],
      ["mislabelled MOV", movFixture, "video/mp4", "video/quicktime"],
    ] as const)(
      "stores %s unchanged with its canonical MIME and the URL-only response",
      async (_name, bytes, declared, canonical) => {
        const response = await upload(
          bytes,
          declared,
          bearer,
          "../../lesson.html",
        );
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
          url: "https://assets.example.test/native-raw-video",
        });
        expect(storage.writes).toHaveLength(1);
        expect(storage.writes[0].key).toMatch(
          /^feed\/reels\/\d+_lesson\.html$/,
        );
        expect(storage.writes[0].bytes).toEqual(bytes);
        expect(storage.writes[0].mime).toBe(canonical);
      },
    );

    it.each([
      ["role='user'", 403],
      ["role='moderator'", 403],
      ["blockedAt=NOW()", 401],
      ["sessionVersion=1", 401],
    ] as const)(
      "denies the original JWT after live identity changes: %s",
      async (patch, status) => {
        await conn.query(`UPDATE users SET ${patch} WHERE id=9020`);
        const response = await upload(
          Buffer.from("invalid video"),
          "video/mp4",
        );
        expect(response.status).toBe(status);
        expect(await response.json()).toEqual({
          error: status === 401 ? "Нужно войти" : "Нет доступа",
        });
        expect(storage.writes).toEqual([]);
      },
    );
    it("denies an anonymous raw request before inspecting its body", async () => {
      const response = await upload(Buffer.alloc(300_000), "video/mp4", null);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Нужно войти" });
      expect(storage.writes).toEqual([]);
    });
    it("retains the 80 MiB HTTP body limit without a storage write", async () => {
      const response = await upload(Buffer.alloc(80 * 1024 * 1024 + 1));
      expect(response.status).toBe(413);
      expect(await response.json()).toEqual({
        error: "Запрос слишком большой",
      });
      expect(storage.writes).toEqual([]);
    }, 10_000);
    it("retains the empty-body error without storage", async () => {
      const response = await upload(Buffer.alloc(0));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Пустой файл" });
      expect(storage.writes).toEqual([]);
    });
    it("keeps provider exception details out of response and logs", async () => {
      storage.fail = true;
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const response = await upload(mp4Fixture);
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({
          error: "Не удалось загрузить видео",
        });
        expect(storage.writes).toEqual([]);
        expect(log.mock.calls.flat().join(" ")).not.toContain(
          "PRIVATE_RAW_STORAGE",
        );
      } finally {
        log.mockRestore();
      }
    });
  },
);
