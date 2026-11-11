/** Отсутствие доступной БД превращается в ошибку инфраструктуры, а не в успешный пустой каталог. */
import { TRPCError } from "@trpc/server";
import type { MySql2Database } from "drizzle-orm/mysql2";

/** Missing infrastructure is not evidence of an empty catalog or a deleted file. */
/** Сужаем nullable-подключение после проверки и возвращаем SERVICE_UNAVAILABLE вместо успешного пустого каталога при инфраструктурном сбое. */
export function requireContentDatabase(
  database: MySql2Database | null,
): asserts database is MySql2Database {
  if (!database)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Материалы временно недоступны",
    });
}
