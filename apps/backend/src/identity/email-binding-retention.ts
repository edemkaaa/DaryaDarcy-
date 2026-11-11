/** Отменяет и очищает привязки удаляемого аккаунта в той же транзакции владельца. */
import { asc, eq, and, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  adminAuditLog,
  memberEmailBindings,
} from "../../../../packages/database/src/schema";
import { EmailBindingError } from "./email-binding";
import { completeMemberEmailBinding } from "./email-binding-lifecycle";

type Transaction = Parameters<Parameters<MySql2Database["transaction"]>[0]>[0];

/** Вызывающий код удерживает блокировку пользователя до завершения всей транзакции удаления. */
export async function cancelDeletedUserEmailBindings(
  tx: Transaction,
  userId: number,
) {
  try {
    // До миграции 0028 обеих таблиц может не быть: заявок тогда не существовало.
    // Частичная схема прерывает всё удаление. Отключение UI-флага не должно
    // останавливать очистку персональных данных ранее принятых заявок.
    const [tables] =
      await tx.execute(sql`SELECT TABLE_NAME AS name FROM information_schema.TABLES
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('member_email_bindings','member_email_binding_outbox')`);
    if (!Array.isArray(tables)) throw new EmailBindingError("unavailable");
    const count = tables.length;
    if (count === 0) return;
    if (count !== 2) throw new EmailBindingError("unavailable");
    const bindings = await tx
      .select()
      .from(memberEmailBindings)
      .where(
        and(
          eq(memberEmailBindings.userId, userId),
          eq(memberEmailBindings.state, "pending"),
        ),
      )
      .orderBy(asc(memberEmailBindings.requestKey))
      .for("update");
    for (const binding of bindings) {
      await completeMemberEmailBinding(tx, binding.requestKey, "cancelled");
      await tx.insert(adminAuditLog).values({
        actorUserId: binding.actorUserId,
        action: "cancel_member_email_binding",
        targetType: "user",
        targetId: userId,
      });
    }
  } catch {
    throw new EmailBindingError("unavailable");
  }
}
