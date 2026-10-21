import { expect, it } from "vitest";
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";

it.skipIf(!testDatabaseUrl)(
  "keeps raw public uploads retired in compiled ESM regardless of live account state",
  async () => {
    const directory = mkdtempSync(resolve(".tmp-nest-raw-video-"));
    const entry = join(directory, "application.mjs");
    const conn = await openTestDatabase();
    try {
      await conn.query(
        "INSERT INTO users (id,openId,role) VALUES (9021,'built-raw-video-admin','admin')",
      );
      // Same bundle flags as production, but no env-file loader or worker jobs.
      // The isolated child inherits no deployment/database/provider credentials.
      await build({
        stdin: {
          resolveDir: process.cwd(),
          loader: "ts",
          contents: `
            import { createBackendApplication } from "./apps/backend/src/_core/application";
            import { sdk } from "./apps/backend/src/_core/sdk";
            import { getDb } from "./apps/backend/src/db";
            const application = await createBackendApplication();
            try {
              await application.listen(0, "127.0.0.1");
              const base = "http://127.0.0.1:" + application.getHttpServer().address().port;
              const bearer = await sdk.createSessionToken("built-raw-video-admin", {sessionVersion: 0});
              const upload = async body => {
                const response = await fetch(base + "/api/admin/upload-video", {
                  method: "POST",
                  headers: { Authorization: "Bearer " + bearer, "Content-Type": "video/mp4" },
                  body,
                  signal: AbortSignal.timeout(3000),
                });
                return {status: response.status, body: await response.json()};
              };
              const results = [await upload(Buffer.alloc(0)), await upload(Buffer.from("<html>not a video</html>"))];
              const database = await getDb();
              await database.$client.query("UPDATE users SET role='user' WHERE id=9021");
              results.push(await upload(Buffer.from("invalid video")));
              await database.$client.query("UPDATE users SET role='admin',blockedAt=NOW() WHERE id=9021");
              results.push(await upload(Buffer.from("invalid video")));
              console.log("RAW_VIDEO_RESULTS:" + JSON.stringify(results));
            } finally {
              await application.close();
              const database = await getDb();
              await database?.$client.end();
            }
          `,
        },
        platform: "node",
        packages: "external",
        bundle: true,
        format: "esm",
        outfile: entry,
      });
      const output = execFileSync(process.execPath, [entry], {
        cwd: tmpdir(),
        env: {
          NODE_ENV: "production",
          DATABASE_URL: testDatabaseUrl!,
          JWT_SECRET: "isolated-built-raw-video-fixture-secret",
          PUBLIC_APP_URL: "https://club.example.test",
        },
        encoding: "utf8",
        timeout: 10_000,
      });
      const result = output
        .split("\n")
        .find((line) => line.startsWith("RAW_VIDEO_RESULTS:"));
      expect(result).toBeDefined();
      expect(JSON.parse(result!.slice("RAW_VIDEO_RESULTS:".length))).toEqual([
        ...Array.from({ length: 4 }, () => ({
          status: 404,
          body: {
            error:
              "Публичная загрузка отключена. Используйте защищённую загрузку файлов.",
          },
        })),
      ]);
    } finally {
      await conn.query("DELETE FROM users WHERE id=9021");
      await conn.end();
      rmSync(entry, { force: true });
      rmdirSync(directory);
    }
  },
  15_000,
);
