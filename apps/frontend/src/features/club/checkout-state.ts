/** Общие состояния оплаты отделяют ожидание провайдера, отказ и подтверждённый доступ от отображения формы. */
import { z } from "zod";

const returnResultSchema = z
  .object({ state: z.enum(["unknown", "pending", "succeeded", "canceled"]) })
  .strict();

/** Browser storage and URL flags cannot substitute for this server reply. */
export function parseClubCheckoutState(result: unknown) {
  const parsed = returnResultSchema.safeParse(result);
  if (!parsed.success)
    throw new Error(
      "Не удалось проверить результат оплаты. Повторите проверку.",
    );
  return parsed.data;
}
