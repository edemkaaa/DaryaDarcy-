import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname } from "node:path";
import type { AddressInfo } from "node:net";
import { createConnection } from "mysql2/promise";
import { createBackendApplication } from "../../apps/backend/src/_core/application";
import { hashPassword } from "../../apps/backend/src/_core/password";
import { getDb } from "../../apps/backend/src/db";
import { openPrivateUploadWire } from "./private-upload-wire";
import { assertTestDatabase } from "../../tooling/scripts/test-database-policy";

async function main() {
  const file = process.env.DARYADARCY_EDITOR_FIXTURE_FILE;
  if (!file || !basename(dirname(file)).startsWith("darcy-editor-acceptance-"))
    throw new Error("Owned editor acceptance fixture required");
  const fixture = JSON.parse(await readFile(file, "utf8"));
  assertTestDatabase(fixture.databaseUrl);
  if (process.env.DATABASE_URL !== fixture.databaseUrl)
    throw new Error("Fixture database mismatch");
  const connection = await createConnection(fixture.databaseUrl);
  try {
    const [rows] = await connection.query("SELECT id FROM users LIMIT 1");
    if ((rows as unknown[]).length)
      throw new Error("Editor acceptance requires its empty database");
    const hash = await hashPassword(fixture.password);
    for (const id of [501, 502]) {
      await connection.query(
        "INSERT INTO users(id,openId,email,name,gender,role,loginMethod,passwordHash) VALUES(?,?,?,?, 'female','admin','email',?)",
        [
          id,
          `editor-acceptance-${id}`,
          `editor${id}@example.test`,
          `Editor ${id}`,
          hash,
        ],
      );
    }
  } finally {
    await connection.end();
  }
  const wire = await openPrivateUploadWire({
    content: true,
    attachments: true,
  });
  Object.assign(process.env, {
    S3_ENDPOINT: wire.endpoint,
    S3_BUCKET: wire.bucket,
    S3_ACCESS_KEY: "editor-acceptance-fixture",
    S3_SECRET_KEY: "editor-acceptance-fixture-secret",
    PRIVATE_CONTENT_FILES_ENABLED: "true",
    PRIVATE_CONTENT_DELIVERY_ENABLED: "true",
    PRIVATE_POST_MEDIA_UPLOAD_ENABLED: "true",
    PRIVATE_POST_MEDIA_DELIVERY_ENABLED: "true",
    CONTENT_EDIT_REVISIONS_REQUIRED: "true",
  });
  const app = await createBackendApplication();
  await app.listen(0, "127.0.0.1");
  fixture.api = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  await writeFile(file, JSON.stringify(fixture), { mode: 0o600 });
  console.log(
    "Own real API ready; strict revisions enabled only in this fixture.",
  );
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    await app.close();
    await wire.close();
    const db = await getDb();
    await (
      db as unknown as { $client?: { end(): Promise<void> } } | null
    )?.$client?.end();
    process.exit(0);
  };
  process.once("SIGTERM", () => void close());
  process.once("SIGINT", () => void close());
}
void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
