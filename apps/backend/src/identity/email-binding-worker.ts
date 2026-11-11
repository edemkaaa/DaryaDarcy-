/** Включаемая отдельно фоновая очистка и доставка привязок; проверка схемы не применяет миграции. */
import type { MySql2Database } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import {
  users,
  memberEmailBindings,
  memberEmailBindingOutbox,
} from "../../../../packages/database/src/schema";
import type { Mail } from "./access";
import { EmailBindingError } from "./email-binding";
import { processMemberEmailBindingEmails } from "./email-binding-delivery";
import { maintainMemberEmailBindings } from "./email-binding-lifecycle";

/** Только проверка наличия схемы, не замена проверенной миграционной истории и preflight данных. */
async function requireBindingSchema(database: MySql2Database) {
  await database.select().from(users).limit(0);
  await database.select().from(memberEmailBindings).limit(0);
  await database.select().from(memberEmailBindingOutbox).limit(0);
  const [indexes] = await database.execute(sql`
    SELECT TABLE_NAME AS tableName, INDEX_NAME AS indexName,
      COLUMN_NAME AS columnName, EXPRESSION AS expression, SEQ_IN_INDEX AS position
    FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND NON_UNIQUE=0
      AND ((TABLE_NAME='users' AND INDEX_NAME='users_email_identity_unique')
        OR (TABLE_NAME='member_email_bindings' AND INDEX_NAME IN ('PRIMARY','member_email_bindings_proofHash_unique'))
        OR (TABLE_NAME='member_email_binding_outbox' AND INDEX_NAME='PRIMARY'))`);
  if (!Array.isArray(indexes) || indexes.length !== 4)
    throw new EmailBindingError("unavailable");
  const expected = new Map([
    ["users/users_email_identity_unique", "nullif(lower(trim(email)),'')"],
    ["member_email_bindings/PRIMARY", "requestKey"],
    [
      "member_email_bindings/member_email_bindings_proofHash_unique",
      "proofHash",
    ],
    ["member_email_binding_outbox/PRIMARY", "requestKey"],
  ]);
  for (const row of indexes as Record<string, unknown>[]) {
    const key = `${row.tableName}/${row.indexName}`;
    const value =
      row.columnName ??
      String(row.expression)
        .toLowerCase()
        .replace(/`|\s|\\|_utf8mb4/g, "");
    if (row.position !== 1 || expected.get(key) !== value)
      throw new EmailBindingError("unavailable");
    expected.delete(key);
  }
  if (expected.size) throw new EmailBindingError("unavailable");
}

/** Внутренний worker выключен по умолчанию; ограниченная очистка предшествует доставке по lease. */
export async function processMemberEmailBindingJobs(
  database: MySql2Database,
  send: (mail: Mail) => Promise<boolean>,
) {
  if (process.env.MEMBER_EMAIL_BINDING_ENABLED !== "true") return;
  try {
    await requireBindingSchema(database);
    if (process.env.MEMBER_EMAIL_BINDING_ENABLED !== "true") return;
    await maintainMemberEmailBindings(database);
    await processMemberEmailBindingEmails(database, send);
  } catch {
    throw new EmailBindingError("unavailable");
  }
}
