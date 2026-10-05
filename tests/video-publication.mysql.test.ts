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
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";

const external = vi.hoisted(() => ({
  commands: [] as string[][],
  upstream: [] as string[],
}));
vi.mock("node:child_process", () => ({
  // Mirror execFile's custom promisified result; never run a real downloader.
  execFile: Object.assign(
    () => {
      throw new Error("Unexpected callback invocation");
    },
    {
      [Symbol.for("nodejs.util.promisify.custom")]: async (
        _file: string,
        args: string[],
      ) => {
        external.commands.push(args);
        return {
          stdout: "https://media.example.test/fixture.mp4\n",
          stderr: "",
        };
      },
    },
  ),
}));
import type { AppRouter } from "../apps/backend/src/routers";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { getDb, getVideoByYoutubeId } from "../apps/backend/src/db";

const httpFetch = globalThis.fetch;
describe.skipIf(!testDatabaseUrl)(
  "public video HTTP boundaries on disposable MySQL",
  () => {
    let conn: Connection, application: INestApplication, base: string;
    let client: ReturnType<typeof createTRPCProxyClient<AppRouter>>;
    beforeAll(async () => {
      conn = await openTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      await conn.query(`CREATE TABLE IF NOT EXISTS videos (
      id INT AUTO_INCREMENT PRIMARY KEY,youtubeId VARCHAR(32) NOT NULL UNIQUE,
      title VARCHAR(512) NOT NULL,duration VARCHAR(16),thumbnailUrl TEXT,videoUrl TEXT,
      views VARCHAR(32),publishedText VARCHAR(64),sortOrder INT NOT NULL DEFAULT 0,
      published BOOLEAN NOT NULL DEFAULT TRUE,createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
      application = await createBackendApplication();
      await application.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(application.getHttpServer().address() as AddressInfo).port}`;
      client = createTRPCProxyClient<AppRouter>({
        links: [
          httpLink({
            url: `${base}/api/trpc`,
            transformer: superjson,
            fetch: httpFetch,
          }),
        ],
      });
      vi.stubGlobal("fetch", async (url: string, options?: RequestInit) => {
        if (url !== "https://media.example.test/fixture.mp4")
          throw new Error("Unexpected upstream URL");
        external.upstream.push(url);
        if ((options?.headers as Record<string, string>)?.Range === "bytes=0-3")
          return new Response("test", {
            status: 206,
            headers: {
              "content-type": "video/mp4",
              "content-range": "bytes 0-3/8",
              "accept-ranges": "bytes",
              "content-length": "4",
            },
          });
        return new Response("fixture", {
          status: 200,
          headers: { "content-type": "video/mp4" },
        });
      });
    });
    beforeEach(async () => {
      external.commands = [];
      external.upstream = [];
      await conn.query("DELETE FROM videos WHERE id BETWEEN 10901 AND 10906");
      await conn.query(`INSERT INTO videos (id,youtubeId,title,videoUrl,published,sortOrder) VALUES
      (10901,'auditpub001','Café','https://media.example.test/public.mp4',TRUE,0),
      (10902,'audithid001','Hidden title','https://media.example.test/secret-video.mp4',FALSE,1),
      (10903,'auditrev001','Revoked fixture','https://media.example.test/revoked.mp4',TRUE,2)`);
    });
    afterAll(async () => {
      vi.unstubAllGlobals();
      await application?.close();
      await conn?.query("DELETE FROM videos WHERE id BETWEEN 10901 AND 10906");
      await conn?.end();
      const database = await getDb();
      await (
        database as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    it("does not disclose a hidden video or its media URL by public numeric ID", async () => {
      expect(await client.videos.getById.query({ id: 10902 })).toBeUndefined();
    });
    it("keeps published detail and list available, with hidden rows excluded", async () => {
      expect(await client.videos.getById.query({ id: 10901 })).toMatchObject({
        id: 10901,
        title: "Café",
      });
      expect(
        (await client.videos.list.query())
          .filter((row) => row.id >= 10901 && row.id <= 10906)
          .map((row) => row.id),
      ).toEqual([10901, 10903]);
      expect(await client.videos.getById.query({ id: 10906 })).toBeUndefined();
    });
    it("keeps unpublished entries available to internal import deduplication", async () => {
      expect(await getVideoByYoutubeId("audithid001")).toMatchObject({
        id: 10902,
        published: false,
      });
    });
    it.each(["audithid001", "auditunk001"])(
      "refuses %s before any external downloader or media request",
      async (id) => {
        const response = await httpFetch(`${base}/api/yt/${id}`);
        expect(response.status).toBe(404);
        expect(external.commands).toEqual([]);
        expect(external.upstream).toEqual([]);
      },
    );
    it("streams a published catalog entry with Range semantics preserved", async () => {
      const response = await httpFetch(`${base}/api/yt/auditpub001`, {
        headers: { Range: "bytes=0-3" },
      });
      expect(response.status).toBe(206);
      expect(response.headers.get("content-range")).toBe("bytes 0-3/8");
      expect(response.headers.get("content-type")).toBe("video/mp4");
      expect(await response.text()).toBe("test");
      expect(external.commands[0]?.at(-1)).toBe(
        "https://www.youtube.com/watch?v=auditpub001",
      );
    });
    it("rechecks publication even when playback resolution is cached", async () => {
      const first = await httpFetch(`${base}/api/yt/auditrev001`);
      expect(first.status).toBe(200);
      await first.text();
      await conn.query("UPDATE videos SET published=FALSE WHERE id=10903");
      external.commands = [];
      external.upstream = [];
      const revoked = await httpFetch(`${base}/api/yt/auditrev001`);
      expect(revoked.status).toBe(404);
      expect(external.commands).toEqual([]);
      expect(external.upstream).toEqual([]);
    });
    it("rejects malformed YouTube IDs without external work", async () => {
      const response = await httpFetch(`${base}/api/yt/bad!`);
      expect(response.status).toBe(400);
      expect(external.commands).toEqual([]);
      expect(external.upstream).toEqual([]);
    });
  },
);
