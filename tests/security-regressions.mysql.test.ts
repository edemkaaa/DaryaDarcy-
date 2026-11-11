import * as photos from "../apps/backend/src/media/photos";
import { PasswordService } from "../apps/backend/src/identity/password.service";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { openContentTestDatabase } from "./helpers/content-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { getDb, getUserByOpenId } from "../apps/backend/src/db";
import { appRouter } from "../apps/backend/src/routers";
import type { TrpcContext } from "../apps/backend/src/_core/context";
import { processScheduledAccountDeletions } from "../apps/backend/src/identity/account-retention";

// Real disposable SQL and application services; only external photo transport is paused.
// No SMTP, real storage, payments or production database access.
/** Проверяет поздние записи после удаления или отзыва полномочий и защиту стартовой JWT-конфигурации. */
describe.skipIf(!testDatabaseUrl)("security regression guards", () => {
  const owner = 988650,
    neighbor = 988651,
    postId = 988650,
    commentId = 988650;
  let conn: Connection;
  /** Удаляет собственные outbox, токены, платежи, аудит, обсуждение и двух пользователей. */
  async function cleanup() {
    await conn.query("DELETE FROM access_email_outbox WHERE userId IN (?,?)", [
      owner,
      neighbor,
    ]);
    await conn.query("DELETE FROM password_tokens WHERE userId IN (?,?)", [
      owner,
      neighbor,
    ]);
    await conn.query("DELETE FROM club_payments WHERE userId IN (?,?)", [
      owner,
      neighbor,
    ]);
    await conn.query("DELETE FROM admin_audit_log WHERE actorUserId=?", [
      owner,
    ]);
    for (const table of ["comment_likes", "comment_reports"])
      await conn.query(`DELETE FROM ${table} WHERE commentId IN (?,?)`, [
        commentId,
        commentId + 1,
      ]);
    await conn.query("DELETE FROM post_comments WHERE postId=?", [postId]);
    for (const table of ["likes", "saved_posts"])
      await conn.query(`DELETE FROM ${table} WHERE postId=?`, [postId]);
    await conn.query("DELETE FROM posts WHERE id=?", [postId]);
    await conn.query("DELETE FROM users WHERE id IN (?,?)", [owner, neighbor]);
  }
  /** Подключает одноразовую content-схему и включает retirement без private-storage. */
  beforeAll(async () => {
    conn = await openContentTestDatabase();
    vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
    vi.stubEnv("CONTENT_RECOVERY_RETIREMENT_ENABLED", "true");
    vi.stubEnv("PRIVATE_CONTENT_FILES_ENABLED", "false");
  });
  /** Восстанавливает двух участников и обсуждение с просроченной заявкой удаления автора. */
  beforeEach(async () => {
    await cleanup();
    await conn.query(
      "INSERT INTO users(id,openId,email,role,accountDeletionRequestedAt) VALUES (?,'security-probe-owner','owner@example.test','user',DATE_SUB(NOW(),INTERVAL 31 DAY)),(?,'security-probe-neighbor',NULL,'user',NULL)",
      [owner, neighbor],
    );
    await conn.query(
      "INSERT INTO posts(id,text,photos,tags,target,published,status,publishedAt) VALUES (?,'Synthetic discussion',JSON_ARRAY(),JSON_ARRAY('community'),'feed',TRUE,'published',NOW())",
      [postId],
    );
    await conn.query(
      "INSERT INTO post_comments(id,postId,userId,text) VALUES (?,?,?,'Original owner text'),(?,?,?,'Neighbor text')",
      [commentId, postId, owner, commentId + 1, postId, neighbor],
    );
  });
  /** Удаляет fixture, закрывает соединения и возвращает окружение. */
  afterAll(async () => {
    if (conn) await cleanup();
    await conn?.end();
    const database = await getDb();
    await (
      database as unknown as { $client: { end(): Promise<void> } }
    )?.$client.end();
    vi.unstubAllEnvs();
  });
  /** Захватывает текущую строку тестового автора в прямом tRPC-контексте. */
  async function caller() {
    return appRouter.createCaller({
      user: (await getUserByOpenId("security-probe-owner"))!,
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    });
  }
  /** Возвращает подмены фото-транспорта после каждого сценария. */
  afterEach(() => vi.restoreAllMocks());
  /** Завершение photo-upload после retirement не восстанавливает аватар удалённому аккаунту. */
  it("rejects a late avatar after final retirement", async () => {
    await conn.query(
      "UPDATE users SET accountDeletionRequestedAt=NULL WHERE id=?",
      [owner],
    );
    let release!: (value: { url: string }) => void;
    const uploaded = new Promise<{ url: string }>((resolve) => {
      release = resolve;
    });
    const transport = vi
      .spyOn(photos, "uploadPhoto")
      .mockImplementation(() => uploaded);
    const current = await caller();
    const pending = current.profile.uploadAvatar({
      base64: "AAAA",
      filename: "synthetic.webp",
      mimeType: "image/webp",
    });
    await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(1));
    try {
      await conn.query(
        "UPDATE users SET accountDeletionRequestedAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE id=?",
        [owner],
      );
      expect(await processScheduledAccountDeletions()).toBe(1);
    } finally {
      release({ url: "https://example.test/synthetic-avatar.webp" });
    }
    await expect(pending).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT avatarUrl,sessionVersion FROM users WHERE id=?",
      [owner],
    );
    expect(rows[0]).toMatchObject({ avatarUrl: null, sessionVersion: 1 });
  });
  /** Legacy-resend повторно проверяет epoch, роль, блокировку и удаление staff до постановки письма. */
  it.each(["epoch", "role", "blocked", "deletion"] as const)(
    "rejects legacy resend after staff %s changes",
    async (change) => {
      vi.stubEnv(
        "AUTH_LINK_ENCRYPTION_KEY",
        Buffer.alloc(32, 7).toString("base64"),
      );
      await conn.query(
        "UPDATE users SET role='moderator',accountDeletionRequestedAt=NULL WHERE id=?",
        [owner],
      );
      await conn.query(
        "UPDATE users SET email='recipient@example.test' WHERE id=?",
        [neighbor],
      );
      await conn.query(
        "INSERT INTO club_payments(userId,orderId,status,expiresAt) VALUES (?,'security-resend-order','paid',DATE_ADD(NOW(),INTERVAL 1 DAY))",
        [neighbor],
      );
      const stale = (await getUserByOpenId("security-probe-owner"))!;
      const update = {
        epoch: "sessionVersion=sessionVersion+1",
        role: "role='user'",
        blocked: "blockedAt=NOW()",
        deletion: "accountDeletionRequestedAt=NOW()",
      }[change];
      await conn.query(`UPDATE users SET ${update} WHERE id=?`, [owner]);
      await expect(
        new PasswordService().resend(stale, neighbor),
      ).rejects.toMatchObject({
        code: change === "epoch" ? "UNAUTHORIZED" : "FORBIDDEN",
      });
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM access_email_outbox WHERE userId=?",
        [neighbor],
      );
      expect(rows[0].n).toBe(0);
    },
  );
  /** И keyed, и legacy выдача дней запрещены при отозванных текущих полномочиях администратора. */
  it.each(["role", "epoch", "blocked", "deletion"] as const)(
    "legacy and keyed grants both reject a revoked admin %s",
    async (change) => {
      await conn.query(
        "UPDATE users SET role='admin',accountDeletionRequestedAt=NULL WHERE id=?",
        [owner],
      );
      const captured = await caller();
      const update = {
        epoch: "sessionVersion=sessionVersion+1",
        role: "role='user'",
        blocked: "blockedAt=NOW()",
        deletion: "accountDeletionRequestedAt=NOW()",
      }[change];
      await conn.query(`UPDATE users SET ${update} WHERE id=?`, [owner]);
      await expect(
        captured.admin.grantClub({
          userId: neighbor,
          idempotencyKey: "11111111-1111-4111-8111-111111111111",
        }),
      ).rejects.toMatchObject({
        code: change === "epoch" ? "UNAUTHORIZED" : "FORBIDDEN",
      });
      await expect(
        captured.admin.grantClub({ userId: neighbor }),
      ).rejects.toMatchObject({
        code: change === "epoch" ? "UNAUTHORIZED" : "FORBIDDEN",
      });
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM club_payments WHERE userId=? AND status='paid' AND expiresAt>NOW()",
        [neighbor],
      );
      expect(rows[0].n).toBe(0);
    },
  );
  /** Текущий администратор сохраняет совместимые ручную выдачу и постановку access-письма. */
  it("keeps legacy grant and resend available for a current administrator", async () => {
    vi.stubEnv(
      "AUTH_LINK_ENCRYPTION_KEY",
      Buffer.alloc(32, 7).toString("base64"),
    );
    await conn.query(
      "UPDATE users SET role='admin',accountDeletionRequestedAt=NULL WHERE id=?",
      [owner],
    );
    await conn.query(
      "UPDATE users SET email='recipient@example.test' WHERE id=?",
      [neighbor],
    );
    expect(
      await (await caller()).admin.grantClub({ userId: neighbor }),
    ).toMatchObject({ ok: true });
    const current = (await getUserByOpenId("security-probe-owner"))!;
    expect(await new PasswordService().resend(current, neighbor)).toBe(true);
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT (SELECT COUNT(*) FROM club_payments WHERE userId=?) AS grants, (SELECT COUNT(*) FROM access_email_outbox WHERE userId=?) AS mails",
      [neighbor, neighbor],
    );
    expect(rows[0]).toMatchObject({ grants: 1, mails: 1 });
  });
  /** Актуальная загрузка аватара сохраняет URL и увеличивает profileRevision. */
  it("saves a current avatar and advances the profile revision", async () => {
    await conn.query(
      "UPDATE users SET accountDeletionRequestedAt=NULL WHERE id=?",
      [owner],
    );
    vi.spyOn(photos, "uploadPhoto").mockResolvedValue({
      url: "https://example.test/current.webp",
    });
    expect(
      await (
        await caller()
      ).profile.uploadAvatar({ base64: "AAAA", filename: "synthetic.webp" }),
    ).toEqual({ url: "https://example.test/current.webp" });
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT avatarUrl,profileRevision FROM users WHERE id=?",
      [owner],
    );
    expect(rows[0]).toMatchObject({
      avatarUrl: "https://example.test/current.webp",
      profileRevision: 1,
    });
  });
  /** Поздний avatar-upload получает CONFLICT после более новой правки профиля и не затирает её URL. */
  it("does not overwrite a newer profile while an avatar upload is pending", async () => {
    await conn.query(
      "UPDATE users SET accountDeletionRequestedAt=NULL WHERE id=?",
      [owner],
    );
    let release!: (value: { url: string }) => void;
    const uploaded = new Promise<{ url: string }>((resolve) => {
      release = resolve;
    });
    const transport = vi
      .spyOn(photos, "uploadPhoto")
      .mockImplementation(() => uploaded);
    const current = await caller();
    const pending = current.profile.uploadAvatar({
      base64: "AAAA",
      filename: "synthetic.webp",
    });
    await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(1));
    try {
      await current.profile.update({
        expectedRevision: 0,
        avatarUrl: "https://example.test/newer.webp",
      });
    } finally {
      release({ url: "https://example.test/stale.webp" });
    }
    await expect(pending).rejects.toMatchObject({ code: "CONFLICT" });
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT avatarUrl,profileRevision FROM users WHERE id=?",
      [owner],
    );
    expect(rows[0]).toMatchObject({
      avatarUrl: "https://example.test/newer.webp",
      profileRevision: 1,
    });
  });
  /** Production API отказывается запускаться со слишком коротким ключом подписи JWT. */
  it("production startup refuses a one-byte JWT signing key", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "x");
    let app: Awaited<ReturnType<typeof createBackendApplication>> | undefined;
    try {
      await expect(async () => {
        app = await createBackendApplication();
      }).rejects.toThrow(/JWT_SECRET/);
    } finally {
      await app?.close();
    }
  });
});
