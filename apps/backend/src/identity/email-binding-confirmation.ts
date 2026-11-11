/** Погашает одноразовое доказательство привязки почты; подтверждение адреса не создаёт сессию. */
import type { MySql2Database } from "drizzle-orm/mysql2";
import { eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import {
  adminAuditLog,
  memberEmailBindings,
  users,
} from "../../../../packages/database/src/schema";
import { isValidEmail, normalizeEmail } from "../_core/password";
import { EmailBindingError, isEmailBindingDuplicate } from "./email-binding";
import { completeMemberEmailBinding as completeIntent } from "./email-binding-lifecycle";

/** Внутренняя операция подтверждения адреса: не аутентифицирует и не выдаёт сессию. */
export async function confirmMemberEmailBinding(
  database: MySql2Database,
  token: string,
): Promise<boolean> {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token))
    return false;
  const proofHash = createHash("sha256")
    .update(`email-binding:v1:${token}`)
    .digest("hex");
  try {
    // Здесь определяем лишь получателя; права и proof повторно читаются под
    // блокировками, предварительная выборка не разрешает запись.
    const [candidate] = await database
      .select({
        requestKey: memberEmailBindings.requestKey,
        userId: memberEmailBindings.userId,
      })
      .from(memberEmailBindings)
      .where(eq(memberEmailBindings.proofHash, proofHash))
      .limit(1);
    if (!candidate) return false;
    return await database.transaction(async (tx) => {
      // Порядок user → binding → outbox общий с созданием заявки и удалением аккаунта.
      const [recipient] = await tx
        .select()
        .from(users)
        .where(eq(users.id, candidate.userId))
        .for("update");
      const [binding] = await tx
        .select()
        .from(memberEmailBindings)
        .where(eq(memberEmailBindings.requestKey, candidate.requestKey))
        .for("update");
      if (
        !binding ||
        binding.userId !== candidate.userId ||
        binding.state !== "pending" ||
        binding.proofHash !== proofHash
      )
        return false;
      if (binding.expiresAt.getTime() <= Date.now()) {
        await completeIntent(tx, binding.requestKey, "expired");
        return false;
      }
      if (
        !recipient ||
        recipient.role !== "user" ||
        recipient.blockedAt ||
        recipient.accountDeletionRequestedAt ||
        recipient.openId.startsWith("deleted-") ||
        !recipient.phone?.trim() ||
        (recipient.email !== null && recipient.email !== "") ||
        !binding.email ||
        normalizeEmail(binding.email) !== binding.email ||
        !isValidEmail(binding.email)
      ) {
        await completeIntent(tx, binding.requestKey, "cancelled");
        return false;
      }
      const [occupied] = await tx
        .select({ id: users.id })
        .from(users)
        .where(sql`NULLIF(LOWER(TRIM(${users.email})), '') = ${binding.email}`)
        .limit(1);
      if (occupied) {
        await completeIntent(tx, binding.requestKey, "cancelled");
        return false;
      }
      try {
        // Владение email при гонке с регистрацией, оплатой или другой привязкой
        // определяет уникальный нормализованный индекс, а не предварительный SELECT.
        await tx
          .update(users)
          .set({ email: binding.email, updatedAt: recipient.updatedAt })
          .where(eq(users.id, recipient.id));
      } catch (error) {
        // duplicate-entry прерывает SQL-команду, но не транзакцию: здесь же очищаем
        // проигравшую заявку. Остальные ошибки требуют полного отката.
        if (!isEmailBindingDuplicate(error)) throw error;
        await completeIntent(tx, binding.requestKey, "cancelled");
        return false;
      }
      if (binding.expiresAt.getTime() <= Date.now()) {
        // Ожидание уникального индекса может пережить proof: отменяем ещё
        // незафиксированную запись email до истечения заявки.
        await tx
          .update(users)
          .set({ email: recipient.email, updatedAt: recipient.updatedAt })
          .where(eq(users.id, recipient.id));
        await completeIntent(tx, binding.requestKey, "expired");
        return false;
      }
      await completeIntent(tx, binding.requestKey, "confirmed");
      // Администратор-инициатор записывается как происхождение заявки,
      // а не как аутентифицированный исполнитель подтверждения по proof.
      await tx.insert(adminAuditLog).values({
        actorUserId: binding.actorUserId,
        action: "confirm_member_email_binding",
        targetType: "user",
        targetId: binding.userId,
      });
      return true;
    });
  } catch {
    // SQL-параметры могут содержать email/proof; не передаём и не журналируем исходную причину.
    throw new EmailBindingError("unavailable");
  }
}
