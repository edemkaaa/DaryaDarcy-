import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  createServer,
  request,
  type Server,
  type ClientRequest,
} from "node:http";
import type { AddressInfo } from "node:net";
import type { Connection, Pool } from "mysql2/promise";
import sharp from "sharp";
import type { INestApplication } from "@nestjs/common";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { getDb } from "../apps/backend/src/db";
import { sdk } from "../apps/backend/src/_core/sdk";

describe.skipIf(!testDatabaseUrl)(
  "public upload HTTP disconnect on disposable SQL and loopback S3",
  () => {
    let conn: Connection,
      app: INestApplication,
      storage: Server,
      base: string,
      bearer: string,
      body: string;
    let accept: () => void, closed: boolean;
    let pending: ClientRequest | undefined;
    beforeAll(async () => {
      conn = await openTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "public-upload-disconnect-synthetic-32");
      await conn.query(
        "INSERT INTO users(id,openId,role,avatarUrl) VALUES(99290,'upload-disconnect-owner','admin','https://example.test/old.webp')",
      );
      storage = createServer((req, res) => {
        req.resume();
        res.on("close", () => {
          closed = true;
        });
        req.on("end", () => accept());
      });
      await new Promise<void>((resolve) =>
        storage.listen(0, "127.0.0.1", resolve),
      );
      vi.stubEnv(
        "S3_ENDPOINT",
        `http://127.0.0.1:${(storage.address() as AddressInfo).port}`,
      );
      vi.stubEnv("S3_BUCKET", "synthetic-uploads");
      vi.stubEnv("S3_ACCESS_KEY", "synthetic");
      vi.stubEnv("S3_SECRET_KEY", "synthetic-secret");
      body = (
        await sharp({
          create: {
            width: 16,
            height: 16,
            channels: 4,
            background: { r: 80, g: 90, b: 100, alpha: 0.5 },
          },
        })
          .png()
          .toBuffer()
      ).toString("base64");
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
      bearer = await sdk.createSessionToken("upload-disconnect-owner", {
        sessionVersion: 0,
      });
    });
    afterEach(() => {
      pending?.destroy();
      storage.closeAllConnections();
    });
    afterAll(async () => {
      await app?.close();
      storage?.closeAllConnections();
      if (storage)
        await new Promise<void>((resolve) => storage.close(() => resolve()));
      await conn?.query(
        "DELETE FROM users WHERE id=99290 AND openId='upload-disconnect-owner'",
      );
      await conn?.end();
      const db = await getDb();
      await (db as unknown as { $client: Pool })?.$client.end();
      vi.unstubAllEnvs();
    });
    it.each(["profile.uploadAvatar", "admin.uploadPhoto"])(
      "stops %s storage work after the actual client disconnects",
      async (name) => {
        closed = false;
        const received = new Promise<void>((resolve) => {
          accept = resolve;
        });
        const wire = JSON.stringify({
          json: {
            base64: body,
            filename: "fixture.png",
            mimeType: "image/png",
            ...(name === "admin.uploadPhoto" ? { purpose: "publicCover" } : {}),
          },
        });
        pending = request(base + "/api/trpc/" + name, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${bearer}`,
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(wire),
          },
        });
        pending.on("error", () => {});
        pending.end(wire);
        await received;
        pending.destroy();
        await vi.waitFor(() => expect(closed).toBe(true), {
          timeout: 1200,
          interval: 20,
        });
        const [rows] = await conn.query(
          "SELECT avatarUrl FROM users WHERE id=99290",
        );
        expect(rows).toEqual([{ avatarUrl: "https://example.test/old.webp" }]);
      },
    );
  },
);
