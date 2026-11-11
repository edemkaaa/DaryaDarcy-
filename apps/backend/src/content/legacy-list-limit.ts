/** Ограничиваем старые непостраничные списки и явно отказываем при превышении размера. */
import { TRPCError } from "@trpc/server";

export const LEGACY_LIST_CAP = 200;
/** Read at most cap+1 in SQL, then refuse explicitly before hydrating media. */
/** После SQL cap+1 явно отказывает PAYLOAD_TOO_LARGE при более200 строках до hydration, не выдавая незаметно усечённый старый список. */
export function boundedLegacyList<T>(rows: T[]): T[] {
  if (rows.length > LEGACY_LIST_CAP) throw new TRPCError({
    code: "PAYLOAD_TOO_LARGE",
    message: "Список слишком большой. Используйте постраничную загрузку",
  });
  return rows;
}
