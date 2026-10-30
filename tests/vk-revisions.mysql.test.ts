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
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import superjson from "superjson";
import { openVideoTestDatabase } from "./helpers/video-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { getDb } from "../apps/backend/src/db";
import { sdk } from "../apps/backend/src/_core/sdk";

describe.skipIf(!testDatabaseUrl)("VK edit revisions over native HTTP", () => {
  let conn: Connection,
    app: INestApplication,
    base: string,
    admin: string,
    other: string;
  const input = {
    title: "Owned revision video",
    embedUrl: "https://vk.ru/video_ext.php?oid=-100&id=800",
    access: "club",
    published: false,
  };
  async function cleanup() {
    await conn.query("DELETE FROM videos WHERE title LIKE 'Owned revision%'");
    await conn.query("DELETE FROM users WHERE id IN (990850,990851)");
  }
  beforeAll(async () => {
    conn = await openVideoTestDatabase();
    vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
    vi.stubEnv("JWT_SECRET", "owned-revision-test-key");
    vi.stubEnv("VK_CATALOG_ENABLED", "true");
    app = await createBackendApplication();
    await app.listen(0, "127.0.0.1");
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  beforeEach(async () => {
    await cleanup();
    vi.stubEnv("CONTENT_EDIT_REVISIONS_REQUIRED", "false");
    await conn.query(
      "INSERT INTO users(id,openId,role) VALUES(990850,'revision-admin','admin'),(990851,'revision-other','admin')",
    );
    [admin, other] = await Promise.all(
      ["revision-admin", "revision-other"].map((id) =>
        sdk.createSessionToken(id, { sessionVersion: 0 }),
      ),
    );
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
  async function request(
    path: string,
    value: unknown,
    token = admin,
    write = false,
  ) {
    const encoded = superjson.stringify(value);
    const r = await fetch(
      base +
        "/api/trpc/admin." +
        path +
        (write ? "" : "?input=" + encodeURIComponent(encoded)),
      {
        method: write ? "POST" : "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(write ? { body: encoded } : {}),
      },
    );
    const b = await r.json();
    return {
      status: r.status,
      data: b.result
        ? superjson.deserialize<any>(b.result.data)
        : b.error?.json?.data?.code,
    };
  }
  const write = (v: unknown, token = admin) =>
    request("upsertVkVideo", v, token, true);
  const detail = (id: number, token = admin) =>
    request("vkVideoDetail", { id }, token);
  it("exposes an editable revision and rejects the stale administrator without replacing content", async () => {
    const created = await write(input);
    expect(created.status).toBe(200);
    const id = created.data.id;
    const before = await detail(id);
    expect(before.status).toBe(200);
    expect(before.data).toMatchObject({
      id,
      editRevision: 0,
      title: input.title,
    });
    expect(
      (
        await write({
          ...input,
          id,
          title: "Owned revision first",
          expectedRevision: 0,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await write(
          { ...input, id, title: "Owned revision stale", expectedRevision: 0 },
          other,
        )
      ).status,
    ).toBe(409);
    expect((await detail(id)).data).toMatchObject({
      title: "Owned revision first",
      editRevision: 1,
    });
    expect(
      (await write({ ...input, id, expectedRevision: 1 }, other)).status,
    ).toBe(200);
    expect((await detail(id)).data.editRevision).toBe(2);
  });
  it("accepts exactly one concurrent update with the same revision", async () => {
    const {
      data: { id },
    } = await write(input);
    const replies = await Promise.all([
      write({ ...input, id, title: "Owned revision A", expectedRevision: 0 }),
      write(
        { ...input, id, title: "Owned revision B", expectedRevision: 0 },
        other,
      ),
    ]);
    expect(replies.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await detail(id)).data.editRevision).toBe(1);
  });
  it("requires a revision when the existing strict switch is on, preserving legacy compatibility while off", async () => {
    const {
      data: { id },
    } = await write(input);
    expect((await write({ ...input, id })).status).toBe(200);
    vi.stubEnv("CONTENT_EDIT_REVISIONS_REQUIRED", "true");
    expect((await write({ ...input, id })).status).toBe(412);
    expect((await write({ ...input, id, expectedRevision: 1 })).status).toBe(
      200,
    );
    expect((await detail(id)).data.editRevision).toBe(2);
  });
  it("keeps source creation idempotent and checks fresh rights before revision/detail", async () => {
    const first = await write(input);
    expect(await write(input)).toEqual(first);
    const id = first.data.id;
    expect((await detail(id)).data.editRevision).toBe(0);
    await conn.query("UPDATE users SET role='user' WHERE id=990850");
    expect((await detail(id)).status).toBe(403);
    expect((await write({ ...input, id, expectedRevision: 0 })).status).toBe(
      403,
    );
    expect((await detail(id, "")).status).toBe(401);
    expect((await detail(99999999, other)).status).toBe(404);
  });
  it.each([-1, 1.5, "0", Number.MAX_SAFE_INTEGER + 1])(
    "rejects malformed expected revision %j",
    async (expectedRevision) => {
      const {
        data: { id },
      } = await write(input);
      expect((await write({ ...input, id, expectedRevision })).status).toBe(
        400,
      );
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT title FROM videos WHERE id=?",
        [id],
      );
      expect(rows).toEqual([{ title: input.title }]);
    },
  );
});
