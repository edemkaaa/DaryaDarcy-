/** Доставляет подтверждение почты по lease и не разрешает устаревшему worker перезаписать новый результат. */
import type { MySql2Database } from "drizzle-orm/mysql2";
import { and, asc, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { createDecipheriv, createHash, randomUUID } from "node:crypto";
import {
  memberEmailBindings,
  memberEmailBindingOutbox,
  users,
} from "../../../../packages/database/src/schema";
import type { Mail } from "./access";
import { EmailBindingError } from "./email-binding";
import { completeMemberEmailBinding } from "./email-binding-lifecycle";
import { isValidEmail, normalizeEmail } from "../_core/password";
import { publicAccessUrl } from "./urls";

/** AAD связывает шифротекст с заявкой и её payload, поэтому перенос между заявками не проходит. */
function decryptProof(
  requestKey: string,
  payloadHash: string,
  cipher: string,
  proofHash: string,
) {
  const raw = process.env.AUTH_LINK_ENCRYPTION_KEY || "";
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32 || key.toString("base64") !== raw)
    throw new EmailBindingError("unavailable");
  const data = Buffer.from(cipher, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, data.subarray(0, 12));
  decipher.setAAD(Buffer.from(`email-binding:v1:${requestKey}:${payloadHash}`));
  decipher.setAuthTag(data.subarray(-16));
  const token = Buffer.concat([
    decipher.update(data.subarray(12, -16)),
    decipher.final(),
  ]).toString("utf8");
  if (
    !/^[A-Za-z0-9_-]{43}$/.test(token) ||
    createHash("sha256").update(`email-binding:v1:${token}`).digest("hex") !==
      proofHash
  )
    throw new EmailBindingError("unavailable");
  return token;
}

