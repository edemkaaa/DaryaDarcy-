import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname } from "node:path";
import type { AddressInfo } from "node:net";
import { createConnection } from "mysql2/promise";
import { createBackendApplication } from "../../apps/backend/src/_core/application";
import { hashPassword } from "../../apps/backend/src/_core/password";
import { getDb } from "../../apps/backend/src/db";
import { openPrivateUploadWire } from "./private-upload-wire";
import { assertTestDatabase } from "../../tooling/scripts/test-database-policy";
import { parseVkEmbed } from "../../apps/backend/src/content/vk-video-input";

async function main() {
  // Требует принадлежащий тесту файл и пустую одноразовую БД; создаёт синтетические аккаунты, локальный S3 wire и API без почтовых/платёжных workers.

  const file = process.env.DARYADARCY_EDITOR_FIXTURE_FILE;
  if (!file || !basename(dirname(file)).startsWith("darcy-editor-acceptance-"))
    throw new Error("Owned editor acceptance fixture required");
  const fixture = JSON.parse(await readFile(file, "utf8"));
  const recovery = process.env.DARYADARCY_RECOVERY_ACCEPTANCE === "true";
  const checkout = process.env.DARYADARCY_CHECKOUT_ACCEPTANCE === "true";
  if ((recovery && checkout) || (checkout && fixture.profile !== "checkout"))
    throw new Error("Acceptance profile mismatch");
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
    if (recovery) {
      await connection.query(
        "INSERT INTO users(id,openId,email,name,gender,role) VALUES(503,'recovery-member','member@example.test','Real recovery member','female','user')",
      );
      const embed =
        "https://vkvideo.ru/video_ext.php?oid=-1&id=2&hash=abcdefgh";
      await connection.query(
        "INSERT INTO videos(id,provider,youtubeId,vkSourceKey,vkEmbedUrl,title,access,published,editRevision) VALUES(18,'vk',NULL,?,?,'Original title','club',FALSE,0)",
        [parseVkEmbed(embed)!.sourceKey, embed],
      );
    }
    // Согласованный checkout-профиль использует fixture payform и не запускает отправку писем или реальный платёжный worker.
  if (checkout) {
      for (const id of [503, 504])
        await connection.query(
          "INSERT INTO users(id,openId,email,name,gender,role,loginMethod,passwordHash) VALUES(?,?,?,?,'female','user','email',?)",
          [
            id,
            `checkout-buyer-${id}`,
            `buyer${id}@example.test`,
            `Checkout buyer ${id}`,
            hash,
          ],
        );
    }
  } finally {
    await connection.end();
  }
  // Синтетические storage credentials относятся к локальному wire и не дают доступа к настоящему бакету.
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
    CONTENT_EDIT_REVISIONS_REQUIRED: recovery || checkout ? "false" : "true",
  });
  if (recovery)
    Object.assign(process.env, {
      VK_CATALOG_ENABLED: "true",
      AUTH_LINK_ENCRYPTION_KEY: Buffer.alloc(32, 13).toString("base64"),
    });
  if (checkout)
    Object.assign(process.env, {
      NORMAL_CHECKOUT_RECOVERY_ENABLED: "true",
      GUEST_CHECKOUT_RECOVERY_ENABLED: "true",
      PRODAMUS_TEST_ENABLED: "false",
      YOOKASSA_TEST_ENABLED: "false",
      PRODAMUS_PAYFORM_URL: "https://fixture.payform.ru",
      PRODAMUS_SECRET: "synthetic-checkout-merchant-key",
      PRODAMUS_SUBSCRIPTION_ID: "123",
      AUTH_LINK_ENCRYPTION_KEY: Buffer.alloc(32, 13).toString("base64"),
    });
  const app = await createBackendApplication();
  await app.listen(0, "127.0.0.1");
  fixture.api = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  await writeFile(file, JSON.stringify(fixture), { mode: 0o600 });
  console.log(
    checkout
      ? "Own NORMAL/GUEST API ready; strict OFF, no mail worker."
      : recovery
        ? "Own recovery API ready; strict OFF, no mail worker."
        : "Own real API ready; strict revisions enabled only in this fixture.",
  );
  let closing = false;
  const close = async () => {
    // Однократно закрывает API, wire и пул, не оставляя процессы фикстуры после сигнала остановки.

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
