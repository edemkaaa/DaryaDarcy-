import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import type { Connection, RowDataPacket } from "mysql2/promise";
import superjson from "superjson";
import { openVideoTestDatabase } from "./helpers/video-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { getDb } from "../apps/backend/src/db";
import { sdk } from "../apps/backend/src/_core/sdk";

// Real local HTTP/JWT/SQL. No requests to VK, YouTube, S3 or a working database.
describe.skipIf(!testDatabaseUrl)("VK-only video delivery", () => {
  let conn: Connection, app: INestApplication, base: string, token: string;
  const embed =
    "https://vk.ru/video_ext.php?oid=-100&id=901&hash=owned_fixture&autoplay=0";
  async function rpc(path: string, value?: unknown, mutation = false) {
    const encoded =
      value === undefined ? undefined : superjson.stringify(value);
    const response = await fetch(
      `${base}/api/trpc/${path}${!mutation && encoded ? `?input=${encodeURIComponent(encoded)}` : ""}`,
      {
        method: mutation ? "POST" : "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        ...(mutation ? { body: encoded } : {}),
      },
    );
    const json = await response.json();
    return {
      status: response.status,
      data: json.result
        ? superjson.deserialize(json.result.data)
        : json.error?.json?.data?.code,
    };
  }
  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
    vi.stubEnv("JWT_SECRET", "owned-vk-only-session-secret-32-chars");
    vi.stubEnv("VK_CATALOG_ENABLED", "true");
    conn = await openVideoTestDatabase();
    await conn.query(
      "INSERT INTO users(id,openId,role) VALUES (9160,'owned-vk-only-admin','admin')",
    );
    token = await sdk.createSessionToken("owned-vk-only-admin", {
      sessionVersion: 0,
    });
    await conn.query(
      "INSERT INTO videos(id,youtubeId,title,published) VALUES (11650,'vkretire001','Owned provider-only legacy',TRUE)",
    );
    app = await createBackendApplication();
    await app.listen(0, "127.0.0.1");
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    const saved = await rpc(
      "admin.upsertVkVideo",
      {
        embedUrl: embed,
        title: "Owned provider-only current",
        access: "public",
        published: true,
      },
      true,
    );
    expect(saved.status).toBe(200);
  });
  afterAll(async () => {
    await app?.close();
    if (conn) {
      await conn.query("DELETE FROM videos WHERE title LIKE 'Owned provider-only%'");
      await conn.query(
        "DELETE FROM users WHERE id=9160 AND openId='owned-vk-only-admin'",
      );
      await conn.end();
    }
    await (
      (await getDb()) as unknown as { $client: { end(): Promise<void> } }
    )?.$client.end();
    vi.unstubAllEnvs();
  });
  it("excludes stored YouTube rows before pagination without deleting them", async () => {
    const page = await rpc("videos.catalog", { limit: 1, cursor: 11649 });
    expect(page.status).toBe(200);
    expect(page.data).toMatchObject({
      items: [{ title: "Owned provider-only current", canWatch: true }],
      nextCursor: null,
    });
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT youtubeId,published FROM videos WHERE id=11650",
    );
    expect(rows).toEqual([{ youtubeId: "vkretire001", published: 1 }]);
  });
  it("refuses YouTube playback but keeps the VK player response", async () => {
    expect((await rpc("videos.playback", { id: 11650 })).status).toBe(404);
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT id FROM videos WHERE title='Owned provider-only current'",
    );
    expect(await rpc("videos.playback", { id: rows[0].id })).toEqual({
      status: 200,
      data: { id: rows[0].id, provider: "vk", embedUrl: embed },
    });
  });
  it("retires the legacy list and detail without disclosing old sources", async () => {
    expect(await rpc("videos.list")).toEqual({ status: 200, data: [] });
    expect((await rpc("videos.getById", { id: 11650 })).data).toBeUndefined();
  });
  it("refuses an otherwise valid YouTube import without adding rows", async () => {
    expect(
      (
        await rpc(
          "admin.importVideos",
          {
            videos: [
              { youtubeId: "vkretire002", title: "Owned provider-only import" },
            ],
          },
          true,
        )
      ).status,
    ).toBe(404);
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT id FROM videos WHERE youtubeId='vkretire002'",
    );
    expect(rows).toEqual([]);
  });
  it.each(["GET", "HEAD"])(
    "does not register the YouTube proxy for %s",
    async (method) => {
      const response = await fetch(`${base}/api/yt/vkretire001`, { method });
      expect(response.status).toBe(404);
    },
  );
  it("never restores YouTube delivery when the VK catalog is disabled", async () => {
    vi.stubEnv("VK_CATALOG_ENABLED", "false");
    try {
      expect((await rpc("videos.catalog")).status).toBe(412);
      expect(await rpc("videos.list")).toEqual({ status: 200, data: [] });
      expect((await rpc("videos.getById", { id: 11650 })).data).toBeUndefined();
    } finally {
      vi.stubEnv("VK_CATALOG_ENABLED", "true");
    }
  });
});
