/** Жизненный цикл первого пароля и восстановления: одноразовое доказательство, SQL-outbox и повтор доставки. */
import { lockAdminActionActor } from "../admin/action-actor";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  and,
  count,
  desc,
  eq,
  gt,
  gte,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import {
  accessEmailOutbox,
  adminAuditLog,
  clubPayments,
  passwordTokens,
  users,
  type User,
} from "../../../../packages/database/src/schema";
import { hashPassword, normalizeEmail } from "../_core/password";
import { publicAccessUrl } from "./urls";
export type Transaction = Parameters<
  Parameters<MySql2Database["transaction"]>[0]
>[0];
export type Mail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  messageId: string;
};
/** Хешируем одноразовое доказательство или eventKey: исходный токен не используется как индекс открытым текстом. */
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
/** Требуем отдельный канонический Base64 ключ ровно 32 байта для шифрования ссылок outbox; некорректная настройка не получает fallback. */
function encryptionKey() {
  const raw = process.env.AUTH_LINK_ENCRYPTION_KEY || "";
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32 || key.toString("base64") !== raw)
    throw new Error(
      "AUTH_LINK_ENCRYPTION_KEY must be canonical base64 of 32 random bytes",
    );
  return key;
}
/** Шифруем токен AES-256-GCM со случайным nonce и тегом целостности перед сохранением в outbox. */
function encrypt(token: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  return Buffer.concat([
    iv,
    cipher.update(token, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
}
/** Восстанавливаем токен только после проверки GCM-тега отдельным ключом отправки писем. */
function decrypt(value: string) {
  const data = Buffer.from(value, "base64"),
    decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      data.subarray(0, 12),
    );
  decipher.setAuthTag(data.subarray(-16));
  return Buffer.concat([
    decipher.update(data.subarray(12, -16)),
    decipher.final(),
  ]).toString("utf8");
}
/** Создаёт proof и долговечную запись письма внутри транзакции вызывающего домена. */
export async function queueAccessEmail(
  tx: Transaction,
  userId: number,
  email: string,
  kind: "club-access" | "password-setup" | "password-reset",
  eventKey: string,
  orderId?: string,
): Promise<void> {
  // Блокировка пользователя уже удерживается; ссылка и outbox фиксируются вместе с доступом.
  const [existing] = await tx
    .select()
    .from(accessEmailOutbox)
    .where(eq(accessEmailOutbox.eventKey, eventKey));
  if (existing) return;
  const [user] = await tx.select().from(users).where(eq(users.id, userId));
  if (
    !user ||
    user.blockedAt ||
    !user.email ||
    normalizeEmail(user.email) !== normalizeEmail(email)
  )
    throw new Error("Invalid mail recipient");
  const payload: { orderId?: string; tokenCipher?: string } = { orderId };
  if (kind !== "club-access" || !user.passwordHash) {
    // Оплата и публичная установка пароля не должны создавать доступ к служебному аккаунту.
    if (!user.passwordHash && user.role !== "user")
      throw new Error("Staff password setup requires an administrator");
    const purpose = user.passwordHash ? "reset" : "setup";
    const token = randomBytes(32).toString("base64url");
    payload.tokenCipher = encrypt(token);
    await tx.insert(passwordTokens).values({
      userId,
      email: normalizeEmail(email),
      tokenHash: digest(token),
      purpose,
      expiresAt: new Date(
        Date.now() + (purpose === "reset" ? 3600000 : 86400000),
      ),
    });
  }
  await tx
    .insert(accessEmailOutbox)
    .values({ eventKey, userId, email: normalizeEmail(email), kind, payload });
}
/** Вызывающий код удерживает блокировку получателя, общую с завершением установки пароля. */
export async function queuePasswordSetupRetry(
  tx: Transaction,
  userId: number,
  email: string,
): Promise<void> {
  const recipient = normalizeEmail(email);
  const [latest] = await tx
    .select()
    .from(accessEmailOutbox)
    .where(
      and(
        eq(accessEmailOutbox.userId, userId),
        eq(accessEmailOutbox.email, recipient),
        eq(accessEmailOutbox.kind, "password-setup"),
      ),
    )
    .orderBy(desc(accessEmailOutbox.id))
    .limit(1);
  if (!latest?.sentAt && !latest?.discardedAt && latest?.payload.tokenCipher) {
    const [usable] = await tx
      .select({ id: passwordTokens.id })
      .from(passwordTokens)
      .where(
        and(
          eq(
            passwordTokens.tokenHash,
            digest(decrypt(latest.payload.tokenCipher)),
          ),
          eq(passwordTokens.userId, userId),
          eq(passwordTokens.email, recipient),
          eq(passwordTokens.purpose, "setup"),
          isNull(passwordTokens.consumedAt),
          gt(passwordTokens.expiresAt, sql`CURRENT_TIMESTAMP`),
        ),
      );
    if (usable) return; // Keep the queued link and the worker's backoff/lease.
  }
  const [budget] = await tx
    .select({ used: count() })
    .from(accessEmailOutbox)
    .where(
      and(
        eq(accessEmailOutbox.userId, userId),
        eq(accessEmailOutbox.email, recipient),
        eq(accessEmailOutbox.kind, "password-setup"),
        gte(
          accessEmailOutbox.createdAt,
          sql`DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 HOUR)`,
        ),
      ),
    );
  if (budget.used >= 3) return;
  // Не отзываем уже отправленные действующие ссылки установки пароля при повторе письма.
  await queueAccessEmail(
    tx,
    userId,
    recipient,
    "password-setup",
    `setup-retry:${randomUUID()}`,
  );
}
/** Запрос восстановления не подтверждает существование аккаунта и не выполняет SMTP внутри SQL. */
export async function requestPasswordEmail(
  database: MySql2Database,
  email: string,
): Promise<void> {
  await database.transaction(async (tx) => {
    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.email, normalizeEmail(email)))
      .for("update");
    if (!user || user.blockedAt || (!user.passwordHash && user.role !== "user"))
      return;
    if (!user.passwordHash) {
      await queuePasswordSetupRetry(tx, user.id, user.email!);
      return;
    }
    await tx
      .update(passwordTokens)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(passwordTokens.userId, user.id),
          isNull(passwordTokens.consumedAt),
        ),
      );
    await queueAccessEmail(
      tx,
      user.id,
      user.email!,
      "password-reset",
      `password:${randomUUID()}`,
    );
  });
}
/** Одноразовое завершение меняет пароль под блокировкой владельца и отзывает прежние сессии. */
export async function completePassword(
  database: MySql2Database,
  token: string,
  password: string,
): Promise<boolean> {
  if (
    !/^[A-Za-z0-9_-]{43}$/.test(token) ||
    password.length < 8 ||
    password.length > 200
  )
    return false;
  const tokenHash = digest(token);
  const [candidate] = await database
    .select()
    .from(passwordTokens)
    .where(eq(passwordTokens.tokenHash, tokenHash));
  if (!candidate) return false;
  const passwordHash = await hashPassword(password);
  return database.transaction(async (tx) => {
    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.id, candidate.userId))
      .for("update");
    const [link] = await tx
      .select()
      .from(passwordTokens)
      .where(eq(passwordTokens.id, candidate.id))
      .for("update");
    if (
      !user ||
      user.blockedAt ||
      !link ||
      link.email !== normalizeEmail(user.email || "") ||
      link.consumedAt ||
      link.expiresAt.getTime() <= Date.now()
    )
      return false;
    if (link.purpose === "setup" && (user.passwordHash || user.role !== "user"))
      return false;
    await tx
      .update(users)
      .set({ passwordHash, sessionVersion: sql`${users.sessionVersion}+1` })
      .where(eq(users.id, user.id));
    await tx
      .update(passwordTokens)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(passwordTokens.userId, user.id),
          isNull(passwordTokens.consumedAt),
        ),
      );
    return true;
  });
}
/** В одной транзакции проверяем текущие права менеджера на целевой аккаунт и ставим повтор письма доступа, не меняя срок подписки. */
export async function resendClubAccess(
  database: MySql2Database,
  actor: User,
  userId: number,
): Promise<boolean> {
  return database.transaction(async tx => {
    await lockAdminActionActor(tx, actor, userId, "resendAccessEmail");
    return resendClubAccessInTransaction(tx, actor.id, userId);
  });
}

