// Очищает почтовые данные обезличенных аккаунтов только на собственной локальной БД. Запись требует отдельного флага, связи оплаченных заказов сохраняются.
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { and, count, eq, exists, inArray, isNull, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import {
  accessEmailOutbox,
  passwordTokens,
  users,
} from "../../packages/database/src/schema";
import {
  accessEmailNeedsScrub,
  scrubAccessEmailData,
} from "../../apps/backend/src/identity/access-email-retention";

const exec = promisify(execFile);
const batchSize = 100;

async function main() {
  const [mode = "--dry-run", ...rest] = process.argv.slice(2);
  if (
    rest.length ||
    !["--dry-run", "--apply-local"].includes(mode) ||
    process.env.NODE_ENV === "production" ||
    process.env.DOCKER_HOST
  )
    throw new Error("Invalid cleanup mode or environment");
  const uri = process.env.FRESH_DATABASE_URL;
  const id = process.env.FRESH_DATABASE_CONTAINER_ID;
  if (!uri || !id || !/^[a-f0-9]{64}$/.test(id))
    throw new Error("Explicit local fixture required");
  const { stdout } = await exec(
    "docker",
    ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
    { timeout: 5000 },
  );
  if (!stdout.trim().startsWith("unix:///"))
    throw new Error("Local Docker socket required");
  // Reuse the canonical loopback, ownership, tmpfs and migration-history checks.
  await exec(
    process.execPath,
    [
      "--import",
      "tsx",
      fileURLToPath(new URL("./fresh-database.ts", import.meta.url)),
      "--check-local",
    ],
    { timeout: 15000 },
  );
  const apply = mode === "--apply-local";
  const conn = await mysql.createConnection({
    uri,
    timezone: "Z",
    connectTimeout: 5000,
  });
  try {
    const result = await drizzle(conn).transaction(
      async (tx) => {
        const query = tx
          .select({ id: users.id })
          .from(users)
          .where(
            and(
              // Require the exact tombstone written for this user, including its own ID.
              sql`REGEXP_LIKE(${users.openId}, CONCAT('^deleted-', ${users.id}, '-[0-9]{13}$'), 'c')`,
              sql`CHAR_LENGTH(${users.openId}) = CHAR_LENGTH(CAST(${users.id} AS CHAR)) + 22`,
              isNull(users.email),
              isNull(users.phone),
              isNull(users.contactPhone),
              isNull(users.passwordHash),
              isNull(users.loginMethod),
              isNull(users.avatarUrl),
              isNull(users.accountDeletionRequestedAt),
              or(
                exists(
                  tx
                    .select({ id: passwordTokens.id })
                    .from(passwordTokens)
                    .where(eq(passwordTokens.userId, users.id)),
                ),
                exists(
                  tx
                    .select({ id: accessEmailOutbox.id })
                    .from(accessEmailOutbox)
                    .where(
                      and(
                        eq(accessEmailOutbox.userId, users.id),
                        accessEmailNeedsScrub(),
                      ),
                    ),
                ),
              ),
            ),
          )
          .orderBy(users.id)
          .limit(batchSize + 1);
        const rows = await (apply ? query.for("update") : query);
        const ids = rows.slice(0, batchSize).map(({ id }) => id);
        const result = {
          mode: apply ? "apply-local" : "dry-run",
          accounts: ids.length,
          passwordTokens: 0,
          mailRows: 0,
          hasMore: rows.length > batchSize,
        };
        if (!ids.length) return result;
        if (apply) {
          // The selection already holds metadata locks on these tables.
          const [engineRows] = await tx.execute(sql`
          SELECT ENGINE AS engine FROM information_schema.TABLES
          WHERE TABLE_SCHEMA=DATABASE()
          AND TABLE_NAME IN ('users', 'password_tokens', 'access_email_outbox')
        `);
          const engines: unknown = engineRows;
          if (
            !Array.isArray(engines) ||
            engines.length !== 3 ||
            engines.some(({ engine }) => engine !== "InnoDB")
          )
            throw new Error("Transactional cleanup tables required");
          for (const id of ids) {
            const scrubbed = await scrubAccessEmailData(tx, id);
            result.passwordTokens += scrubbed.passwordTokens;
            result.mailRows += scrubbed.mailRows;
          }
        } else {
          const [tokens] = await tx
            .select({ total: count() })
            .from(passwordTokens)
            .where(inArray(passwordTokens.userId, ids));
          const [mail] = await tx
            .select({ total: count() })
            .from(accessEmailOutbox)
            .where(
              and(
                inArray(accessEmailOutbox.userId, ids),
                accessEmailNeedsScrub(),
              ),
            );
          result.passwordTokens = tokens!.total;
          result.mailRows = mail!.total;
        }
        return result;
      },
      {
        isolationLevel: apply ? "read committed" : "repeatable read",
        accessMode: apply ? "read write" : "read only",
      },
    );
    console.log(JSON.stringify(result));
  } finally {
    await conn.end();
  }
}

main().catch(() => {
  console.error(
    "Retired access-email cleanup refused or failed on the local fixture.",
  );
  process.exitCode = 1;
});
