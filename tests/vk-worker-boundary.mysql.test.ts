import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import type { Connection } from "mysql2/promise";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { openVideoTestDatabase } from "./helpers/video-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { getDb } from "../apps/backend/src/db";

describe.skipIf(!testDatabaseUrl)(
  "live SQL API to native anonymous worker",
  () => {
    let conn: Connection, app: INestApplication, api: string;
    beforeAll(async () => {
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
    conn = await openVideoTestDatabase();
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      api = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
      await conn.query(
        "INSERT INTO videos (id,youtubeId,title,access) VALUES (11511,'vkworker001','Owned worker public','public'),(11512,'vkworker002','Owned worker club','club')",
      );
    });
    afterAll(async () => {
      await app?.close();
      if (conn) {
        await conn.query("DELETE FROM videos WHERE id BETWEEN 11511 AND 11512");
        await conn.end();
      }
      const db = await getDb();
      await (
        db as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    it("denies retired YouTube GET HEAD Range and thumbnails despite warm media cache", async () => {
      const moduleUrl = (file: string) =>
        JSON.stringify(pathToFileURL(resolve("apps/video-service", file)).href);
      const script = `
      import {createVideoServer} from ${moduleUrl("server.mjs")};
      import {readPublicCatalog} from ${moduleUrl("upstream.mjs")};
      import {createVideoCache} from ${moduleUrl("cache.mjs")};
      import {mkdtemp,writeFile,rm} from 'node:fs/promises';
      import {tmpdir} from 'node:os';import {join} from 'node:path';
      const root=await mkdtemp(join(tmpdir(),'owned-vk-worker-'));
      const cache=await createVideoCache({root,prepare:async(id,directory)=>{
        await writeFile(join(directory,'video.mp4'),Buffer.from('0123456789'));
      }});
      const lease=await cache.acquire('vkworker001');lease.release();
      const server=createVideoServer({cache,readCatalog:signal=>readPublicCatalog(${JSON.stringify(api + "/api/trpc/videos.list")},signal),readThumbnail:async()=>Buffer.from([255,216,255])});
      await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
      console.log('WORKER_URL:http://127.0.0.1:'+server.address().port);
      process.once('SIGTERM',async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await cache.close();await rm(root,{recursive:true,force:true});});
    `;
      const child = spawn(
        process.execPath,
        ["--input-type=module", "-e", script],
        { env: { NODE_ENV: "test" }, stdio: ["ignore", "pipe", "pipe"] },
      );
      const closed = new Promise<void>((resolve) =>
        child.once("exit", () => resolve()),
      );
      try {
        const base = await new Promise<string>((resolve, reject) => {
          let output = "";
          const deadline = setTimeout(
            () => reject(Error("Owned worker startup timeout")),
            10000,
          );
          const finish = (error?: Error, value?: string) => {
            clearTimeout(deadline);
            error ? reject(error) : resolve(value!);
          };
          child.once("error", (error) => finish(error));
          child.once("exit", () =>
            finish(Error("Owned worker exited before acceptance")),
          );
          child.stdout!.on("data", (chunk) => {
            output += String(chunk);
            const line = output
              .split("\n")
              .find((line) => line.startsWith("WORKER_URL:"));
            if (line) finish(undefined, line.slice(11));
          });
        });
        // Prepared bytes exist, but the API no longer authorizes any old ID.
        for (const id of ["vkworker001", "vkworker002"])
          for (const [path, options] of [
            [`/api/yt/${id}`, {}],
            [`/api/yt/${id}`, { method: "HEAD" }],
            [`/api/yt/${id}`, { headers: { Range: "bytes=0-3" } }],
            [`/media/yt-thumb/${id}/hqdefault.jpg`, {}],
          ] as const)
            expect((await fetch(base + path, options)).status).toBe(404);
        await conn.query(
          "UPDATE videos SET access='public',published=FALSE WHERE id=11511",
        );
        expect((await fetch(base + "/api/yt/vkworker001")).status).toBe(404);
      } finally {
        child.kill("SIGTERM");
        await closed;
      }
    }, 20000);
  },
);
