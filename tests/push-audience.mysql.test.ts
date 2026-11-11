import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import * as db from "../apps/backend/src/db";

/** Проверяет состав push-аудиторий с учётом блокировки, клубного доступа и последнего согласия marketing. */
describe.skipIf(!testDatabaseUrl)("push recipient access on disposable MySQL", () => {
  let connection: Connection;
  /** Получает общий lock push-аудитории, создаёт необходимые таблицы и семь собственных ролей участников. */
  beforeAll(async () => {
    connection = await openTestDatabase();
    // Native registration checks use the same global device audience.
    const [lock] = await connection.query<RowDataPacket[]>(
      "SELECT GET_LOCK('backend_test_push_audience',30) AS acquired",
    );
    expect(lock[0]?.acquired).toBe(1);
    vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
    await connection.query(`CREATE TABLE IF NOT EXISTS push_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY, token VARCHAR(256) NOT NULL UNIQUE,
      userId INT NULL, platform VARCHAR(16), enabled BOOLEAN NOT NULL DEFAULT TRUE,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
    await connection.query(`CREATE TABLE IF NOT EXISTS push_consent_events (
      id INT AUTO_INCREMENT PRIMARY KEY, userId INT NOT NULL,
      consentType ENUM('service','marketing') NOT NULL,
      status ENUM('granted','revoked') NOT NULL, consentVersion VARCHAR(32) NOT NULL,
      consentText TEXT, platform VARCHAR(16),
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
    await connection.query(`INSERT IGNORE INTO users (id,openId,role) VALUES
      (891,'push-paid','user'),(892,'push-blocked','user'),
      (893,'push-free','user'),(894,'push-blocked-admin','admin'),
      (895,'push-admin','admin'),(896,'push-no-consent','user'),
      (897,'push-revoked','user')`);
  });
  /** Восстанавливает enabled-токены, подписки, блокировки и историю согласий собственных участников. */
  beforeEach(async () => {
    await connection.query("DELETE FROM push_tokens WHERE token LIKE 'fixture-push-%'");
    await connection.query("DELETE FROM push_consent_events WHERE userId BETWEEN 891 AND 897");
    await connection.query("DELETE FROM club_payments WHERE userId BETWEEN 891 AND 897");
    await connection.query("UPDATE users SET blockedAt=NULL WHERE id BETWEEN 891 AND 897");
    await connection.query("UPDATE users SET blockedAt=NOW() WHERE id IN (892,894)");
    await connection.query(`INSERT INTO club_payments (userId,orderId,status,expiresAt) VALUES
      (891,'push-paid-order','paid',DATE_ADD(NOW(),INTERVAL 1 DAY)),
      (892,'push-blocked-order','paid',DATE_ADD(NOW(),INTERVAL 1 DAY)),
      (896,'push-no-consent-order','paid',DATE_ADD(NOW(),INTERVAL 1 DAY)),
      (897,'push-revoked-order','paid',DATE_ADD(NOW(),INTERVAL 1 DAY))`);
    await connection.query(`INSERT INTO push_tokens (token,userId,enabled) VALUES
      ('fixture-push-paid',891,TRUE),('fixture-push-blocked',892,TRUE),
      ('fixture-push-free',893,TRUE),('fixture-push-blocked-admin',894,TRUE),
      ('fixture-push-admin',895,TRUE),('fixture-push-no-consent',896,TRUE),
      ('fixture-push-revoked',897,TRUE),('fixture-push-disabled',891,FALSE),
      ('fixture-push-anonymous',NULL,TRUE),('fixture-push-orphan',999991,TRUE)`);
    await connection.query(`INSERT INTO push_consent_events
      (userId,consentType,status,consentVersion,createdAt) VALUES
      (891,'marketing','granted','test-v1','2026-10-02 10:00:00'),
      (892,'marketing','granted','test-v1','2026-10-02 10:00:00'),
      (893,'marketing','granted','test-v1','2026-10-02 10:00:00'),
      (894,'marketing','granted','test-v1','2026-10-02 10:00:00'),
      (895,'marketing','granted','test-v1','2026-10-02 10:00:00'),
      (897,'marketing','revoked','test-v1','2026-10-02 10:00:00')`);
  });
  /** Удаляет собственные токены, согласия, платежи и аккаунты, снимает lock и закрывает соединения. */
  afterAll(async () => {
    await connection?.query("DELETE FROM push_tokens WHERE token LIKE 'fixture-push-%'");
    await connection?.query("DELETE FROM push_consent_events WHERE userId BETWEEN 891 AND 897");
    await connection?.query("DELETE FROM club_payments WHERE userId BETWEEN 891 AND 897");
    await connection?.query("DELETE FROM users WHERE id BETWEEN 891 AND 897");
    await connection?.query("SELECT RELEASE_LOCK('backend_test_push_audience')");
    await connection?.end();
    await (await db.getDb() as unknown as { $client: { end(): Promise<void> } })?.$client.end();
    vi.unstubAllEnvs();
  });

  const feedService = ["fixture-push-admin", "fixture-push-free", "fixture-push-no-consent", "fixture-push-paid", "fixture-push-revoked"];
  const clubService = ["fixture-push-admin", "fixture-push-no-consent", "fixture-push-paid", "fixture-push-revoked"];
  const feedMarketing = ["fixture-push-admin", "fixture-push-free", "fixture-push-paid"];
  const clubMarketing = ["fixture-push-admin", "fixture-push-paid"];

  /** Каждый audience-selector исключает заблокированные, анонимные, отключённые и осиротевшие токены по своему виду сообщений. */
  it.each([
    ["enabled audience", () => db.getAllEnabledPushTokens(), feedService],
    ["paid club audience", () => db.getClubMemberPushTokens(), clubService],
    ["feed marketing", () => db.getMarketingPushTokens("feed"), feedMarketing],
    ["club marketing", () => db.getMarketingPushTokens("club"), clubMarketing],
    ["combined public marketing", () => db.getMarketingPushTokens("both"), feedMarketing],
    ["feed service", () => db.getServicePushTokens("feed"), feedService],
    ["club service", () => db.getServicePushTokens("club"), clubService],
    ["combined public service", () => db.getServicePushTokens("both"), feedService],
  ] as const)("%s excludes blocked accounts without losing permitted recipients", async (_name, select, expected) => {
    expect((await select()).sort()).toEqual(expected);
  });

  /** Адресная служебная рассылка также запрещена заблокированным обычным и admin-аккаунтам. */
  it.each([892, 894])("denies direct service recipients for blocked user %s", async userId => {
    expect(await db.getPushTokensForUser(userId)).toEqual([]);
  });
  /** Служебные сообщения не требуют marketing-согласия, но клубный target всё равно требует доступ. */
  it("preserves direct service recipients without requiring marketing consent", async () => {
    expect(await db.getPushTokensForUser(896)).toEqual(["fixture-push-no-consent"]);
    expect(await db.getServicePushTokens("club", 896)).toEqual(["fixture-push-no-consent"]);
    expect(await db.getServicePushTokens("club", 893)).toEqual([]);
    expect(await db.getServicePushTokens("club", 892)).toEqual([]);
  });
  /** Новая блокировка немедленно исключает токен из следующих marketing и service выборок. */
  it("stops selecting recipients immediately after a new block", async () => {
    expect(await db.getMarketingPushTokens("club")).toContain("fixture-push-paid");
    await connection.query("UPDATE users SET blockedAt=NOW() WHERE id=891");
    expect(await db.getMarketingPushTokens("club")).not.toContain("fixture-push-paid");
    expect(await db.getServicePushTokens("club")).not.toContain("fixture-push-paid");
  });
  /** При одинаковом timestamp последняя запись согласия по ID учитывает отзыв. */
  it("reports same-second consent revocation as the latest choice", async () => {
    await connection.query(`INSERT INTO push_consent_events
      (userId,consentType,status,consentVersion,createdAt)
      VALUES (891,'marketing','revoked','test-v1','2026-10-02 10:00:00')`);
    expect(await db.hasMarketingPushConsent(891)).toBe(false);
  });
  /** Marketing-отзыв в ту же секунду исключает рекламную доставку, сохраняя служебную. */
  it("removes a same-second revoked token from marketing, not service messages", async () => {
    await connection.query(`INSERT INTO push_consent_events
      (userId,consentType,status,consentVersion,createdAt)
      VALUES (891,'marketing','revoked','test-v1','2026-10-02 10:00:00')`);
    expect(await db.getMarketingPushTokens("club")).not.toContain("fixture-push-paid");
    expect(await db.getServicePushTokens("club")).toContain("fixture-push-paid");
  });
  /** Более поздняя запись согласия в ту же секунду возвращает marketing-доступ. */
  it("honors a new grant recorded after a same-second revocation", async () => {
    await connection.query(`INSERT INTO push_consent_events
      (userId,consentType,status,consentVersion,createdAt)
      VALUES (897,'marketing','granted','test-v1','2026-10-02 10:00:00')`);
    expect(await db.hasMarketingPushConsent(897)).toBe(true);
    expect(await db.getMarketingPushTokens("club")).toContain("fixture-push-revoked");
  });
});
