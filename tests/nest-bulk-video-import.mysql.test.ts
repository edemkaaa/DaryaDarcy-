import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Connection, RowDataPacket } from "mysql2/promise";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { openVideoTestDatabase } from "./helpers/video-mysql";
import { getDb } from "../apps/backend/src/db";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import type { AppRouter } from "../apps/backend/src/routers";

// The HTTP importer is retired. Legacy repository/backup data remains intact.
describe.skipIf(!testDatabaseUrl)(
  "retired YouTube import over real HTTP/JWT/MySQL",
  () => {
    let conn: Connection, app: INestApplication, base: string;
    beforeAll(async () => {
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "bulk-video-synthetic-secret-32");
      conn = await openVideoTestDatabase();
      await conn.query(
        "INSERT INTO users(id,openId,role) VALUES (8460,'bulk-http-admin','admin'),(8461,'bulk-http-member','user')",
      );
      await conn.query(
        "INSERT INTO videos(youtubeId,title,published) VALUES ('bulk-http-existing','Existing title',FALSE)",
      );
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    });
    afterAll(async () => {
      await app?.close();
      if (conn) {
        await conn.query(
          "DELETE FROM videos WHERE youtubeId IN ('bulk-http-existing','bulk-http-first')",
        );
        await conn.query("DELETE FROM users WHERE id IN (8460,8461)");
        await conn.end();
      }
      await (
        (await getDb()) as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    function client(actor: "admin" | "member" | null = "admin") {
      return createTRPCProxyClient<AppRouter>({
        links: [
          httpLink({
            url: base + "/api/trpc",
            transformer: superjson,
            headers: async () =>
              actor
                ? {
                    Authorization: `Bearer ${await sdk.createSessionToken(`bulk-http-${actor}`, { sessionVersion: 0 })}`,
                  }
                : {},
          }),
        ],
      });
    }
    async function rows() {
      return (
        await conn.query<RowDataPacket[]>(
          "SELECT * FROM videos WHERE youtubeId IN ('bulk-http-existing','bulk-http-first') ORDER BY youtubeId",
        )
      )[0];
    }
    it.each([
      { videos: [{ youtubeId: "bulk-http-first", title: "New video" }] },
      {
        videos: [
          { youtubeId: "bulk-http-existing", title: "Do not overwrite" },
        ],
      },
      { videos: [] },
    ])(
      "refuses validated input without writes or overwrites: %j",
      async (input) => {
        const before = await rows();
        for (let attempt = 0; attempt < 2; attempt++) {
          await expect(
            client().admin.importVideos.mutate(input),
          ).rejects.toMatchObject({
            data: { code: "NOT_FOUND", httpStatus: 404 },
          });
          expect(await rows()).toEqual(before);
        }
      },
    );
    it.each([null, "member"] as const)(
      "preserves %s authentication refusal",
      async (actor) => {
        const before = await rows();
        await expect(
          client(actor).admin.importVideos.mutate({
            videos: [{ youtubeId: "bulk-http-first", title: "Not allowed" }],
          }),
        ).rejects.toMatchObject({ data: { httpStatus: actor ? 403 : 401 } });
        expect(await rows()).toEqual(before);
      },
    );
  },
);
