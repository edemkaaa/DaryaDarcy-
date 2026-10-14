import {
  afterAll,
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
import superjson from "superjson";
import { openContentTestDatabase } from "./helpers/content-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { openPrivateUploadWire } from "./helpers/private-upload-wire";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import { getDb } from "../apps/backend/src/db";

describe.skipIf(!testDatabaseUrl)(
  "private upload native HTTP/SQL and SDK wire",
  () => {
    let conn: Connection, app: INestApplication, base: string, token: string;
    let wire: Awaited<ReturnType<typeof openPrivateUploadWire>>;
    const input = {
      idempotencyKey: "private-upload-intent-0001",
      type: "document",
      filename: "fixture.txt",
      mimeType: "text/plain",
      base64: Buffer.from("0123456789").toString("base64"),
    };
    async function request(
      method: string,
      value: unknown = input,
      bearer: string | null = token,
      query = false,
    ) {
      const body = superjson.stringify(value);
      const response = await fetch(
        `${base}/api/trpc/admin.${method}${query ? `?input=${encodeURIComponent(body)}` : ""}`,
        {
          method: query ? "GET" : "POST",
          headers: {
            "content-type": "application/json",
            ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
          },
          ...(query ? {} : { body }),
          signal: AbortSignal.timeout(20000),
        },
      );
      const json = await response.json();
      return {
        status: response.status,
        data: json.result
          ? superjson.deserialize<Record<string, unknown>>(json.result.data)
          : json.error?.json?.data?.code,
      };
    }
    async function rows(sql: string, args: unknown[] = []) {
      return (await conn.query<RowDataPacket[]>(sql, args))[0];
    }
    beforeAll(async () => {
      conn = await openContentTestDatabase();
      wire = await openPrivateUploadWire();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "ag4-fixture-session-secret-32-characters");
      vi.stubEnv("PRIVATE_POST_MEDIA_UPLOAD_ENABLED", "true");
      vi.stubEnv("S3_ENDPOINT", wire.endpoint);
      vi.stubEnv("S3_BUCKET", wire.bucket);
      vi.stubEnv("S3_ACCESS_KEY", "wire-fixture-access");
      vi.stubEnv("S3_SECRET_KEY", "wire-fixture-secret");
      await conn.query(
        "INSERT INTO users (id,openId,role) VALUES (97330,'ag4-admin','admin'),(97331,'ag4-other-admin','admin'),(97332,'ag4-member','user')",
      );
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
      token = await sdk.createSessionToken("ag4-admin", { sessionVersion: 0 });
    });
    beforeEach(async () => {
      if ((await rows("SHOW TABLES LIKE 'private_attachment_uploads'")).length)
        await conn.query(
          "DELETE FROM private_attachment_uploads WHERE actorUserId IN (97330,97331)",
        );
      wire.objects.clear();
      wire.effects.length = 0;
      wire.rejectPolicy(false);
      vi.stubEnv("PRIVATE_POST_MEDIA_UPLOAD_ENABLED", "true");
      await conn.query(
        "UPDATE users SET role='admin',blockedAt=NULL,sessionVersion=0 WHERE id=97330",
      );
    });
    afterAll(async () => {
      await app?.close();
      if (conn) {
        if (
          (await rows("SHOW TABLES LIKE 'private_attachment_uploads'")).length
        )
          await conn.query(
            "DELETE FROM private_attachment_uploads WHERE actorUserId IN (97330,97331)",
          );
        await conn.query("DELETE FROM users WHERE id IN (97330,97331,97332)");
        await conn.end();
      }
      if (app)
        await (
          (await getDb()) as unknown as { $client: { end(): Promise<void> } }
        )?.$client.end();
      await wire?.close();
      vi.unstubAllEnvs();
    });
    it("uploads a private document and replays the same server receipt", async () => {
      const first = await request("uploadPrivateAttachment");
      expect(first.status).toBe(200);
      expect(first.data).toMatchObject({
        state: "ready",
        type: "document",
        filename: "fixture.txt",
        mimeType: "text/plain; charset=utf-8",
        fileSize: 10,
      });
      expect(first.data.assetId).toMatch(/^[a-f0-9-]{36}$/);
      expect(JSON.stringify(first.data)).not.toMatch(
        /https?:|private-v1|objectKey|secret/i,
      );
      expect(await request("uploadPrivateAttachment")).toEqual(first);
      expect(wire.objects.size).toBe(1);
      expect([...wire.objects.values()][0].bytes.toString()).toBe("0123456789");
      expect(
        wire.effects.filter((value) => value.startsWith("PUT")),
      ).toHaveLength(1);
      expect(
        await request(
          "privateAttachmentStatus",
          { idempotencyKey: input.idempotencyKey },
          token,
          true,
        ),
      ).toEqual(first);
    });
    it("recovers a lost storage ACK using the same object, never a second PUT", async () => {
      wire.dropPutAck();
      expect((await request("uploadPrivateAttachment")).status).toBe(503);
      expect(
        (
          await request(
            "privateAttachmentStatus",
            { idempotencyKey: input.idempotencyKey },
            token,
            true,
          )
        ).data,
      ).toMatchObject({ state: "pending" });
      const recovered = await request("uploadPrivateAttachment");
      expect(recovered.status).toBe(200);
      expect(recovered.data.state).toBe("ready");
      expect(wire.objects.size).toBe(1);
      expect(
        wire.effects.filter((value) => value.startsWith("PUT")),
      ).toHaveLength(1);
    });
    it("rejects a changed payload under the same intent without another object", async () => {
      expect((await request("uploadPrivateAttachment")).status).toBe(200);
      wire.effects.length = 0;
      expect(
        (
          await request("uploadPrivateAttachment", {
            ...input,
            base64: Buffer.from("changed").toString("base64"),
          })
        ).status,
      ).toBe(409);
      expect(wire.objects.size).toBe(1);
      expect(wire.effects).toEqual([]);
    });
    it("refuses storage without the prefix policy before PUT", async () => {
      wire.rejectPolicy(true);
      expect((await request("uploadPrivateAttachment")).status).toBe(503);
      expect(wire.objects.size).toBe(0);
    });
    it("disabled upload rejects before receiving a large body or contacting S3", async () => {
      vi.stubEnv("PRIVATE_POST_MEDIA_UPLOAD_ENABLED", "false");
      expect((await request("uploadPrivateAttachment")).status).toBe(404);
      expect(wire.effects).toEqual([]);
    });
    it("guest is refused before storage", async () => {
      expect(
        (await request("uploadPrivateAttachment", input, null)).status,
      ).toBe(401);
      expect(wire.effects).toEqual([]);
    });
    it("parallel retries commit one intent and one object", async () => {
      const results = await Promise.all(
        Array.from({ length: 4 }, () => request("uploadPrivateAttachment")),
      );
      expect(results.every((result) => result.status === 200)).toBe(true);
      expect(new Set(results.map((result) => result.data.assetId)).size).toBe(
        1,
      );
      expect(
        await rows(
          "SELECT assetId FROM private_attachment_uploads WHERE actorUserId=97330",
        ),
      ).toHaveLength(1);
      expect(
        wire.effects.filter((value) => value.startsWith("PUT")),
      ).toHaveLength(1);
    });
    it("changed storage namespace cannot replay or report a ready receipt", async () => {
      expect((await request("uploadPrivateAttachment")).status).toBe(200);
      wire.effects.length = 0;
      vi.stubEnv("S3_BUCKET", "other-fixture-bucket");
      try {
        expect((await request("uploadPrivateAttachment")).status).toBe(503);
        expect(
          (
            await request(
              "privateAttachmentStatus",
              { idempotencyKey: input.idempotencyKey },
              token,
              true,
            )
          ).status,
        ).toBe(503);
        expect(wire.effects).toEqual([]);
      } finally {
        vi.stubEnv("S3_BUCKET", wire.bucket);
      }
    });
    it("a missing uniqueness guard refuses upload before any storage request", async () => {
      await conn.query(
        "ALTER TABLE private_attachment_uploads DROP INDEX private_attachment_asset_unique",
      );
      try {
        expect((await request("uploadPrivateAttachment")).status).toBe(503);
        expect(wire.effects).toEqual([]);
      } finally {
        await conn.query(
          "ALTER TABLE private_attachment_uploads ADD UNIQUE private_attachment_asset_unique (assetId)",
        );
      }
    });
    it("revoked admin cannot recover a committed receipt", async () => {
      expect((await request("uploadPrivateAttachment")).status).toBe(200);
      await conn.query("UPDATE users SET role='user' WHERE id=97330");
      wire.effects.length = 0;
      expect((await request("uploadPrivateAttachment")).status).toBe(403);
      expect(wire.effects).toEqual([]);
    });
  },
);
