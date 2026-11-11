/** Восстановление пароля использует отдельный контракт: получение инструкции не равно установке нового пароля. */
import { apiUrl } from "@/shared/config/api";
import { ApiError, invalidResponse } from "./errors";
import { runApiRequest } from "./request-lifecycle";
import { parseRetryAfter } from "./retry-after";

/** Отправляем одноразовый токен без cookie и referrer; 400/429 получают отдельные сообщения, успех проверяется по ok=true. Токен не сохраняем, не логируем и не отправляем автоматически повторно. */
export function completePassword(
  token: string,
  password: string,
  signal: AbortSignal,
): Promise<void> {
  return runApiRequest(
    apiUrl("/api/auth/password/complete"),
    {
      method: "POST",
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
      signal,
    },
    async (response) => {
      if (response.status === 429)
        throw new ApiError(
          "Слишком много попыток. Подождите перед повторным сохранением.",
          429,
          parseRetryAfter(response.headers.get("Retry-After")) ?? 60,
        );
      if (response.status === 400)
        throw new ApiError(
          "Ссылка недействительна или истекла. Запросите новую ссылку на странице входа.",
          400,
        );
      if (!response.ok)
        throw new ApiError(
          "Не удалось подтвердить сохранение пароля.",
          response.status,
        );
      const data: unknown = await response.json().catch(() => null);
      if (
        !data ||
        typeof data !== "object" ||
        !("ok" in data) ||
        data.ok !== true
      )
        throw invalidResponse();
    },
    15_000,
    false,
  );
}
