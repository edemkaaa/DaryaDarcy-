import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { assertTestDatabase } from "../tooling/scripts/test-database-policy";
import { prepareBackupImage } from "./helpers/backup-release-image";

const sourceUrl = process.env.BACKUP_REHEARSAL_SOURCE_URL;
const targetUrl = process.env.BACKUP_REHEARSAL_TARGET_URL;
const sourceId = process.env.BACKUP_REHEARSAL_SOURCE_ID;
const targetId = process.env.BACKUP_REHEARSAL_TARGET_ID;
const root = fileURLToPath(new URL("../", import.meta.url));
const execute = promisify(execFile);
/** Репетирует native dump/restore отдельной fresh-БД с проверкой полных данных, DDL и recovery-связей. */
describe.skipIf(!sourceUrl || !targetUrl || !sourceId || !targetId)(
  "full fresh database backup and isolated native restore",
  () => {
    let source: Connection,
      target: Connection,
      directory: string,
      archive: string,
      sql: Buffer;
    let tables: string[],
      snapshot: Record<string, string>,
      ddl: Record<string, string>;
    let runImage: Awaited<ReturnType<typeof prepareBackupImage>> | undefined;
    /** Подтверждает owned loopback-container, tmpfs, отсутствие mounts и точный проброшенный MySQL-порт. */
    async function guard(id: string, uri: string) {
      const url = assertTestDatabase(uri);
      if (
        url.hostname !== "127.0.0.1" ||
        !url.port ||
        !/^[a-f0-9]{64}$/.test(id)
      )
        throw new Error("Unsafe fixture");
      const { stdout } = await execute("docker", [
        "inspect",
        id,
        "--format",
        '{"id":{{json .Id}},"name":{{json .Name}},"owner":{{json (index .Config.Labels "codex.owner")}},"ports":{{json .NetworkSettings.Ports}},"tmpfs":{{json .HostConfig.Tmpfs}},"mounts":{{json .Mounts}}}',
      ]);
      const fixture = JSON.parse(stdout),
        bindings = fixture.ports?.["3306/tcp"];
      if (
        fixture.id !== id ||
        !/^daryadarcy-fresh-backup-[a-z0-9-]+$/.test(fixture.owner) ||
        fixture.name !== `/${fixture.owner}` ||
        !fixture.tmpfs?.["/var/lib/mysql"] ||
        fixture.mounts.length !== 0 ||
        bindings?.length !== 1 ||
        bindings[0].HostIp !== "127.0.0.1" ||
        bindings[0].HostPort !== url.port
      )
        throw new Error("Unowned fixture");
    }
    /** Читает строки выбранного rehearsal-соединения для hash и schema-контроля. */
    async function rows(conn: Connection, query: string, args: unknown[] = []) {
      return (await conn.query<RowDataPacket[]>(query, args))[0];
    }
    /** Экранирует SQL-идентификатор таблицы удвоением backtick из проверенного SHOW TABLES. */
    function quote(name: string) {
      return "`" + name.replaceAll("`", "``") + "`";
    }
    /** Строит SHA-256 канонически отсортированных строк каждой таблицы для полного сравнения source и restore. */
    async function contents(conn: Connection) {
      const output: Record<string, string> = {};
      for (const table of tables) {
        const data = await rows(conn, `SELECT * FROM ${quote(table)}`);
        output[table] = createHash("sha256")
          .update(JSON.stringify(data.map((row) => JSON.stringify(row)).sort()))
          .digest("hex");
      }
      return output;
    }
    /** Читает точный SHOW CREATE TABLE всех таблиц для проверки engines, collations, generated expressions и индексов. */
    async function definitions(conn: Connection) {
      const output: Record<string, string> = {};
      for (const table of tables)
        output[table] = (
          await rows(conn, `SHOW CREATE TABLE ${quote(table)}`)
        )[0]!["Create Table"];
      return output;
    }
    /** Повторно проверяет владение и пустоту target и восстанавливает SQL только native-клиентом isolated-контейнера либо release image. */
    async function restore() {
      await guard(targetId!, targetUrl!);
      if ((await rows(target, "SHOW TABLES")).length)
        throw new Error("Restore target not empty");
      if (runImage) return runImage("restore", targetId!, targetUrl!, sql);
      // The password is synthetic and passed only to the isolated container's client.
      await new Promise<void>((resolve, reject) => {
        const child = spawn(
          "docker",
          [
            "exec",
            "-i",
            "-e",
            `MYSQL_PWD=${decodeURIComponent(new URL(targetUrl!).password)}`,
            targetId!,
            "mysql",
            "-uroot",
            "--binary-mode",
            "backend_test",
          ],
          { stdio: ["pipe", "ignore", "pipe"], timeout: 30000 },
        );
        child.stderr.resume();
        child.stdin.on("error", () => {});
        child.stdin.end(sql);
        child.on("error", () =>
          reject(new Error("Native restore could not start")),
        );
        child.on("close", (code) =>
          code === 0 ? resolve() : reject(new Error("Native restore failed")),
        );
      });
    }
    /** Создаёт fresh-source и synthetic контент, pending journals и library-bindings, затем получает закрытый gzip и восстанавливает в отдельный target. */
    beforeAll(async () => {
      expect(sourceId).not.toBe(targetId);
      expect(sourceUrl).not.toBe(targetUrl);
      await guard(sourceId!, sourceUrl!);
      await guard(targetId!, targetUrl!);
      directory = await mkdtemp(join(tmpdir(), "daryadarcy-backup-rehearsal-"));
      if (process.env.BACKUP_REHEARSAL_IMAGE)
        runImage = await prepareBackupImage(root, directory);
      source = await mysql.createConnection({ uri: sourceUrl!, timezone: "Z" });
      target = await mysql.createConnection({ uri: targetUrl!, timezone: "Z" });
      expect(await rows(source, "SHOW TABLES")).toEqual([]);
      expect(await rows(target, "SHOW TABLES")).toEqual([]);
      await execute(
        process.execPath,
        [
          "--import",
          "tsx",
          "tooling/scripts/fresh-database.ts",
          "--initialize-empty-local",
        ],
        {
          cwd: root,
          env: {
            PATH: process.env.PATH,
            FRESH_DATABASE_URL: sourceUrl,
            FRESH_DATABASE_CONTAINER_ID: sourceId,
          },
          timeout: 30000,
        },
      );
      await source.execute(
        "INSERT INTO users(id,openId,name,email) VALUES(70001,'backup-fixture-user','Тест 🧪','backup-fixture@example.test')",
      );
      await source.execute(
        "INSERT INTO posts(id,text,photos,tags) VALUES(70001,?,JSON_ARRAY(),JSON_ARRAY('fixture'))",
        ["Синтетический пост\nКавычки: ' \" 🧪"],
      );
      await source.execute(
        "INSERT INTO likes(userId,postId) VALUES(70001,70001)",
      );
      await source.execute(
        "INSERT INTO article_creation_requests(requestKey,actorUserId,payloadHash,claimToken) VALUES('backup-fixture-request',70001,?, 'backup-fixture-claim')",
        ["a".repeat(64)],
      );
      await source.execute(
        "INSERT INTO private_attachment_uploads(requestKey,actorUserId,assetId,payloadHash,namespaceHash,type,filename,mimeType,fileSize) VALUES('backup-fixture-upload',NULL,'backup-fixture-asset',?,?,'document','fixture.pdf','application/pdf',10)",
        ["b".repeat(64), "c".repeat(64)],
      );
      // Real SQL dump/restore must preserve both published references and unfinished intents.
      const libraryAsset = "00000000-0000-4000-8000-000000070001";
      const pendingAsset = "00000000-0000-4000-8000-000000070002";
      const libraryBinding = {
        id: 70001,
        materialKey: "recipes",
        fileKey: "main",
        assetId: libraryAsset,
        sortOrder: 0,
        enabled: true,
        revision: 1,
      };
      await source.execute(
        "INSERT INTO private_content_files(requestKey,actorUserId,assetId,payloadHash,namespaceHash,`usage`,filename,mimeType,fileSize,state,etag,parentKind,parentId) VALUES(?,70001,?,?,?,'libraryDocument','Материал 🧪.txt','text/plain; charset=utf-8',10,'ready','\"backup-library-etag\"','library',70001),(?,70001,?,?,?,'libraryDocument','pending.txt','text/plain; charset=utf-8',12,'pending',NULL,NULL,NULL)",
        [
          "1".repeat(64),
          libraryAsset,
          "2".repeat(64),
          "3".repeat(64),
          "4".repeat(64),
          pendingAsset,
          "5".repeat(64),
          "3".repeat(64),
        ],
      );
      await source.execute(
        "INSERT INTO library_file_bindings(id,materialKey,fileKey,assetId,sortOrder,enabled,revision) VALUES(70001,'recipes','main',?,0,TRUE,1)",
        [libraryAsset],
      );
      await source.execute(
        "INSERT INTO library_file_migrations(requestKey,payloadHash,plan,state,previous,result) VALUES(?,?,?,'committed',?,?),(?,?,?,'pending',NULL,NULL)",
        [
          "6".repeat(64),
          "7".repeat(64),
          JSON.stringify([libraryAsset]),
          JSON.stringify([null]),
          JSON.stringify([libraryBinding]),
          "8".repeat(64),
          "9".repeat(64),
          JSON.stringify([pendingAsset]),
        ],
      );
      tables = (await rows(source, "SHOW TABLES"))
        .map((row) => String(Object.values(row)[0]))
        .sort();
      snapshot = await contents(source);
      ddl = await definitions(source);
      if (runImage) {
        await guard(sourceId!, sourceUrl!);
        await runImage("backup", sourceId!, sourceUrl!);
      } else {
        await mkdir(join(directory, "bin"));
        const binary = join(directory, "bin", "mysqldump");
        await copyFile(
          join(root, "tests/fixtures/native-mysql-dump.cjs"),
          binary,
        );
        await chmod(binary, 0o700);
        vi.spyOn(process, "cwd").mockReturnValue(directory);
        vi.stubEnv("PATH", `${join(directory, "bin")}:${process.env.PATH}`);
        vi.stubEnv("DATABASE_URL", sourceUrl!);
        for (const key of [
          "S3_ENDPOINT",
          "S3_ACCESS_KEY",
          "S3_SECRET_KEY",
          "S3_BUCKET",
        ])
          vi.stubEnv(key, "");
        const { runMysqlBackupIfDue } =
          await import("../apps/backend/src/_core/backup");
        await runMysqlBackupIfDue(0);
      }
      const archives = await readdir(join(directory, "backups"));
      expect(archives).toHaveLength(1);
      archive = join(directory, "backups", archives[0]!);
      sql = gunzipSync(await readFile(archive));
      await restore();
      console.log(
        JSON.stringify({
          tables: tables.length,
          schemaSha256: createHash("sha256")
            .update(JSON.stringify(ddl))
            .digest("hex"),
          dataSha256: createHash("sha256")
            .update(JSON.stringify(snapshot))
            .digest("hex"),
          archiveSha256: createHash("sha256")
            .update(await readFile(archive))
            .digest("hex"),
          archiveBytes: (await stat(archive)).size,
        }),
      );
    }, 120000);
    /** Возвращает spies и окружение, закрывает source/target и удаляет только свою временную директорию rehearsal. */
    afterAll(async () => {
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
      await source?.end();
      await target?.end();
      if (directory) await rm(directory, { recursive: true });
    });
    /** Завершённый gzip имеет режим 600, backup-каталог 700 и не оставляет .partial. */
    it("creates a complete private gzip without partial artifacts", async () => {
      expect((await stat(archive)).mode & 0o777).toBe(0o600);
      expect((await stat(join(directory, "backups"))).mode & 0o777).toBe(0o700);
      expect(
        (await readdir(join(directory, "backups"))).filter((name) =>
          name.endsWith(".partial"),
        ),
      ).toEqual([]);
      expect(sql.length).toBeGreaterThan(1000);
    });
    /** При явном image подтверждает происхождение dump от MariaDB-клиента финального образа. */
    it.skipIf(!process.env.BACKUP_REHEARSAL_IMAGE)(
      "uses the release image's MariaDB client against the real MySQL source",
      () => {
        expect(sql.toString("utf8").slice(0, 200)).toContain("MariaDB dump");
      },
    );
    /** Данные и DDL source совпадают с исходным snapshot после backup/restore. */
    it("does not change the source while backing up or restoring", async () => {
      expect(await contents(source)).toEqual(snapshot);
      expect(await definitions(source)).toEqual(ddl);
    });
    /** Отказ native-аутентификации не оставляет завершённый или partial архив и не меняет source. */
    it.skipIf(!process.env.BACKUP_REHEARSAL_IMAGE)(
      "leaves no completed or partial archive after a real client authentication failure",
      async () => {
        await guard(sourceId!, sourceUrl!);
        const invalid = new URL(sourceUrl!);
        invalid.password = "rejected-synthetic-password";
        await runImage!("failed-backup", sourceId!, invalid.href);
        expect(await contents(source)).toEqual(snapshot);
      },
    );
    /** Target содержит все таблицы и точные synthetic строки, включая ожидаемую fixture-историю миграций. */
    it("restores every table and exact synthetic contents including all migration hashes", async () => {
      expect(
        (await rows(target, "SHOW TABLES"))
          .map((row) => String(Object.values(row)[0]))
          .sort(),
      ).toEqual(tables);
      expect(await contents(target)).toEqual(snapshot);
      expect(
        (
          await rows(
            target,
            "SELECT COUNT(*) AS count FROM __drizzle_migrations",
          )
        )[0]?.count,
      ).toBe(45);
      expect(
        (await rows(target, "SELECT name,role FROM users WHERE id=70001"))[0],
      ).toEqual({ name: "Тест 🧪", role: "user" });
    });
    /** Полный DDL restore совпадает с source, включая auto increment и generated expressions. */
    it("preserves engines, collations, generated expressions, indexes and auto increments", async () => {
      expect(await definitions(target)).toEqual(ddl);
    });
    /** Library-binding и pending импорт сохраняют целостность, unique-ограничения slot/asset/operation продолжают действовать. */
    it("preserves library binding integrity, pending recovery and uniqueness after restore", async () => {
      expect(
        await rows(
          target,
          "SELECT b.fileKey,b.enabled,b.revision,f.filename,f.parentKind,f.state FROM library_file_bindings b JOIN private_content_files f ON f.assetId=b.assetId AND f.parentId=b.id",
        ),
      ).toEqual([
        {
          fileKey: "main",
          enabled: 1,
          revision: 1,
          filename: "Материал 🧪.txt",
          parentKind: "library",
          state: "ready",
        },
      ]);
      expect(
        await rows(
          target,
          "SELECT state,JSON_LENGTH(plan) AS reserved,JSON_UNQUOTE(JSON_EXTRACT(result,'$[0].assetId')) AS boundAsset FROM library_file_migrations ORDER BY requestKey",
        ),
      ).toEqual([
        {
          state: "committed",
          reserved: 1,
          boundAsset: "00000000-0000-4000-8000-000000070001",
        },
        { state: "pending", reserved: 1, boundAsset: null },
      ]);
      expect(
        await rows(
          target,
          "SELECT state,parentId,etag FROM private_content_files WHERE assetId='00000000-0000-4000-8000-000000070002'",
        ),
      ).toEqual([{ state: "pending", parentId: null, etag: null }]);
      await expect(
        target.execute(
          "INSERT INTO library_file_bindings(materialKey,fileKey,assetId,sortOrder,enabled,revision) VALUES('recipes','main','duplicate-slot',0,TRUE,1)",
        ),
      ).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
      await expect(
        target.execute(
          "INSERT INTO library_file_bindings(materialKey,fileKey,assetId,sortOrder,enabled,revision) VALUES('patterns','other','00000000-0000-4000-8000-000000070001',0,TRUE,1)",
        ),
      ).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
      await expect(
        target.execute(
          "INSERT INTO library_file_migrations(requestKey,payloadHash,plan) VALUES(?,?,JSON_ARRAY())",
          ["8".repeat(64), "0".repeat(64)],
        ),
      ).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
    });
    /** Восстановленные индексы запрещают email-дубликат и повтор creation-key. */
    it("keeps identity and recovery uniqueness enforced after restore", async () => {
      await expect(
        target.execute(
          "INSERT INTO users(openId,email) VALUES('backup-duplicate','BACKUP-FIXTURE@example.test')",
        ),
      ).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
      await expect(
        target.execute(
          "INSERT INTO article_creation_requests(requestKey,actorUserId,payloadHash,claimToken) VALUES('backup-fixture-request',70001,?, 'duplicate')",
          ["a".repeat(64)],
        ),
      ).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
    });
    /** Повтор restore в заполненный target отклоняется до любых изменений. */
    it("refuses restoring into a nonempty target without changing its contents", async () => {
      const before = await contents(target);
      await expect(restore()).rejects.toThrow("Restore target not empty");
      expect(await contents(target)).toEqual(before);
    });
    /** Read-only check-local проверяет восстановленную fixture-историю без миграционных записей и без release approval. */
    it("verifies fresh-profile history in the restored target without applying migrations", async () => {
      const result = await execute(
        process.execPath,
        [
          "--import",
          "tsx",
          "tooling/scripts/fresh-database.ts",
          "--check-local",
        ],
        {
          cwd: root,
          env: {
            PATH: process.env.PATH,
            FRESH_DATABASE_URL: targetUrl,
            FRESH_DATABASE_CONTAINER_ID: targetId,
          },
          timeout: 30000,
        },
      );
      expect(JSON.parse(result.stdout)).toMatchObject({
        migrations: 45,
        initialized: false,
        pending: [],
        releaseApproval: false,
      });
    });
  },
);
