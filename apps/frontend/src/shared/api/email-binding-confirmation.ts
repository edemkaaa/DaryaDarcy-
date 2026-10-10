import { apiUrl } from "@/shared/config/api";
import { ApiError, invalidResponse } from "./errors";
import { runApiRequest } from "./request-lifecycle";

/** Explicit proof action only; neither browser identity nor a return URL confirms it. */
export async function confirmEmailBinding(
  token: string,
  signal: AbortSignal,
): Promise<void> {
  if (
    typeof token !== "string" ||
    token.length !== 43 ||
    !/^[A-Za-z0-9_-]+$/.test(token)
  )
    throw new ApiError("Ссылка подтверждения недоступна.", 400);
  return runApiRequest(
    apiUrl("/api/auth/email-bindings/confirm"),
    {
      method: "POST",
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      signal,
    },
    async (response) => {
      if (!response.ok) {
        const retry = response.headers.get("Retry-After") || "";
        const seconds = /^\d+$/.test(retry) ? Number(retry) : NaN;
        // A consumed proof may follow a committed request whose response was lost.
        // Never echo a backend body or claim that refusal proves no email change.
        const message =
          response.status === 400
            ? "Ссылка недоступна или уже использована. Если предыдущая попытка прервалась, проверьте аккаунт через обычный вход или обратитесь к администратору."
            : response.status === 429
              ? "Слишком много запросов. Повторите позже."
              : "Подтверждение почты временно недоступно. Повторите позже.";
        throw new ApiError(
          message,
          response.status,
          response.status === 429 &&
            Number.isSafeInteger(seconds) &&
            seconds > 0
            ? seconds
            : undefined,
        );
      }
      if (response.status !== 200) throw invalidResponse();
      let value: unknown;
      try {
        value = await response.json();
      } catch {
        throw invalidResponse();
      }
      if (
        !value ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        Object.keys(value).length !== 1 ||
        !Object.hasOwn(value, "ok") ||
        (value as { ok: unknown }).ok !== true
      )
        throw invalidResponse();
    },
    15_000,
    false,
  );
}

/** Remove the URL fragment before returning a memory-only proof; never fetch here. */
export function takeEmailBindingProof(
  fragment: string,
  clear: () => void,
): string | null {
  try {
    clear();
  } catch {
    return null;
  }
  if (typeof fragment !== "string" || fragment.length !== 50) return null;
  return /^#token=([A-Za-z0-9_-]{43})$/.exec(fragment)?.[1] ?? null;
}
