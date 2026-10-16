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

const sourceUrl = process.env.BACKUP_REHEARSAL_SOURCE_URL;
const targetUrl = process.env.BACKUP_REHEARSAL_TARGET_URL;
const sourceId = process.env.BACKUP_REHEARSAL_SOURCE_ID;
const targetId = process.env.BACKUP_REHEARSAL_TARGET_ID;
const root = fileURLToPath(new URL("../", import.meta.url));
const execute = promisify(execFile);
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
    async function rows(conn: Connection, query: string, args: unknown[] = []) {
      return (await conn.query<RowDataPacket[]>(query, args))[0];
    }
    function quote(name: string) {
      return "`" + name.replaceAll("`", "``") + "`";
    }
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
    async function definitions(conn: Connection) {
      const output: Record<string, string> = {};
      for (const table of tables)
        output[table] = (
          await rows(conn, `SHOW CREATE TABLE ${quote(table)}`)
        )[0]!["Create Table"];
      return output;
    }
    async function restore() {
      await guard(targetId!, targetUrl!);
      if ((await rows(target, "SHOW TABLES")).length)
        throw new Error("Restore target not empty");
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
    beforeAll(async () => {
      expect(sourceId).not.toBe(targetId);
      expect(sourceUrl).not.toBe(targetUrl);
      await guard(sourceId!, sourceUrl!);
      await guard(targetId!, targetUrl!);
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
      tables = (await rows(source, "SHOW TABLES"))
        .map((row) => String(Object.values(row)[0]))
        .sort();
      snapshot = await contents(source);
      ddl = await definitions(source);
      directory = await mkdtemp(join(tmpdir(), "daryadarcy-backup-rehearsal-"));
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
      const archives = await readdir(join(directory, "backups"));
      expect(archives).toHaveLength(1);
      archive = join(directory, "backups", archives[0]!);
      sql = gunzipSync(await readFile(archive));
      await restore();
    }, 30000);
    afterAll(async () => {
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
      await source?.end();
      await target?.end();
      if (directory) await rm(directory, { recursive: true });
    });
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
      ).toBe(40);
      expect(
        (await rows(target, "SELECT name,role FROM users WHERE id=70001"))[0],
      ).toEqual({ name: "Тест 🧪", role: "user" });
    });
    it("preserves engines, collations, generated expressions, indexes and auto increments", async () => {
      expect(await definitions(target)).toEqual(ddl);
    });
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
    it("refuses restoring into a nonempty target without changing its contents", async () => {
      const before = await contents(target);
      await expect(restore()).rejects.toThrow("Restore target not empty");
      expect(await contents(target)).toEqual(before);
    });
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
        migrations: 40,
        initialized: false,
        pending: [],
        releaseApproval: false,
      });
    });
  },
);
