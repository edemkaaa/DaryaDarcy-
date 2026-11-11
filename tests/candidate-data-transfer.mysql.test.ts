import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { assertTestDatabase } from "../tooling/scripts/test-database-policy";
import {
  hashPassword,
  verifyPassword,
} from "../apps/backend/src/_core/password";
import * as transfer from "../tooling/scripts/candidate-data-transfer";

const execute = promisify(execFile);
const sourceUrl = process.env.TRANSFER_REHEARSAL_SOURCE_URL;
const targetUrl = process.env.TRANSFER_REHEARSAL_TARGET_URL;
const sourceId = process.env.TRANSFER_REHEARSAL_SOURCE_ID;
const targetId = process.env.TRANSFER_REHEARSAL_TARGET_ID;
const legacy = [
  "access_email_outbox",
  "admin_audit_log",
  "articles",
  "billing_checkout_intents",
  "billing_profiles",
  "billing_receipts",
  "club_payments",
  "comment_likes",
  "comment_reports",
  "launch_settings",
  "likes",
  "password_tokens",
  "pen_pal_matches",
  "pen_pal_profiles",
  "pen_pal_shown",
  "post_comments",
  "post_creation_requests",
  "post_media",
  "posts",
  "push_consent_events",
  "push_tokens",
  "saved_posts",
  "shop_delivery_emails",
  "shop_purchases",
  "sms_codes",
  "tags",
  "user_consent_events",
  "users",
  "videos",
];

