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
import { createServer } from "node:http";
import type { Connection, RowDataPacket } from "mysql2/promise";
import superjson from "superjson";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import { createTRPCQueryUtils } from "@trpc/react-query";
import { InfiniteQueryObserver, QueryClient } from "@tanstack/react-query";
import type { AppRouter } from "../apps/frontend/src/shared/api/contract";
import { openVideoTestDatabase } from "./helpers/video-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import { getDb, getUserById } from "../apps/backend/src/db";
import { upsertVkVideo } from "../apps/backend/src/content/vk-catalog";
import { readFile } from "node:fs/promises";

// Native JWT/HTTP/SQL. Synthetic VK links are stored, never fetched or opened.
describe.skipIf(!testDatabaseUrl)("VK catalog boundaries", () => {
  let conn: Connection, app: INestApplication, base: string, admin: string;
  const embedUrl =
    "https://vk.com/video_ext.php?oid=-100&id=200&hash=synthetic_hash&hd=2";
  const canonical = embedUrl + "&autoplay=0";
  const input = {
    embedUrl,
    title: "Owned VK fixture",
    access: "club",
    published: true,
  };
  async function rows(query: string, values: unknown[] = []) {
    const [data] = await conn.query<RowDataPacket[]>(query, values);
    return data;
  }
  async function request(
    path: string,
    value?: unknown,
    token: string | null = admin,
    mutation = false,
  ) {
    const encoded =
      value === undefined ? undefined : superjson.stringify(value);
    const response = await fetch(
      `${base}/api/trpc/${path}${!mutation && encoded ? `?input=${encodeURIComponent(encoded)}` : ""}`,
      {
        method: mutation ? "POST" : "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(mutation ? { body: encoded } : {}),
      },
    );
    const body = await response.json();
    return {
      code: response.status,
      data: body.result
        ? superjson.deserialize<any>(body.result.data)
        : body.error?.json?.data?.code,
      cache: response.headers.get("cache-control"),
    };
  }
  async function cleanup() {
    await conn.query(
      "DELETE FROM videos WHERE title LIKE 'Owned VK%' OR id BETWEEN 11501 AND 11505",
    );
    await conn.query(
      "DELETE FROM club_payments WHERE userId BETWEEN 9150 AND 9154",
    );
  }
  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
    conn = await openVideoTestDatabase();
    vi.stubEnv("JWT_SECRET", "vk-catalog-synthetic-secret");
    vi.stubEnv("VK_CATALOG_ENABLED", "true");
    await conn.query(
      "INSERT INTO users (id,openId,email,role) VALUES (9150,'vk-admin','vk-admin@example.test','admin'),(9151,'vk-member','vk-member@example.test','user'),(9152,'vk-staff','vk-staff@example.test','moderator'),(9153,'vk-expired','vk-expired@example.test','user'),(9154,'vk-other','vk-other@example.test','user')",
    );
    app = await createBackendApplication();
    await app.listen(0, "127.0.0.1");
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    admin = await sdk.createSessionToken("vk-admin", { sessionVersion: 0 });
  });
  beforeEach(async () => {
    await cleanup();
    await conn.query(
      "UPDATE users SET blockedAt=NULL,sessionVersion=0,accountDeletionRequestedAt=NULL WHERE id BETWEEN 9150 AND 9154",
    );
    await conn.query("UPDATE users SET role='user' WHERE id=9154");
    vi.stubEnv("VK_CATALOG_ENABLED", "true");
  });
  afterAll(async () => {
    await app?.close();
    if (conn) {
      await cleanup();
      await conn.query("DELETE FROM users WHERE id BETWEEN 9150 AND 9154");
      await conn.end();
    }
    const database = await getDb();
    await (
      database as unknown as { $client: { end(): Promise<void> } }
    )?.$client.end();
    vi.unstubAllEnvs();
  });
  it("creates a real VK row without a fake YouTube ID and replays the same source", async () => {
    const first = await request("admin.upsertVkVideo", input, admin, true);
    expect(first.code).toBe(200);
    expect(first.data.id).toBeGreaterThan(0);
    expect(await request("admin.upsertVkVideo", input, admin, true)).toEqual(
      first,
    );
    expect(
      await rows(
        "SELECT youtubeId,vkEmbedUrl,provider,access FROM videos WHERE id=?",
        [first.data.id],
      ),
    ).toEqual([
      {
        youtubeId: null,
        vkEmbedUrl: canonical,
        provider: "vk",
        access: "club",
      },
    ]);
    expect(
      (await request("videos.list", undefined, null)).data.some(
        (row: any) => row.id === first.data.id,
      ),
    ).toBe(false);
    expect(
      (await request("videos.getById", { id: first.data.id }, null)).data,
    ).toBeUndefined();
  });
  it("saves a hash-free export, replays it and changes hash only through an explicit edit", async () => {
    const bare = embedUrl.replace("&hash=synthetic_hash", "");
    const payload = { ...input, embedUrl: bare + "&autoplay=1" };
    const first = await request("admin.upsertVkVideo", payload, admin, true);
    expect(first.code).toBe(200);
    expect(await request("admin.upsertVkVideo", payload, admin, true)).toEqual(
      first,
    );
    const playback = {
      id: first.data.id,
      provider: "vk",
      embedUrl: bare + "&autoplay=0",
    };
    expect(
      (await request("videos.playback", { id: first.data.id }, admin)).data,
    ).toEqual(playback);
    expect(
      (await request("videos.playback", { id: first.data.id }, null)).code,
    ).toBe(401);
    const [before] = await rows("SELECT vkSourceKey FROM videos WHERE id=?", [
      first.data.id,
    ]);
    expect(
      (await request("admin.upsertVkVideo", input, admin, true)).code,
    ).toBe(409);
    expect(
      (
        await request(
          "admin.upsertVkVideo",
          { ...input, id: first.data.id },
          admin,
          true,
        )
      ).code,
    ).toBe(200);
    expect(
      (await request("videos.playback", { id: first.data.id }, admin)).data
        .embedUrl,
    ).toBe(canonical);
    expect(
      (
        await request(
          "admin.upsertVkVideo",
          { ...payload, id: first.data.id, access: "public" },
          admin,
          true,
        )
      ).code,
    ).toBe(200);
    expect(
      (await request("videos.playback", { id: first.data.id }, null)).data,
    ).toEqual(playback);
    expect(
      await rows("SELECT vkSourceKey FROM videos WHERE title LIKE 'Owned VK%'"),
    ).toEqual([before]);
  });
  it("serializes concurrent creates of the same source without duplicate rows", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        request(
          "admin.upsertVkVideo",
          { ...input, thumbnailUrl: "/assets/responsive/owned-cover.webp" },
          admin,
          true,
        ),
      ),
    );
    expect(results.map((r) => r.code)).toEqual(Array(8).fill(200));
    expect(new Set(results.map((r) => r.data.id)).size).toBe(1);
    expect(
      await rows("SELECT id FROM videos WHERE title='Owned VK fixture'"),
    ).toHaveLength(1);
  });
  it("saves a VK cover and replays creation after a lost response without duplicates", async () => {
    const payload = {
      ...input,
      thumbnailUrl: "  /assets/responsive/owned-cover.webp  ",
    };
    // Commit through the real HTTP API, then cut the acknowledgement at a local relay.
    const relay = createServer(async (req, res) => {
      req.resume();
      try {
        const upstream = await fetch(`${base}/api/trpc/admin.upsertVkVideo`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${admin}`,
          },
          body: superjson.stringify(payload),
        });
        await upstream.arrayBuffer();
      } finally {
        res.destroy();
      }
    });
    relay.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => relay.once("listening", resolve));
    try {
      await expect(
        fetch(`http://127.0.0.1:${(relay.address() as AddressInfo).port}`, {
          method: "POST",
        }),
      ).rejects.toThrow();
    } finally {
      await new Promise<void>((resolve, reject) => {
        relay.close((error) => error ? reject(error) : resolve());
        relay.closeAllConnections();
      });
    }
    const persisted = await rows("SELECT id FROM videos WHERE title=?", [
      input.title,
    ]);
    expect(persisted).toHaveLength(1);
    const replay = await request(
      "admin.upsertVkVideo",
      {
        ...payload,
        thumbnailUrl: "/assets/responsive/owned-cover.webp",
      },
      admin,
      true,
    );
    expect(replay.code).toBe(200);
    expect(replay.data.id).toBe(persisted[0].id);
    expect(
      await rows("SELECT id,thumbnailUrl FROM videos WHERE title=?", [
        input.title,
      ]),
    ).toEqual([
      {
        id: replay.data.id,
        thumbnailUrl: "/assets/responsive/owned-cover.webp",
      },
    ]);
    const catalog = await request(
      "videos.catalog",
      { includeThumbnails: true },
      null,
    );
    expect(catalog.data.items[0].thumbnailUrl).toBe(
      "/assets/responsive/owned-cover.webp",
    );
    expect(
      (
        await request(
          "admin.upsertVkVideo",
          {
            ...input,
            thumbnailUrl: "/assets/responsive/different-cover.webp",
          },
          admin,
          true,
        )
      ).code,
    ).toBe(409);
    expect(
      await rows("SELECT thumbnailUrl FROM videos WHERE id=?", [
        replay.data.id,
      ]),
    ).toEqual([{ thumbnailUrl: "/assets/responsive/owned-cover.webp" }]);
  });
  it.each([
    "https://s3.twcstorage.ru/daryadarcy-s3/covers/public-v1/12345678-1234-4234-8234-123456789abc.webp",
    "https://s3.twcstorage.ru/daryadarcy-s3/covers/12345678-1234-4234-8234-123456789abc.webp",
    `https://s3.twcstorage.ru/daryadarcy-s3/covers/vk-v1/${"a".repeat(64)}/${"b".repeat(64)}.webp`,
  ])(
    "keeps a server-owned public cover through HTTP save and catalog: %s",
    async (thumbnailUrl) => {
      const saved = await request(
        "admin.upsertVkVideo",
        { ...input, thumbnailUrl },
        admin,
        true,
      );
      expect(saved.code).toBe(200);
      expect(
        await rows("SELECT thumbnailUrl FROM videos WHERE id=?", [
          saved.data.id,
        ]),
      ).toEqual([{ thumbnailUrl }]);
      const catalog = await request(
        "videos.catalog",
        { includeThumbnails: true },
        null,
      );
      expect(catalog.code).toBe(200);
      expect(catalog.data.items).toEqual([
        expect.objectContaining({
          id: saved.data.id,
          thumbnailUrl,
          canWatch: false,
        }),
      ]);
      expect(catalog.data.items[0]).not.toHaveProperty("embedUrl");
    },
  );
  it("preserves omitted VK cover on update and clears only explicit null", async () => {
    const saved = await request(
      "admin.upsertVkVideo",
      {
        ...input,
        thumbnailUrl: "/assets/responsive/owned-cover.webp",
      },
      admin,
      true,
    );
    expect(saved.code).toBe(200);
    expect(
      (
        await request(
          "admin.upsertVkVideo",
          {
            ...input,
            id: saved.data.id,
            title: "Owned VK renamed",
          },
          admin,
          true,
        )
      ).code,
    ).toBe(200);
    expect(
      await rows("SELECT thumbnailUrl FROM videos WHERE id=?", [saved.data.id]),
    ).toEqual([{ thumbnailUrl: "/assets/responsive/owned-cover.webp" }]);
    expect(
      (
        await request(
          "admin.upsertVkVideo",
          {
            ...input,
            id: saved.data.id,
            thumbnailUrl: null,
          },
          admin,
          true,
        )
      ).code,
    ).toBe(200);
    expect(
      await rows("SELECT thumbnailUrl FROM videos WHERE id=?", [saved.data.id]),
    ).toEqual([{ thumbnailUrl: null }]);
  });
  it.each([
    canonical,
    "https://s3.twcstorage.ru/daryadarcy-s3/private-v1/cover.webp",
    "https://s3.twcstorage.ru/daryadarcy-s3/feed/cover.webp?X-Amz-Signature=secret",
    "https://s3.twcstorage.ru.evil.test/daryadarcy-s3/feed/cover.webp",
    "javascript:alert(1)",
    "",
    false,
  ])(
    "rejects an unsafe cover without changing the VK row (%s)",
    async (thumbnailUrl) => {
      const saved = await request("admin.upsertVkVideo", input, admin, true);
      expect(
        (
          await request(
            "admin.upsertVkVideo",
            {
              ...input,
              id: saved.data.id,
              title: "Owned VK unsafe update",
              thumbnailUrl,
            },
            admin,
            true,
          )
        ).code,
      ).toBe(400);
      expect(
        await rows("SELECT title,thumbnailUrl FROM videos WHERE id=?", [
          saved.data.id,
        ]),
      ).toEqual([{ title: input.title, thumbnailUrl: null }]);
    },
  );
  it("rejects changed create payload under the same source", async () => {
    expect(
      (await request("admin.upsertVkVideo", input, admin, true)).code,
    ).toBe(200);
    expect(
      (
        await request(
          "admin.upsertVkVideo",
          { ...input, title: "Owned VK changed" },
          admin,
          true,
        )
      ).code,
    ).toBe(409);
    expect(
      await rows("SELECT title FROM videos WHERE title LIKE 'Owned VK%'"),
    ).toEqual([{ title: input.title }]);
  });
  it("rejects a share URL and extra privileges rather than accepting arbitrary embed data", async () => {
    expect(
      (
        await request(
          "admin.upsertVkVideo",
          { ...input, embedUrl: "https://vk.com/video-100_200" },
          admin,
          true,
        )
      ).code,
    ).toBe(400);
    expect(
      (
        await request(
          "admin.upsertVkVideo",
          { ...input, role: "admin" },
          admin,
          true,
        )
      ).code,
    ).toBe(400);
    expect(
      await rows("SELECT id FROM videos WHERE title LIKE 'Owned VK%'"),
    ).toHaveLength(0);
  });
  it("preserves the legacy public YouTube wire shape without new source fields", async () => {
    await conn.query(
      "INSERT INTO videos (id,youtubeId,title) VALUES (11501,'vkpublic001','Owned VK legacy')",
    );
    const row = (await request("videos.getById", { id: 11501 }, null)).data;
    expect(row.youtubeId).toBe("vkpublic001");
    expect(row).not.toHaveProperty("vkEmbedUrl");
    expect(row).not.toHaveProperty("vkSourceKey");
    expect(row).not.toHaveProperty("access");
    expect(row).not.toHaveProperty("provider");
  });
  it("lists source-free cards and gates club playback by current club access", async () => {
    const created = await request("admin.upsertVkVideo", input, admin, true);
    const guest = await request("videos.catalog", {}, null);
    expect(guest.code).toBe(200);
    expect(guest.data.items).toEqual([
      {
        id: created.data.id,
        title: input.title,
        duration: null,
        access: "club",
        canWatch: false,
      },
    ]);
    expect(
      (await request("videos.playback", { id: created.data.id }, null)).code,
    ).toBe(401);
    const other = await sdk.createSessionToken("vk-other", {
      sessionVersion: 0,
    });
    expect(
      (await request("videos.playback", { id: created.data.id }, other)).code,
    ).toBe(403);
    const staff = await sdk.createSessionToken("vk-staff", {
      sessionVersion: 0,
    });
    expect(
      (await request("videos.catalog", {}, staff)).data.items[0].canWatch,
    ).toBe(true);
    expect(
      (await request("videos.playback", { id: created.data.id }, staff)).data,
    ).toEqual({ id: created.data.id, provider: "vk", embedUrl: canonical });
  });
  it.each([
    [
      "/assets/responsive/owned-cover.webp",
      "/assets/responsive/owned-cover.webp",
    ],
    [
      "https://s3.twcstorage.ru/daryadarcy-s3/feed/owned-cover.webp",
      "https://s3.twcstorage.ru/daryadarcy-s3/feed/owned-cover.webp",
    ],
    [
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/owned-cover.jpg",
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/owned-cover.jpg",
    ],
    [null, null],
    [canonical, null],
    [
      "https://s3.twcstorage.ru/daryadarcy-s3/private-content/secret.webp?X-Amz-Signature=secret",
      null,
    ],
    [
      "https://s3.twcstorage.ru/daryadarcy-s3/feed/cover.webp?token=secret",
      null,
    ],
    ["https://s3.twcstorage.ru.evil.test/daryadarcy-s3/feed/cover.webp", null],
    ["javascript:alert(1)", null],
    ["//evil.test/cover.webp", null],
    [
      "https://user:secret@s3.twcstorage.ru/daryadarcy-s3/feed/cover.webp",
      null,
    ],
    ["https://s3.twcstorage.ru/daryadarcy-s3/feed/cover.webp#secret", null],
    ["https://s3.twcstorage.ru/daryadarcy-s3/feed/movie.mp4", null],
    [
      "https://s3.twcstorage.ru/daryadarcy-s3/feed/%2e%2e/private-v1/file.webp",
      null,
    ],
  ])(
    "returns only a public cover after explicit client opt-in (%s)",
    async (stored, expected) => {
      const created = await request("admin.upsertVkVideo", input, admin, true);
      await conn.query("UPDATE videos SET thumbnailUrl=? WHERE id=?", [
        stored,
        created.data.id,
      ]);
      const legacy = await request(
        "videos.catalog",
        { includeThumbnails: false },
        null,
      );
      expect(legacy.code).toBe(200);
      expect(legacy.data.items[0]).toEqual({
        id: created.data.id,
        title: input.title,
        duration: null,
        access: "club",
        canWatch: false,
      });
      const response = await request(
        "videos.catalog",
        { includeThumbnails: true },
        null,
      );
      expect(response.code).toBe(200);
      expect(response.data.items).toEqual([
        {
          id: created.data.id,
          title: input.title,
          duration: null,
          access: "club",
          canWatch: false,
          thumbnailUrl: expected,
        },
      ]);
      // A public cover never grants playback or exposes the VK source/hash.
      expect(
        (await request("videos.playback", { id: created.data.id }, null)).code,
      ).toBe(401);
    },
  );
  it("keeps cover opt-in and the forward cursor independent across pages", async () => {
    const first = await request("admin.upsertVkVideo", input, admin, true);
    const second = await request(
      "admin.upsertVkVideo",
      {
        ...input,
        embedUrl: embedUrl.replace("id=200", "id=201"),
        title: "Owned VK next cover",
      },
      admin,
      true,
    );
    await conn.query(
      "UPDATE videos SET thumbnailUrl='/assets/responsive/owned-cover.webp' WHERE id=?",
      [first.data.id],
    );
    const page = await request(
      "videos.catalog",
      { limit: 1, includeThumbnails: true },
      null,
    );
    expect(page.code).toBe(200);
    expect(page.data.nextCursor).toBe(first.data.id);
    expect(page.data.items[0].thumbnailUrl).toBe(
      "/assets/responsive/owned-cover.webp",
    );
    const next = await request(
      "videos.catalog",
      { limit: 1, cursor: page.data.nextCursor, includeThumbnails: true },
      null,
    );
    expect(next.data.items).toEqual([
      {
        id: second.data.id,
        title: "Owned VK next cover",
        duration: null,
        access: "club",
        canWatch: false,
        thumbnailUrl: null,
      },
    ]);
    expect(next.data.nextCursor).toBeNull();
    // Clients can still make the original request after a cover-aware request.
    expect(
      (await request("videos.catalog", { limit: 1 }, null)).data.items[0],
    ).not.toHaveProperty("thumbnailUrl");
  });
  it("serves public VK through additive playback, not through legacy worker authority", async () => {
    const created = await request(
      "admin.upsertVkVideo",
      { ...input, access: "public" },
      admin,
      true,
    );
    expect(
      (await request("videos.playback", { id: created.data.id }, null)).data,
    ).toEqual({ id: created.data.id, provider: "vk", embedUrl: canonical });
    expect((await request("videos.list", undefined, null)).data).toEqual([]);
  });
  it.each([embedUrl, embedUrl.replace("&hash=synthetic_hash", "")])(
    "accepts paid membership but denies expired, blocked and revoked identities (%s)",
    async (source) => {
      const created = await request(
        "admin.upsertVkVideo",
        { ...input, embedUrl: source },
        admin,
        true,
      );
      expect(created.code).toBe(200);
      await conn.query(
        "INSERT INTO club_payments (userId,orderId,status,paidAt,expiresAt) VALUES (9151,'owned-vk-paid','paid',NOW(),'2030-01-01 00:00:00'),(9153,'owned-vk-expired','paid','2024-01-01 00:00:00','2024-02-01 00:00:00')",
      );
      const member = await sdk.createSessionToken("vk-member", {
        sessionVersion: 0,
      });
      const expired = await sdk.createSessionToken("vk-expired", {
        sessionVersion: 0,
      });
      expect(
        (await request("videos.playback", { id: created.data.id }, member))
          .code,
      ).toBe(200);
      expect(
        (await request("videos.playback", { id: created.data.id }, expired))
          .code,
      ).toBe(403);
      await conn.query("UPDATE users SET blockedAt=NOW() WHERE id=9151");
      expect(
        (await request("videos.playback", { id: created.data.id }, member))
          .code,
      ).toBe(401);
      await conn.query(
        "UPDATE users SET blockedAt=NULL,sessionVersion=1 WHERE id=9151",
      );
      expect(
        (await request("videos.playback", { id: created.data.id }, member))
          .code,
      ).toBe(401);
    },
  );
  it("uses explicit updates for existing VK rows, and denies moderator writes", async () => {
    const created = await request("admin.upsertVkVideo", input, admin, true);
    const staff = await sdk.createSessionToken("vk-staff", {
      sessionVersion: 0,
    });
    expect(
      (await request("admin.upsertVkVideo", input, staff, true)).code,
    ).toBe(403);
    expect((await request("admin.upsertVkVideo", input, null, true)).code).toBe(
      401,
    );
    expect(
      (
        await request(
          "admin.upsertVkVideo",
          {
            ...input,
            id: created.data.id,
            title: "Owned VK updated",
            published: false,
          },
          admin,
          true,
        )
      ).data,
    ).toEqual({ id: created.data.id });
    expect(
      (await request("videos.playback", { id: created.data.id }, admin)).code,
    ).toBe(404);
    expect((await request("videos.catalog", {}, admin)).data.items).toEqual([]);
  });
  it("is disabled by default and does not weaken legacy filtering when disabled", async () => {
    const created = await request("admin.upsertVkVideo", input, admin, true);
    vi.stubEnv("VK_CATALOG_ENABLED", "");
    expect(
      (await request("admin.upsertVkVideo", input, admin, true)).code,
    ).toBe(412);
    expect((await request("videos.catalog", {}, null)).code).toBe(412);
    expect(
      (await request("videos.playback", { id: created.data.id }, admin)).code,
    ).toBe(412);
    expect((await request("videos.list", undefined, null)).data).toEqual([]);
    expect(
      await rows("SELECT id FROM videos WHERE title LIKE 'Owned VK%'"),
    ).toHaveLength(1);
  });
  it("rejects malformed embeds without recording a source", async () => {
    for (const url of [
      "http://vk.com/video_ext.php?oid=-100&id=200&hash=synthetic_hash",
      "https://vk.com.evil.test/video_ext.php?oid=-100&id=200&hash=synthetic_hash",
      embedUrl + "&oid=-101",
      embedUrl + "&unknown=1",
      embedUrl + "#secret",
      embedUrl.replace("oid=-100", "oid=0"),
      embedUrl.replace("id=200", "id=1.5"),
      embedUrl.replace("synthetic_hash", "x"),
      embedUrl.replace("hd=2", "hd=9"),
      "<iframe src='" + embedUrl + "'></iframe>",
      embedUrl.replace("vk.com", "owner:secret@vk.com"),
    ])
      expect(
        (
          await request(
            "admin.upsertVkVideo",
            { ...input, embedUrl: url },
            admin,
            true,
          )
        ).code,
      ).toBe(400);
    expect(
      await rows("SELECT id FROM videos WHERE title LIKE 'Owned VK%'"),
    ).toHaveLength(0);
  });
  it("replays reordered parameters but conflicts when embed hash changes", async () => {
    const first = await request("admin.upsertVkVideo", input, admin, true);
    const reordered =
      "https://vk.com/video_ext.php?hd=2&hash=synthetic_hash&id=200&oid=-100&autoplay=1";
    expect(
      (
        await request(
          "admin.upsertVkVideo",
          { ...input, embedUrl: reordered },
          admin,
          true,
        )
      ).data,
    ).toEqual(first.data);
    expect(
      (
        await request(
          "admin.upsertVkVideo",
          {
            ...input,
            embedUrl: embedUrl.replace("synthetic_hash", "different_hash"),
          },
          admin,
          true,
        )
      ).code,
    ).toBe(409);
    expect(
      await rows("SELECT id FROM videos WHERE title LIKE 'Owned VK%'"),
    ).toHaveLength(1);
  });
  it("accepts the existing infinite-query client across all pages without exposing club sources", async () => {
    await conn.query(
      "INSERT INTO videos (id,youtubeId,title,published,access) VALUES (11501,'vkpublic001','Owned VK first',TRUE,'public'),(11502,'vkpublic002','Owned VK hidden',FALSE,'public'),(11503,'vkpublic003','Owned VK club',TRUE,'club'),(11504,'vkpublic004','Owned VK last',TRUE,'public')",
    );
    const sent: unknown[] = [];
    const client = createTRPCProxyClient<AppRouter>({
      links: [httpLink({
        url: `${base}/api/trpc`,
        transformer: superjson,
        fetch: (url, options) => {
          sent.push(superjson.parse(new URL(String(url)).searchParams.get("input")!));
          return fetch(url, options);
        },
      })],
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const utils = createTRPCQueryUtils({ client, queryClient });
    const observer = new InfiniteQueryObserver(queryClient, utils.videos.catalog.infiniteQueryOptions(
      { limit: 1 },
      { getNextPageParam: last => last.nextCursor ?? undefined },
    ));
    try {
      const first = await observer.fetchNextPage();
      expect(first.error).toBeNull();
      expect(first.data?.pages[0]).toEqual({
        items: [{ id: 11501, title: "Owned VK first", duration: null, access: "public", canWatch: true }],
        nextCursor: 11501,
      });
      const second = await observer.fetchNextPage();
      expect(second.data?.pages[1]).toEqual({
        items: [{ id: 11503, title: "Owned VK club", duration: null, access: "club", canWatch: false }],
        nextCursor: 11503,
      });
      const last = await observer.fetchNextPage();
      expect(last.data?.pages[2]).toEqual({
        items: [{ id: 11504, title: "Owned VK last", duration: null, access: "public", canWatch: true }],
        nextCursor: null,
      });
      expect(last.hasNextPage).toBe(false);
      await observer.fetchNextPage();
      expect(sent).toEqual([
        { limit: 1, direction: "forward" },
        { limit: 1, cursor: 11501, direction: "forward" },
        { limit: 1, cursor: 11503, direction: "forward" },
      ]);
    } finally {
      observer.destroy();
      queryClient.clear();
    }
  });
  it.each([
    { direction: "backward" },
    { direction: "FORWARD" },
    { direction: null },
    { direction: 1 },
    { direction: "forward", access: "public" },
    { direction: "forward", cursor: 0 },
    { direction: "forward", cursor: null },
    { direction: "forward", limit: 101 },
  ])("rejects unsupported infinite-query input %j", async value => {
    expect((await request("videos.catalog", value, null)).code).toBe(400);
  });
  it("paginates source-free cards and validates safe IDs and strict query fields", async () => {
    await conn.query(
      "INSERT INTO videos (id,youtubeId,title,published) VALUES (11501,'vkpublic001','Owned VK first',TRUE),(11502,'vkpublic002','Owned VK second',FALSE),(11503,'vkpublic003','Owned VK third',TRUE)",
    );
    const page = (
      await request("videos.catalog", { cursor: 11500, limit: 1 }, null)
    ).data;
    expect(page.items).toEqual([
      {
        id: 11501,
        title: "Owned VK first",
        duration: null,
        access: "public",
        canWatch: true,
      },
    ]);
    expect(page.nextCursor).toBe(11501);
    expect(
      (
        await request(
          "videos.catalog",
          { cursor: page.nextCursor, limit: 1 },
          null,
        )
      ).data.items[0].id,
    ).toBe(11503);
    for (const id of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])
      expect((await request("videos.playback", { id }, null)).code).toBe(400);
    expect((await request("videos.catalog", { limit: 101 }, null)).code).toBe(
      400,
    );
    expect(
      (await request("videos.playback", { id: 11501, access: "public" }, null))
        .code,
    ).toBe(400);
    expect(
      (await request("videos.playback", { id: 11501 }, null)).data,
    ).toEqual({
      id: 11501,
      provider: "youtube",
      youtubeId: "vkpublic001",
      videoUrl: null,
    });
  });
  it("fails closed when the unique source guard is missing", async () => {
    await conn.query("ALTER TABLE videos DROP INDEX videos_vk_source_unique");
    try {
      expect(
        (await request("admin.upsertVkVideo", input, admin, true)).code,
      ).toBe(500);
      expect((await request("videos.catalog", {}, null)).code).toBe(500);
      expect(
        (await request("videos.playback", { id: 11501 }, admin)).code,
      ).toBe(500);
      expect(
        await rows("SELECT id FROM videos WHERE title LIKE 'Owned VK%'"),
      ).toHaveLength(0);
    } finally {
      await conn.query(
        "ALTER TABLE videos ADD UNIQUE videos_vk_source_unique (vkSourceKey)",
      );
    }
  });
  it("rejects corrupted source evidence instead of falling back to YouTube", async () => {
    const created = await request("admin.upsertVkVideo", input, admin, true);
    await conn.query(
      "UPDATE videos SET vkEmbedUrl='https://evil.example.test/private' WHERE id=?",
      [created.data.id],
    );
    expect(
      (await request("videos.playback", { id: created.data.id }, admin)).code,
    ).toBe(500);
  });
  it("uses the unique source guard across independent administrators", async () => {
    await conn.query("UPDATE users SET role='admin' WHERE id=9154");
    const secondAdmin = await sdk.createSessionToken("vk-other", {
      sessionVersion: 0,
    });
    const replies = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        request(
          "admin.upsertVkVideo",
          input,
          index % 2 ? admin : secondAdmin,
          true,
        ),
      ),
    );
    expect(replies.map((reply) => reply.code)).toEqual(Array(8).fill(200));
    expect(new Set(replies.map((reply) => reply.data.id)).size).toBe(1);
    expect(
      await rows("SELECT id FROM videos WHERE title LIKE 'Owned VK%'"),
    ).toHaveLength(1);
  });
  it("rolls back an interrupted insertion and permits retry of the same source", async () => {
    await conn.query(
      "CREATE TRIGGER owned_vk_insert_failure BEFORE INSERT ON videos FOR EACH ROW BEGIN IF NEW.title='Owned VK fixture' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='owned synthetic insert failure'; END IF; END",
    );
    try {
      expect(
        (await request("admin.upsertVkVideo", input, admin, true)).code,
      ).toBe(500);
      expect(
        await rows("SELECT id FROM videos WHERE title LIKE 'Owned VK%'"),
      ).toHaveLength(0);
    } finally {
      await conn.query("DROP TRIGGER owned_vk_insert_failure");
    }
    expect(
      (await request("admin.upsertVkVideo", input, admin, true)).code,
    ).toBe(200);
  });
  it("rechecks revoked admin identity inside the transaction", async () => {
    const actor = await getUserById(9150);
    expect(actor).toBeDefined();
    await conn.beginTransaction();
    try {
      await conn.query("SELECT id FROM users WHERE id=9150 FOR UPDATE");
      const pending = upsertVkVideo(actor!, { ...input, access: "club" });
      const assertion = expect(pending).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
      await conn.query("UPDATE users SET sessionVersion=1 WHERE id=9150");
      await conn.commit();
      await assertion;
      expect(
        await rows("SELECT id FROM videos WHERE title LIKE 'Owned VK%'"),
      ).toHaveLength(0);
    } finally {
      await conn.rollback();
    }
  });
  it("does not overwrite an existing source through another video's ID", async () => {
    const first = await request("admin.upsertVkVideo", input, admin, true);
    const otherInput = {
      ...input,
      embedUrl: embedUrl.replace("id=200", "id=201"),
      title: "Owned VK second",
    };
    const second = await request(
      "admin.upsertVkVideo",
      otherInput,
      admin,
      true,
    );
    expect(
      (
        await request(
          "admin.upsertVkVideo",
          { ...input, id: second.data.id },
          admin,
          true,
        )
      ).code,
    ).toBe(409);
    expect(
      await rows("SELECT id,title FROM videos WHERE id IN (?,?) ORDER BY id", [
        first.data.id,
        second.data.id,
      ]),
    ).toEqual([
      { id: first.data.id, title: input.title },
      { id: second.data.id, title: otherInput.title },
    ]);
  });
  it("preserves old YouTube data when applying the actual additive migration", async () => {
    let created = false;
    try {
      await conn.query("CREATE TABLE owned_vk_migration_fixture LIKE videos");
      created = true;
      await conn.query(
        "ALTER TABLE owned_vk_migration_fixture DROP INDEX videos_vk_source_unique,DROP COLUMN provider,DROP COLUMN access,DROP COLUMN vkEmbedUrl,DROP COLUMN vkSourceKey,MODIFY COLUMN youtubeId VARCHAR(32) NOT NULL",
      );
      await conn.query(
        "INSERT INTO owned_vk_migration_fixture (id,youtubeId,title,duration,videoUrl,published,sortOrder) VALUES (11501,'vkoldrow001','Owned VK migration','04:12','https://media.example.test/public.mp4',TRUE,3)",
      );
      const original = (
        await rows("SELECT * FROM owned_vk_migration_fixture WHERE id=11501")
      )[0];
      await conn.query(
        (
          await readFile(
            new URL(
              "../packages/database/drizzle/0031_vk_catalog_access.sql",
              import.meta.url,
            ),
            "utf8",
          )
        ).replace(
          "ALTER TABLE `videos`",
          "ALTER TABLE `owned_vk_migration_fixture`",
        ),
      );
      const updated = (
        await rows("SELECT * FROM owned_vk_migration_fixture WHERE id=11501")
      )[0];
      const { provider, access, vkEmbedUrl, vkSourceKey, ...oldFields } =
        updated;
      expect(oldFields).toEqual(original);
      expect({ provider, access, vkEmbedUrl, vkSourceKey }).toEqual({
        provider: "youtube",
        access: "public",
        vkEmbedUrl: null,
        vkSourceKey: null,
      });
    } finally {
      if (created) await conn.query("DROP TABLE owned_vk_migration_fixture");
    }
  });
  it("rejects new access or provider fields on the legacy public import", async () => {
    for (const extra of [
      { access: "club" },
      { provider: "vk" },
      { vkEmbedUrl: embedUrl },
    ]) {
      const reply = await request(
        "admin.importVideos",
        {
          videos: [
            {
              youtubeId: "vkimport001",
              title: "Owned VK forbidden import",
              ...extra,
            },
          ],
        },
        admin,
        true,
      );
      expect(reply.code).toBe(400);
    }
    expect(
      await rows("SELECT id FROM videos WHERE youtubeId='vkimport001'"),
    ).toHaveLength(0);
  });
});