/** Повтор менеджера использует ту же транзакцию и бюджет получателя; письмо не является выдачей доступа. */
export async function resendClubAccessInTransaction(
  tx: Transaction,
  actorId: number,
  userId: number,
): Promise<boolean> {
  const [actor] = await tx.select().from(users).where(eq(users.id, actorId));
  if (
    !actor ||
    actor.blockedAt ||
    !["admin", "moderator"].includes(actor.role)
  )
    return false;
  const [user] = await tx
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .for("update");
  if (!user || user.blockedAt || !user.email) return false;
  const [payment] = await tx
    .select()
    .from(clubPayments)
    .where(
      and(eq(clubPayments.userId, userId), eq(clubPayments.status, "paid")),
    )
    .orderBy(desc(clubPayments.expiresAt))
    .limit(1);
  if (!payment?.expiresAt || payment.expiresAt.getTime() <= Date.now())
    return false;
  await queueAccessEmail(
    tx,
    userId,
    user.email,
    "club-access",
    `resend:${randomUUID()}`,
    payment.orderId,
  );
  await tx.insert(adminAuditLog).values({
    actorUserId: actorId,
    action: "resend_club_access",
    targetType: "user",
    targetId: userId,
  });
  return true;
}
/** Забирает ограниченную порцию outbox по lease; SMTP выполняется вне SQL-транзакции. */
export async function processAccessEmails(
  database: MySql2Database,
  send: (mail: Mail) => Promise<boolean>,
  userId?: number,
): Promise<void> {
  for (let batch = 0; batch < 20; batch++) {
    const leaseId = randomUUID();
// Короткая транзакция захватывает одно готовое задание через SKIP LOCKED и lease; медленная отправка идёт уже без SQL-блокировок.
    const mail = await database.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(accessEmailOutbox)
        .where(
          and(
            userId === undefined
              ? undefined
              : eq(accessEmailOutbox.userId, userId),
            isNull(accessEmailOutbox.sentAt),
            isNull(accessEmailOutbox.discardedAt),
            lte(accessEmailOutbox.nextAttemptAt, sql`CURRENT_TIMESTAMP`),
            or(
              isNull(accessEmailOutbox.leaseUntil),
              lte(accessEmailOutbox.leaseUntil, sql`CURRENT_TIMESTAMP`),
            ),
          ),
        )
        .orderBy(accessEmailOutbox.id)
        .limit(1)
        .for("update", { skipLocked: true });
      if (!row) return null;
      await tx
        .update(accessEmailOutbox)
        .set({
          leaseId,
          leaseUntil: sql`DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 5 MINUTE)`,
          attempts: row.attempts + 1,
        })
        .where(eq(accessEmailOutbox.id, row.id));
      return row;
    });
    if (!mail) return;
    let success = false;
    let discard: string | undefined;
    try {
      const [user] = await database
        .select()
        .from(users)
        .where(eq(users.id, mail.userId));
      if (
        !user ||
        user.blockedAt ||
        normalizeEmail(user.email || "") !== mail.email
      ) {
        discard = "recipient_unavailable";
      } else {
        let token: string | undefined;
        if (mail.payload.tokenCipher) {
          token = decrypt(mail.payload.tokenCipher);
          const [link] = await database
            .select()
            .from(passwordTokens)
            .where(eq(passwordTokens.tokenHash, digest(token)));
          if (
            !link ||
            link.consumedAt ||
            link.expiresAt.getTime() <= Date.now()
          ) {
            if (mail.kind === "club-access" && user.passwordHash)
              token = undefined;
            else discard = "link_expired_or_consumed";
          }
        }
        if (!discard) {
          const url = publicAccessUrl(token);
          const text =
            mail.kind === "club-access"
              ? "Оплата получена. Доступ к клубу открыт."
              : "Вы запросили установку или восстановление пароля.";
          const label = token
            ? "Установите пароль по одноразовой ссылке"
            : "Войдите в аккаунт";
          // В HTML-атрибут попадает только проверенный URL из настройки оператора.
          // Токен сохраняется во fragment и не превращается в серверный query-параметр.
          const href = url
            .toString()
            .replace(
              /[&<>"']/g,
              (character) =>
                ({
                  "&": "&amp;",
                  "<": "&lt;",
                  ">": "&gt;",
                  '"': "&quot;",
                  "'": "&#39;",
                })[character]!,
            );
          // Зависший worker может продолжиться после захвата задачи другим процессом.
          // Проверяем владение перед SMTP, а не только при записи успеха.
          const [owned] = await database
            .select({ id: accessEmailOutbox.id })
            .from(accessEmailOutbox)
            .where(
              and(
                eq(accessEmailOutbox.id, mail.id),
                eq(accessEmailOutbox.leaseId, leaseId),
                gt(accessEmailOutbox.leaseUntil, sql`CURRENT_TIMESTAMP`),
                isNull(accessEmailOutbox.sentAt),
                isNull(accessEmailOutbox.discardedAt),
              ),
            )
            .limit(1);
          if (!owned) continue;
          success = await send({
            to: mail.email,
            subject:
              mail.kind === "club-access"
                ? "Доступ в клуб Darcy"
                : "Пароль DARYADARCY",
            text: `${text}\n${label}:\n${url.toString()}\nЕсли вы не запрашивали письмо, ничего не делайте.`,
            html: `<p>${text}</p><p><a href="${href}">${label}</a></p><p>Если вы не запрашивали письмо, ничего не делайте.</p>`,
            messageId: `<${digest(mail.eventKey)}@daryadarcy.com>`,
          });
        }
      }
    } catch {
      success = false;
    } // Never log encrypted links, plaintext tokens or SMTP payloads.
    if (!success && !discard && mail.attempts >= 11)
      discard = "delivery_attempts_exhausted";
// Подтверждение либо backoff применяются только к своему lease; принятый SMTP ответ не доказывает доставку во входящие, авария между эффектом и отметкой допускает повтор.
    await database
      .update(accessEmailOutbox)
      .set(
        discard
          ? {
              discardedAt: new Date(),
              lastError: discard,
              payload: { orderId: mail.payload.orderId },
              leaseId: null,
              leaseUntil: null,
            }
          : success
            ? {
                sentAt: new Date(),
                lastError: null,
                payload: { orderId: mail.payload.orderId },
                leaseId: null,
                leaseUntil: null,
              }
            : {
                lastError: "delivery_failed",
                leaseId: null,
                leaseUntil: null,
                nextAttemptAt: new Date(
                  Date.now() +
                    Math.min(
                      86400000,
                      60000 * 2 ** Math.min(mail.attempts, 10),
                    ),
                ),
              },
      )
      .where(
        and(
          eq(accessEmailOutbox.id, mail.id),
          eq(accessEmailOutbox.leaseId, leaseId),
        ),
      );
  }
}
