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
import {
  mp3Fixture,
  mp4Fixture,
  audioWebmFixture,
  wavFixture,
} from "./helpers/media-fixtures";
import {
  docxMime,
  docxFixture,
  docmFixture,
  pdfFixture,
  zipFixture,
} from "./helpers/document-fixtures";
import {
  utf8Text,
  cp1251Text,
  utf16leText,
  utf16beText,
} from "./helpers/text-fixtures";

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
      base64: mp3Fixture.toString("base64"),
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
        const bytes =
          type === "audio"
            ? mp3Fixture
            : type === "video"
              ? mp4Fixture
              : pdfFixture;
        const response = await client(bearer).admin.uploadMedia.mutate({
          ...media,
          base64: bytes.toString("base64"),
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
        expect(storage.writes[0].bytes).toEqual(bytes);
        expect(storage.writes[0].mime).toBe(mimeType);
        expect(await rows()).toEqual([
          {
            id: response.mediaId,
            postId: 9010,
            type,
            url: "https://assets.example.test/native-upload",
            filename,
            mimeType,
            fileSize: bytes.length,
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
            fileSize: mp3Fixture.length,
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
      await client(bearer).admin.uploadMedia.mutate({
        ...media,
        type: "document",
        mimeType: "text/plain",
        base64,
      });
      expect(storage.writes[0].bytes).toEqual(Buffer.from(text));
      expect(await rows()).toMatchObject([{ fileSize: text.length }]);
    });
    it.each([
      ["HTML", Buffer.from("<html><script>alert(1)</script></html>")],
      ["SVG", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')],
      ["PDF", Buffer.from("%PDF-1.7\nnot an audio or video file")],
      [
        "ZIP",
        Buffer.from(
          "504b030414000000000000000000000000000000000000000000000000",
          "hex",
        ),
      ],
      ["unknown", Buffer.from("not a media file")],
      ["truncated MP4", Buffer.from("0000001866747970", "hex")],
    ])(
      "rejects %s bytes disguised as audio or video before any write",
      async (_name, bytes) => {
        for (const type of ["audio", "video"] as const) {
          await expect(
            client(bearer).admin.uploadMedia.mutate({
              ...media,
              type,
              mimeType: type === "audio" ? "audio/mpeg" : "video/mp4",
              base64: bytes.toString("base64"),
            }),
          ).rejects.toMatchObject({
            data: { code: "BAD_REQUEST", httpStatus: 400 },
          });
          expect(storage.writes).toEqual([]);
          expect(await rows()).toEqual([]);
        }
      },
    );
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
    it.each(
      (
        [
          ["HTML", Buffer.from("<html><script>alert(1)</script></html>")],
          ["SVG", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')],
          ["MP3", mp3Fixture],
          ["ordinary ZIP", zipFixture],
          ["macro-enabled Word package", docmFixture],
          ["unrecognized text", Buffer.from("not a PDF or DOCX")],
        ] as const
      ).flatMap(([name, bytes]) =>
        ["application/pdf", docxMime].map(
          (mimeType) => [name, mimeType, bytes] as const,
        ),
      ),
    )(
      "rejects %s bytes declared as %s document before any write",
      async (_name, mimeType, bytes) => {
        await expect(
          client(bearer).admin.uploadMedia.mutate({
            ...media,
            type: "document",
            filename: "lesson.pdf",
            mimeType,
            base64: bytes.toString("base64"),
          }),
        ).rejects.toMatchObject({
          data: { code: "BAD_REQUEST", httpStatus: 400 },
        });
        expect(storage.writes).toEqual([]);
        expect(await rows()).toEqual([]);
      },
    );
    it.each([
      ["PDF as DOCX", pdfFixture, docxMime],
      ["DOCX as PDF", docxFixture, "application/pdf"],
    ] as const)(
      "rejects the document format swap %s",
      async (_name, bytes, mimeType) => {
        await expect(
          client(bearer).admin.uploadMedia.mutate({
            ...media,
            type: "document",
            mimeType,
            base64: bytes.toString("base64"),
          }),
        ).rejects.toMatchObject({
          data: { code: "BAD_REQUEST", httpStatus: 400 },
        });
        expect(storage.writes).toEqual([]);
        expect(await rows()).toEqual([]);
      },
    );
    it.each([
      [
        "PDF",
        pdfFixture,
        ' APPLICATION/PDF ; version="1.4"',
        'application/pdf; version="1.4"',
      ],
      [
        "DOCX",
        docxFixture,
        `${docxMime}; fixture=token`,
        `${docxMime}; fixture=token`,
      ],
    ] as const)(
      "preserves %s bytes and valid MIME parameters after detection",
      async (_name, bytes, mimeType, canonical) => {
        const response = await client(bearer).admin.uploadMedia.mutate({
          ...media,
          type: "document",
          base64: bytes.toString("base64"),
          mimeType,
        });
        expect(storage.writes).toHaveLength(1);
        expect(storage.writes[0]).toMatchObject({ bytes, mime: canonical });
        expect(await rows()).toMatchObject([
          {
            id: response.mediaId,
            type: "document",
            mimeType: canonical,
            fileSize: bytes.length,
          },
        ]);
      },
    );
    it.each([
      ["PDF", pdfFixture, "application/pdf"],
      ["DOCX", docxFixture, docxMime],
      ["TXT", utf8Text, "text/plain"],
      ["opaque PDF", pdfFixture, "application/octet-stream"],
    ] as const)(
      "keeps standalone %s uploads unassociated",
      async (_name, bytes, mimeType) => {
        const { postId: _postId, ...standalone } = media;
        await expect(
          client(bearer).admin.uploadMedia.mutate({
            ...standalone,
            type: "document",
            base64: bytes.toString("base64"),
            mimeType,
          }),
        ).resolves.toEqual({
          url: "https://assets.example.test/native-upload",
          mediaId: undefined,
        });
        expect(storage.writes[0].bytes).toEqual(bytes);
        expect(await rows()).toEqual([]);
      },
    );
    it("does not overwrite same-name uploads within one millisecond", async () => {
      const now = vi.spyOn(Date, "now").mockReturnValue(Date.now());
      try {
        const responses = await Promise.all(
          [1, 2].map((sample) =>
            client(bearer).admin.uploadMedia.mutate({
              ...media,
              mimeType: "audio/wav",
              base64: wavFixture(sample).toString("base64"),
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
    it.each(
      (
        [
          ["PDF", pdfFixture],
          ["DOCX", docxFixture],
          ["macro-labelled Word", docmFixture],
          ["ZIP", zipFixture],
          ["MP3", mp3Fixture],
          ["MP4", mp4Fixture],
          [
            "generic CFB magic (not a valid DOC)",
            Buffer.from("d0cf11e0a1b11ae10000000000000000", "hex"),
          ],
        ] as const
      ).flatMap(([name, bytes]) =>
        (name === "PDF" || name === "DOCX"
          ? ["text/plain"]
          : ["text/plain", "application/octet-stream"]
        ).map((mimeType) => [name, bytes, mimeType] as const),
      ),
    )(
      "rejects %s bytes that bypass document type checking",
      async (_name, bytes, mimeType) => {
        await expect(
          client(bearer).admin.uploadMedia.mutate({
            ...media,
            type: "document",
            mimeType,
            base64: bytes.toString("base64"),
          }),
        ).rejects.toMatchObject({
          data: { code: "BAD_REQUEST", httpStatus: 400 },
        });
        expect(storage.writes).toEqual([]);
        expect(await rows()).toEqual([]);
      },
    );
    it.each([
      ["invalid UTF-8", Buffer.from([0xff, 0x41]), "text/plain"],
      ["opaque binary", Buffer.from([0xff, 0x41]), "application/octet-stream"],
      ["NUL", Buffer.from("hello\0world"), "text/plain"],
      ["opaque NUL", Buffer.from("hello\0world"), "application/octet-stream"],
      ["escape control", Buffer.from("hello\u001bworld"), "text/plain"],
      ["C1 control", Buffer.from("hello\u0085world"), "text/plain"],
      ["unsupported charset", utf8Text, "text/plain; charset=shift_jis"],
      [
        "duplicate charset",
        utf8Text,
        "text/plain; charset=utf-8; CHARSET=windows-1251",
      ],
      ["empty charset", utf8Text, 'text/plain; charset=""'],
      ["missing legacy charset", cp1251Text, "text/plain"],
      [
        "opaque legacy text",
        cp1251Text,
        "application/octet-stream; charset=windows-1251",
      ],
      ["BOM conflict", utf16beText, "text/plain; charset=utf-16le"],
      [
        "UTF-8 BOM conflict",
        Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), utf8Text]),
        "text/plain; charset=windows-1251",
      ],
      [
        "resolved MIME exceeds SQL ceiling",
        utf8Text,
        `text/plain; note="${"a".repeat(109)}"`,
      ],
      ["truncated UTF-16", Buffer.from([0xff, 0xfe, 0x41]), "text/plain"],
      [
        "unpaired UTF-16 surrogate",
        Buffer.from("fffe00d8", "hex"),
        "text/plain",
      ],
      [
        "invalid UTF-8 past a chunk boundary",
        Buffer.concat([Buffer.alloc(16_384, 0x61), Buffer.from([0xe2, 0x82])]),
        "text/plain",
      ],
      [
        "control past a chunk boundary",
        Buffer.concat([Buffer.alloc(16_384, 0x61), Buffer.from([0])]),
        "text/plain",
      ],
    ] as const)(
      "rejects document text with %s before any write",
      async (_name, bytes, mimeType) => {
        await expect(
          client(bearer).admin.uploadMedia.mutate({
            ...media,
            type: "document",
            mimeType,
            base64: bytes.toString("base64"),
          }),
        ).rejects.toMatchObject({
          data: { code: "BAD_REQUEST", httpStatus: 400 },
        });
        expect(storage.writes).toEqual([]);
        expect(await rows()).toEqual([]);
      },
    );
    it.each([
      ["UTF-8", utf8Text, "text/plain", "text/plain; charset=utf-8"],
      [
        "UTF-8 alias",
        utf8Text,
        'text/plain; CHARSET="utf8"',
        'text/plain; CHARSET="utf8"',
      ],
      [
        "UTF-16LE BOM",
        utf16leText,
        "text/plain",
        "text/plain; charset=utf-16le",
      ],
      [
        "UTF-16BE BOM",
        utf16beText,
        "text/plain",
        "text/plain; charset=utf-16be",
      ],
      [
        "UTF-16 without BOM",
        Buffer.from("Привет!", "utf16le"),
        "text/plain; charset=utf-16",
        "text/plain; charset=utf-16",
      ],
      [
        "Windows-1251",
        cp1251Text,
        "text/plain; charset=windows-1251",
        "text/plain; charset=windows-1251",
      ],
      [
        "resolved MIME at SQL ceiling",
        utf8Text,
        `text/plain; note="${"a".repeat(94)}"`,
        `text/plain; note="${"a".repeat(94)}"; charset=utf-8`,
      ],
      [
        "quoted escaped charset",
        utf8Text,
        'text/plain; charset="utf\\-8"',
        'text/plain; charset="utf\\-8"',
      ],
      [
        "charset inside another parameter",
        utf8Text,
        'text/plain; note=";charset=windows-1251"',
        'text/plain; note=";charset=windows-1251"; charset=utf-8',
      ],
      [
        "literal markup",
        Buffer.from("<html><script>example only</script></html>"),
        "text/plain",
        "text/plain; charset=utf-8",
      ],
      [
        "split UTF-8 character",
        Buffer.concat([Buffer.alloc(16_383, 0x61), Buffer.from("🙂")]),
        "text/plain",
        "text/plain; charset=utf-8",
      ],
      [
        "split UTF-16 surrogate pair",
        Buffer.concat([
          Buffer.from([0xff, 0xfe]),
          Buffer.from("a".repeat(8_190) + "🙂", "utf16le"),
        ]),
        "text/plain",
        "text/plain; charset=utf-16le",
      ],
      [
        "opaque PDF",
        pdfFixture,
        "application/octet-stream; charset=invalid",
        "application/pdf",
      ],
      ["opaque DOCX", docxFixture, "application/octet-stream", docxMime],
      [
        "opaque UTF-8",
        utf8Text,
        "application/octet-stream",
        "text/plain; charset=utf-8",
      ],
      [
        "opaque UTF-16BE",
        utf16beText,
        "application/octet-stream",
        "text/plain; charset=utf-16be",
      ],
    ] as const)(
      "stores %s with byte-preserving resolved MIME",
      async (_name, bytes, mimeType, canonical) => {
        const response = await client(bearer).admin.uploadMedia.mutate({
          ...media,
          type: "document",
          mimeType,
          base64: bytes.toString("base64"),
        });
        expect(storage.writes).toHaveLength(1);
        expect(storage.writes[0].bytes).toEqual(bytes);
        expect(storage.writes[0].mime).toBe(canonical);
        expect(await rows()).toMatchObject([
          {
            id: response.mediaId,
            type: "document",
            fileSize: bytes.length,
            mimeType: canonical,
          },
        ]);
      },
    );
    it.each([
      ["audio", "text/html"],
      ["video", "text/html"],
      ["document", "text/html"],
      ["audio", "image/svg+xml"],
      ["video", "image/svg+xml"],
      ["document", "image/svg+xml"],
      ["audio", "application/pdf"],
      ["document", "audio/mpeg"],
      ["document", "application/javascript"],
      ["document", "text/xml"],
      ["video", "application/x-msdownload"],
      ["audio", ""],
      ["audio", "audio/"],
      ["audio", "audio/mpeg/extra"],
      ["audio", "audio/mpeg\r\nX-Injected: yes"],
      ["audio", "audio/" + "x".repeat(124)],
      ["audio", "audio/mpeg;garbage"],
      ["audio", "audio/mpeg; codecs=opus, text/html"],
      ["document", 'text/plain; charset="utf-8'],
    ] as const)(
      "rejects incompatible or invalid %s Content-Type %j before any write",
      async (type, mimeType) => {
        await expect(
          client(bearer).admin.uploadMedia.mutate({
            ...media,
            type,
            filename: "lesson.pdf",
            base64: Buffer.from("<html>not a media file</html>").toString(
              "base64",
            ),
            mimeType,
          }),
        ).rejects.toMatchObject({
          data: { code: "BAD_REQUEST", httpStatus: 400 },
        });
        expect(storage.writes).toEqual([]);
        expect(await rows()).toEqual([]);
      },
    );
    it("corrects a misleading same-family MIME without changing the uploaded bytes", async () => {
      const bytes = wavFixture();
      await client(bearer).admin.uploadMedia.mutate({
        ...media,
        mimeType: 'audio/mpeg; codecs="mp3"',
        base64: bytes.toString("base64"),
      });
      expect(storage.writes[0]).toMatchObject({ mime: "audio/wav", bytes });
      expect(await rows()).toMatchObject([
        { mimeType: "audio/wav", fileSize: bytes.length },
      ]);
    });
    it.each([mp3Fixture, wavFixture()])(
      "rejects an unambiguous audio signature in the video category",
      async (bytes) => {
        await expect(
          client(bearer).admin.uploadMedia.mutate({
            ...media,
            type: "video",
            mimeType: "video/mp4",
            base64: bytes.toString("base64"),
          }),
        ).rejects.toMatchObject({
          data: { code: "BAD_REQUEST", httpStatus: 400 },
        });
        expect(storage.writes).toEqual([]);
        expect(await rows()).toEqual([]);
      },
    );
    it("accepts the generic MP4 container for the audio category without claiming track validation", async () => {
      await client(bearer).admin.uploadMedia.mutate({
        ...media,
        mimeType: "application/octet-stream",
        base64: mp4Fixture.toString("base64"),
      });
      expect(storage.writes[0].mime).toBe("audio/mp4");
      expect(await rows()).toMatchObject([{ mimeType: "audio/mp4" }]);
    });
    it.each([
      ["document", "application/pdf", "application/pdf", pdfFixture],
      // Legacy DOC remains metadata-only until a Word-specific detector is reviewed.
      [
        "document",
        "application/msword",
        "application/msword",
        Buffer.from("fixture"),
      ],
      [
        "document",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        docxFixture,
      ],
      [
        "document",
        "text/plain; charset=windows-1251",
        "text/plain; charset=windows-1251",
        Buffer.from("fixture"),
      ],
      [
        "document",
        "application/octet-stream",
        "text/plain; charset=utf-8",
        Buffer.from("fixture"),
      ],
      ["audio", " Audio/MPEG ", "audio/mpeg", mp3Fixture],
      [
        "audio",
        'audio/webm; codecs="opus"',
        'audio/webm; codecs="opus"',
        audioWebmFixture,
      ],
      ["audio", "audio/x-wav", "audio/wav", wavFixture()],
      ["audio", "application/octet-stream", "audio/mpeg", mp3Fixture],
      ["video", "VIDEO/MP4", "video/mp4", mp4Fixture],
      ["video", "application/octet-stream", "video/mp4", mp4Fixture],
    ] as const)(
      "stores resolved %s MIME %s consistently",
      async (type, mimeType, canonical, bytes) => {
        const response = await client(bearer).admin.uploadMedia.mutate({
          ...media,
          base64: bytes.toString("base64"),
          type,
          mimeType,
        });
        expect(storage.writes).toHaveLength(1);
        expect(storage.writes[0].mime).toBe(canonical);
        expect(await rows()).toMatchObject([
          {
            id: response.mediaId,
            type,
            mimeType: canonical,
            filename: "lesson.mp3",
            fileSize: bytes.length,
          },
        ]);
      },
    );
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
