import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Connection, Pool } from "mysql2/promise";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import superjson from "superjson";
import { openContentTestDatabase } from "./helpers/content-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { getDb } from "../apps/backend/src/db";

describe.skipIf(!testDatabaseUrl)("single-video public publication authority", () => {
  let conn: Connection, app: INestApplication, base: string;
  beforeAll(async () => {
    conn = await openContentTestDatabase(); vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
    await conn.query("INSERT INTO videos(youtubeId,title,provider,access,published) VALUES ?", [Array.from({ length: 1001 }, (_, i) => [`ytbound${String(i).padStart(4, "0")}`, "Large catalog fixture", "youtube", "public", true])]);
    app = await createBackendApplication(); await app.listen(0, "127.0.0.1");
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await app?.close(); await conn?.query("DELETE FROM videos WHERE youtubeId LIKE 'ytbound%'"); await conn?.end();
    await ((await getDb()) as unknown as { $client: Pool })?.$client.end(); vi.unstubAllEnvs();
  });
  async function query(youtubeId: string) {
    const response = await fetch(`${base}/api/trpc/videos.publicYoutubeState?input=${encodeURIComponent(superjson.stringify({ youtubeId }))}`);
    const text = await response.text();
    return { response, text, body: JSON.parse(text) };
  }
  it("uses a bounded authority response even beyond 1000 catalog records and revokes visibility immediately", async () => {
    const first = await query("ytbound0000");
    expect(first.response.status).toBe(200); expect(first.text.length).toBeLessThan(256);
    expect(first.body.result.data.json).toEqual({ published: true });
    for (const patch of ["access='club'", "access='public',published=0", "published=1,provider='vk'"]) {
      await conn.query(`UPDATE videos SET ${patch} WHERE youtubeId='ytbound0000'`);
      const result = await query("ytbound0000"); expect(result.response.status).toBe(200);
      expect(result.body.result.data.json).toEqual({ published: false });
    }
    expect((await query("ytbound9999")).body.result.data.json).toEqual({ published: false });
    expect((await query("../not-video")).response.status).toBe(400);
  });
});
