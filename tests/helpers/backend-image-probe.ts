import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import sharp from "sharp";

assert.equal(process.getuid?.(), 1000);
assert.equal(process.arch, "x64");
assert(!process.env.DATABASE_URL);
assert(!process.env.S3_ACCESS_KEY_ID && !process.env.SMTP_HOST);
await assert.rejects(access("/app/apps/frontend"));
await assert.rejects(access("/app/.env"));
await assert.rejects(access("/app/packages/database/drizzle"));
assert((await readFile("/app/dist/index.mjs")).length > 1000);
assert.match(
  execFileSync("mysqldump", ["--version"], { encoding: "utf8" }),
  /MariaDB|MySQL/i,
);
const pixel = await sharp({
  create: { width: 1, height: 1, channels: 3, background: "white" },
})
  .png()
  .toBuffer();
assert.equal((await sharp(pixel).metadata()).width, 1);
process.env.PUBLIC_APP_URL = "https://candidate.example.test";
process.env.JWT_SECRET =
  "local-offline-image-probe-only-not-a-real-session-key";
const { createBackendApplication } =
  await import("../../apps/backend/src/_core/application");
const app = await createBackendApplication();
try {
  await app.listen(0, "127.0.0.1");
  const port = (app.getHttpServer().address() as { port: number }).port;
  for (const [path, status] of [
    ["/api/auth/me", 200],
    ["/api/launch-config", 200],
    ["/api/admin/launch-settings", 401],
    ["/api/trpc/admin.stats", 401],
    ["/api/library/materials/recipes/files", 404],
    ["/api/media/content-files/3af23d8c-140f-454b-a123-123456789abc", 404],
  ] as const) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    assert.equal(response.status, status, path);
    if (path === "/api/auth/me")
      assert.equal((await response.json()).user, null);
    else await response.arrayBuffer();
  }
  console.log(
    JSON.stringify({
      httpChecks: 6,
      workersStarted: false,
      databaseChecked: false,
      providersConfigured: false,
      sharp: sharp.versions.sharp,
    }),
  );
} finally {
  await app.close();
}
