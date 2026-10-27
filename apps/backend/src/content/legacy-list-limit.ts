import { TRPCError } from "@trpc/server";

export const LEGACY_LIST_CAP = 200;
/** Read at most cap+1 in SQL, then refuse explicitly before hydrating media. */
export function boundedLegacyList<T>(rows: T[]): T[] {
  if (rows.length > LEGACY_LIST_CAP) throw new TRPCError({
    code: "PAYLOAD_TOO_LARGE",
    message: "Список слишком большой. Используйте постраничную загрузку",
  });
  return rows;
}