/** Ограниченная внутренняя доставка; приём SMTP не доказывает появление письма во входящих. */
export async function processMemberEmailBindingEmails(
  database: MySql2Database,
  send: (mail: Mail) => Promise<boolean>,
) {
  try {
    const candidates = await database
      .select({
        requestKey: memberEmailBindings.requestKey,
        userId: memberEmailBindings.userId,
      })
      .from(memberEmailBindings)
      .innerJoin(
        memberEmailBindingOutbox,
        eq(memberEmailBindings.requestKey, memberEmailBindingOutbox.requestKey),
      )
      .where(
        and(
          eq(memberEmailBindings.state, "pending"),
          isNull(memberEmailBindingOutbox.sentAt),
          isNull(memberEmailBindingOutbox.discardedAt),
          lte(memberEmailBindingOutbox.nextAttemptAt, sql`CURRENT_TIMESTAMP`),
          or(
            isNull(memberEmailBindingOutbox.leaseUntil),
            lte(memberEmailBindingOutbox.leaseUntil, sql`CURRENT_TIMESTAMP`),
          ),
        ),
      )
      .orderBy(
        asc(memberEmailBindingOutbox.nextAttemptAt),
        asc(memberEmailBindingOutbox.requestKey),
      )
      .limit(20);
    for (const candidate of candidates) {
      const leaseId = randomUUID();
      const claim = await database.transaction(async (tx) => {
        const [user] = await tx
          .select()
          .from(users)
          .where(eq(users.id, candidate.userId))
          .for("update");
        const [binding] = await tx
          .select()
          .from(memberEmailBindings)
          .where(eq(memberEmailBindings.requestKey, candidate.requestKey))
          .for("update");
        const [mail] = await tx
          .select()
          .from(memberEmailBindingOutbox)
          .where(eq(memberEmailBindingOutbox.requestKey, candidate.requestKey))
          .for("update");
        if (
          !binding ||
          binding.userId !== candidate.userId ||
          binding.state !== "pending" ||
          !mail ||
          mail.sentAt ||
          mail.discardedAt ||
          mail.nextAttemptAt.getTime() > Date.now() ||
          (mail.leaseUntil && mail.leaseUntil.getTime() > Date.now())
        )
          return null;
        if (binding.expiresAt.getTime() <= Date.now()) {
          await completeMemberEmailBinding(tx, binding.requestKey, "expired");
          return null;
        }
        if (mail.attempts >= 12) {
          await completeMemberEmailBinding(tx, binding.requestKey, "cancelled");
          return null;
        }
        if (
          !user ||
          user.role !== "user" ||
          user.blockedAt ||
          user.accountDeletionRequestedAt ||
          user.openId.startsWith("deleted-") ||
          !user.phone?.trim() ||
          (user.email !== null && user.email !== "") ||
          !binding.email ||
          !isValidEmail(binding.email) ||
          normalizeEmail(binding.email) !== binding.email
        ) {
          await completeMemberEmailBinding(tx, binding.requestKey, "cancelled");
          return null;
        }
        const [occupied] = await tx
          .select({ id: users.id })
          .from(users)
          .where(
            sql`NULLIF(LOWER(TRIM(${users.email})), '') = ${binding.email}`,
          )
          .limit(1);
        if (occupied) {
          await completeMemberEmailBinding(tx, binding.requestKey, "cancelled");
          return null;
        }
        await tx
          .update(memberEmailBindingOutbox)
          .set({
            leaseId,
            leaseUntil: new Date(Date.now() + 300000),
            attempts: mail.attempts + 1,
          })
          .where(eq(memberEmailBindingOutbox.requestKey, binding.requestKey));
        return { binding, mail, email: binding.email };
      });
      if (!claim) continue;
      let success = false;
      try {
        const token = decryptProof(
          claim.binding.requestKey,
          claim.binding.payloadHash,
          claim.mail.tokenCipher || "",
          claim.binding.proofHash || "",
        );
        // Используем доверенный origin конфигурации, а не Host/Origin вызывающего клиента.
        const url = publicAccessUrl(token);
        url.pathname = "/api/auth/email-binding";
        // Старый процесс мог продолжить работу после отзыва заявки или смены lease.
        const [owned] = await database
          .select({ requestKey: memberEmailBindingOutbox.requestKey })
          .from(memberEmailBindingOutbox)
          .innerJoin(
            memberEmailBindings,
            eq(
              memberEmailBindings.requestKey,
              memberEmailBindingOutbox.requestKey,
            ),
          )
          .where(
            and(
              eq(memberEmailBindingOutbox.requestKey, claim.binding.requestKey),
              eq(memberEmailBindingOutbox.leaseId, leaseId),
              gt(memberEmailBindingOutbox.leaseUntil, sql`CURRENT_TIMESTAMP`),
              isNull(memberEmailBindingOutbox.sentAt),
              isNull(memberEmailBindingOutbox.discardedAt),
              eq(memberEmailBindings.state, "pending"),
              gt(memberEmailBindings.expiresAt, sql`CURRENT_TIMESTAMP`),
            ),
          )
          .limit(1);
        if (!owned) continue;
        success = await send({
          to: claim.email,
          subject: "Подтверждение почты DARYADARCY",
          text: `Администратор запросил привязку этой почты к вашему аккаунту. Подтвердите адрес по одноразовой ссылке:\n${url.toString()}\nСсылка действует 24 часа. Если вы не запрашивали привязку, ничего не делайте.`,
          messageId: `<email-binding-${claim.binding.requestKey}@daryadarcy.com>`,
        });
      } catch {
        /* Never expose proof, cipher, SMTP or SQL payloads. */
      }
      await database.transaction(async (tx) => {
        await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, candidate.userId))
          .for("update");
        const [binding] = await tx
          .select()
          .from(memberEmailBindings)
          .where(eq(memberEmailBindings.requestKey, candidate.requestKey))
          .for("update");
        const [mail] = await tx
          .select()
          .from(memberEmailBindingOutbox)
          .where(eq(memberEmailBindingOutbox.requestKey, candidate.requestKey))
          .for("update");
        // Поздний SMTP-ответ не воскрешает завершённый proof и не перезаписывает
        // lease, который уже получил заменяющий worker.
        if (binding?.state !== "pending" || !mail || mail.leaseId !== leaseId)
          return;
        if (
          binding.expiresAt.getTime() <= Date.now() ||
          (!success && mail.attempts >= 12)
        ) {
          await completeMemberEmailBinding(
            tx,
            binding.requestKey,
            binding.expiresAt.getTime() <= Date.now() ? "expired" : "cancelled",
          );
          return;
        }
        await tx
          .update(memberEmailBindingOutbox)
          .set(
            success
              ? {
                  sentAt: new Date(),
                  tokenCipher: null,
                  lastError: null,
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
                        60000 * 2 ** Math.min(mail.attempts - 1, 10),
                      ),
                  ),
                },
          )
          .where(eq(memberEmailBindingOutbox.requestKey, binding.requestKey));
      });
    }
  } catch {
    throw new EmailBindingError("unavailable");
  }
}
