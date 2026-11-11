/** Ответ постановки письма в очередь проверяется отдельно от фактической доставки получателю. */
import { apiUrl } from "@/shared/config/api";
import { ApiError, invalidResponse } from "./errors";
import { runApiRequest } from "./request-lifecycle";
import { parseRetryAfter } from "./retry-after";
import { adminActionKey } from "@shared/admin-action";

/** Acknowledges enqueueing only; this endpoint cannot prove delivery. */
export function resendAccessEmail(
  userId: number,
  signal: AbortSignal,
  idempotencyKey: string,
) {
  if (!Number.isSafeInteger(userId) || userId <= 0)
    throw new ApiError("Некорректный аккаунт участницы.", 400);
  if (!adminActionKey.safeParse(idempotencyKey).success)
    throw invalidResponse();
  return runApiRequest(
    apiUrl("/api/admin/access-email/resend"),
    {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, idempotencyKey }),
      signal,
    },
    async (response) => {
      if (!response.ok) {
        const message =
          response.status === 400
            ? "Нет доступного аккаунта с оплаченной подпиской. Проверьте почту и срок Клуба."
            : response.status === 401
              ? "Сессия завершилась. Войдите снова."
              : response.status === 403
                ? "Нет доступа к повторному письму."
                : response.status === 429
                  ? "Слишком много запросов. Повторите позже."
                  : "Не удалось поставить письмо в очередь.";
        throw new ApiError(
          message,
          response.status,
          parseRetryAfter(response.headers.get("Retry-After")),
        );
      }
      if (response.status !== 202) throw invalidResponse();
      let result: unknown;
      try {
        result = await response.json();
      } catch {
        throw invalidResponse();
      }
      if (
        !result ||
        typeof result !== "object" ||
        Array.isArray(result) ||
        !("queued" in result) ||
        result.queued !== true
      )
        throw invalidResponse();
    },
  );
}