/** Репетирует перенос synthetic legacy29 в отдельную fresh-кандидат БД с сохранением identity и истории миграций. */
describe.skipIf(!sourceUrl || !targetUrl || !sourceId || !targetId)(
  "candidate transfer with native fresh42 and a synthetic legacy29 source",
  () => {
    let source: Connection, target: Connection, sourceAdmin: Connection;
    let passwordHash: string;
    /** Проверяет loopback-порт, полный container ID, owner-label, tmpfs и отсутствие mounts до доступа к rehearsal БД. */
    async function guard(id: string, uri: string) {
      const url = assertTestDatabase(uri);
      expect(url.hostname).toBe("127.0.0.1");
      expect(url.port).not.toBe("");
      expect(id).toMatch(/^[a-f0-9]{64}$/);
      const { stdout } = await execute("docker", [
        "inspect",
        id,
        "--format",
        '{"id":{{json .Id}},"name":{{json .Name}},"owner":{{json (index .Config.Labels "codex.owner")}},"ports":{{json .NetworkSettings.Ports}},"tmpfs":{{json .HostConfig.Tmpfs}},"mounts":{{json .Mounts}}}',
      ]);
      const meta = JSON.parse(stdout);
      expect(meta.id).toBe(id);
      expect(meta.owner).toMatch(/^daryadarcy-fresh-transfer-[a-z0-9-]+$/);
      expect(meta.name).toBe(`/${meta.owner}`);
      expect(meta.mounts).toEqual([]);
      expect(meta.tmpfs["/var/lib/mysql"]).toBeTruthy();
      expect(meta.ports["3306/tcp"]).toEqual([
        { HostIp: "127.0.0.1", HostPort: url.port },
      ]);
    }
    /** Читает выбранный source или target с точными датами, JSON и большими числами для сравнения переноса. */
    async function rows(c: Connection, sql: string, values: unknown[] = []) {
      return (await c.query<RowDataPacket[]>(sql, values))[0];
    }
    /** Считает все прикладные строки legacy-набора в target для проверки полного rollback. */
    async function applicationCount() {
      let count = 0;
      for (const name of legacy)
        count += Number(
          (await rows(target, `SELECT COUNT(*) AS n FROM \`${name}\``))[0].n,
        );
      return count;
    }
    /** Проверяет разные пустые owned-контейнеры, мигрирует target и строит synthetic legacy-source с прежними колонками. */
    beforeAll(async () => {
      expect(sourceId).not.toBe(targetId);
      expect(sourceUrl).not.toBe(targetUrl);
      await guard(sourceId!, sourceUrl!);
      await guard(targetId!, targetUrl!);
      const options = {
        dateStrings: true,
        jsonStrings: true,
        supportBigNumbers: true,
        bigNumberStrings: true,
        timezone: "Z",
      };
      source = await mysql.createConnection({ uri: sourceUrl!, ...options });
      target = await mysql.createConnection({ uri: targetUrl!, ...options });
      sourceAdmin = await mysql.createConnection({
        uri: sourceUrl!,
        ...options,
      });
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
          env: {
            PATH: process.env.PATH,
            FRESH_DATABASE_URL: targetUrl,
            FRESH_DATABASE_CONTAINER_ID: targetId,
          },
          timeout: 30000,
        },
      );
      for (const name of legacy) {
        const [definition] = await rows(
          target,
          `SHOW CREATE TABLE \`${name}\``,
        );
        await sourceAdmin.query(definition["Create Table"]);
      }
      await sourceAdmin.query(
        "ALTER TABLE videos DROP INDEX videos_vk_source_unique, DROP COLUMN provider, DROP COLUMN access, DROP COLUMN vkEmbedUrl, DROP COLUMN vkSourceKey, MODIFY youtubeId varchar(32) NOT NULL",
      );
      await sourceAdmin.query("ALTER TABLE post_media DROP COLUMN posterUrl");
      await sourceAdmin.query(
        "ALTER TABLE users DROP INDEX users_email_identity_unique",
      );
      passwordHash = await hashPassword("native-transfer-test-only-password");
      await sourceAdmin.execute(
        "INSERT INTO users(id,openId,email,name,role,passwordHash,sessionVersion) VALUES(1,'native-transfer-admin','native-admin@example.test','Тест 🧪','admin',?,7)",
        [passwordHash],
      );
      await sourceAdmin.execute(
        "INSERT INTO posts(id,text,photos,tags) VALUES(7,?,JSON_ARRAY('/legacy/synthetic.webp'),JSON_ARRAY('fixture'))",
        ["Кавычки: ' \"\n🧪"],
      );
      await sourceAdmin.query(
        "INSERT INTO videos(id,youtubeId,title) VALUES(3,'native-synthetic','Синтетика 🧪')",
      );
      await sourceAdmin.query(
        "INSERT INTO club_payments(id,userId,orderId,status,sum,paidAt,expiresAt,cancelAtPeriodEnd) VALUES(4,1,'native-transfer-order','paid','10.00','2026-10-01 00:00:00','2030-10-01 00:00:00',TRUE)",
      );
      await sourceAdmin.query("ALTER TABLE users AUTO_INCREMENT=900");
      await sourceAdmin.query("ALTER TABLE posts AUTO_INCREMENT=950");
      await sourceAdmin.query(
        "INSERT INTO password_tokens(id,userId,tokenHash,purpose,expiresAt) VALUES(9,1,REPEAT('a',64),'reset','2030-10-01 00:00:00')",
      );
      await sourceAdmin.query(
        "INSERT INTO access_email_outbox(id,eventKey,userId,email,kind,payload) VALUES(8,'synthetic-transfer',1,'native-admin@example.test','password-reset',JSON_OBJECT('encrypted','opaque-fixture-not-real-ciphertext'))",
      );
    }, 60000);
    /** Закрывает source, target и отдельное административное fixture-соединение. */
    afterAll(async () => {
      await Promise.all([source?.end(), target?.end(), sourceAdmin?.end()]);
    });
    /** Перенос не стартует в непустой candidate и сохраняет sentinel-аккаунт target. */
    it("refuses a nonempty target without changing an existing account", async () => {
      await target.query(
        "INSERT INTO users(id,openId,role) VALUES(999,'target-existing','user')",
      );
      try {
        await expect(
          (async () => transfer.copyCandidateData?.(source, target))(),
        ).rejects.toThrow();
        expect(
          (await rows(target, "SELECT openId,role FROM users WHERE id=999"))[0],
        ).toEqual({ openId: "target-existing", role: "user" });
        expect(
          Number((await rows(target, "SELECT COUNT(*) AS n FROM posts"))[0].n),
        ).toBe(0);
      } finally {
        await target.query("DELETE FROM users WHERE id=999");
      }
    });
    /** Нормализованный identity-конфликт откатывает всю копию без password/hash/email в ошибке. */
    it("rolls back all copied rows on a target identity conflict without leaking row values", async () => {
      await sourceAdmin.query(
        "INSERT INTO users(id,openId,email) VALUES(2,'duplicate-fixture','NATIVE-ADMIN@example.test')",
      );
      try {
        const failure = await (async () =>
          transfer.copyCandidateData?.(source, target))().catch(
          (error) => error,
        );
        expect(failure).toBeInstanceOf(Error);
        expect(String(failure)).not.toMatch(
          /NATIVE-ADMIN|INSERT INTO|scrypt\$/,
        );
        expect(await applicationCount()).toBe(0);
      } finally {
        await sourceAdmin.query("DELETE FROM users WHERE id=2");
      }
    });
    /** Копия сохраняет hash пароля, sessionVersion, подписку, тексты и journals, добавляя новые default-колонки без подмены истории. */
    it("copies legacy rows, preserves password/session/subscription fields and keeps migration history", async () => {
      const result = await transfer.copyCandidateData?.(source, target);
      expect(
        Number((await rows(target, "SELECT COUNT(*) AS n FROM users"))[0].n),
      ).toBe(1);
      const [user] = await rows(
        target,
        "SELECT role,passwordHash,sessionVersion FROM users WHERE id=1",
      );
      expect(user.passwordHash).toBe(passwordHash);
      expect(
        await verifyPassword(
          "native-transfer-test-only-password",
          user.passwordHash,
        ),
      ).toBe(true);
      expect(user.role).toBe("admin");
      expect(user.sessionVersion).toBe(7);
      expect(
        (
          await rows(
            target,
            "SELECT status,sum,cancelAtPeriodEnd FROM club_payments WHERE id=4",
          )
        )[0],
      ).toEqual({ status: "paid", sum: "10.00", cancelAtPeriodEnd: 1 });
      expect(await rows(target, "SELECT text,photos,tags FROM posts")).toEqual(
        await rows(source, "SELECT text,photos,tags FROM posts"),
      );
      for (const table of ["password_tokens", "access_email_outbox"])
        expect(await rows(target, `SELECT * FROM ${table}`)).toEqual(
          await rows(source, `SELECT * FROM ${table}`),
        );
      expect(
        (
          await rows(target, "SELECT provider,access,vkSourceKey FROM videos")
        )[0],
      ).toEqual({ provider: "youtube", access: "public", vkSourceKey: null });
      expect(
        Number(
          (
            await rows(target, "SELECT COUNT(*) AS n FROM __drizzle_migrations")
          )[0].n,
        ),
      ).toBe(42);
      expect(result).toMatchObject({
        tables: 29,
        rows: 6,
        historyUnchanged: true,
        sourceReadOnly: true,
      });
      await target.query("SET SESSION information_schema_stats_expiry=0");
      expect(
        Number(
          (
            await rows(
              target,
              "SELECT AUTO_INCREMENT AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='posts'",
            )
          )[0].n,
        ),
      ).toBeGreaterThanOrEqual(950);
    });
    /** Source остаётся read-only, а повторный перенос в заполненный target отклоняется без изменения обоих наборов. */
    it("leaves the source connection read-only and refuses replay into the populated candidate", async () => {
      await expect(
        source.query("UPDATE users SET name=name WHERE id=-1"),
      ).rejects.toMatchObject({
        code: "ER_CANT_EXECUTE_IN_READ_ONLY_TRANSACTION",
      });
      await expect(
        (async () => transfer.copyCandidateData?.(source, target))(),
      ).rejects.toThrow();
      expect(
        Number((await rows(target, "SELECT COUNT(*) AS n FROM users"))[0].n),
      ).toBe(1);
      expect(
        Number((await rows(source, "SELECT COUNT(*) AS n FROM users"))[0].n),
      ).toBe(1);
    });
  },
);
