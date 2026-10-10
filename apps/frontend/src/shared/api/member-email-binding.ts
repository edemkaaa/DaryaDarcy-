import { apiUrl } from "@/shared/config/api";
import { ApiError, invalidResponse } from "./errors";
import { runApiRequest } from "./request-lifecycle";

type BindingState = "pending" | "confirmed" | "expired" | "cancelled";
export type MemberEmailBindingIntent = { userId: number; requestKey: string };
export type MemberEmailBindingReceipt = {
  requestKey: string;
  state: BindingState;
};
export type MemberEmailBindingStatus = MemberEmailBindingReceipt & {
  userId: number;
  delivery: "queued" | "sent" | "unavailable";
  expiresAt: string;
  completedAt: string | null;
};

function captureIntent(
  input: MemberEmailBindingIntent,
): MemberEmailBindingIntent {
  const { userId, requestKey } = input;
  if (
    !Number.isSafeInteger(userId) ||
    userId < 1 ||
    userId > 2147483647 ||
    typeof requestKey !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      requestKey,
    )
  )
    throw new ApiError("Некорректная заявка на привязку почты.", 400);
  return { userId, requestKey };
}

function exactObject(value: unknown, keys: string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    !keys.every((key) => Object.hasOwn(value, key))
  )
    throw invalidResponse();
  return value as Record<string, unknown>;
}

function receipt(
  value: Record<string, unknown>,
  requestKey: string,
): MemberEmailBindingReceipt {
  if (
    value.requestKey !== requestKey ||
    (value.state !== "pending" &&
      value.state !== "confirmed" &&
      value.state !== "expired" &&
      value.state !== "cancelled")
  )
    throw invalidResponse();
  return { requestKey, state: value.state };
}

function isUtcDate(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value)
  )
    return false;
  const date = new Date(value);
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().replace(".000Z", "Z") === value.replace(".000Z", "Z")
  );
}

async function readReply(
  response: Response,
  expectedStatus: number,
): Promise<unknown> {
  if (!response.ok) {
    const messages: Record<number, string> = {
      400: "Проверьте данные заявки.",
      401: "Сессия завершилась. Войдите снова.",
      403: "Нет доступа к привязке почты.",
      404: "Заявка или аккаунт недоступны.",
      409: "Привязка конфликтует с текущими данными. Проверьте заявку и аккаунт.",
      429: "Слишком много запросов. Повторите позже.",
      503: "Привязка почты временно недоступна.",
    };
    const rawRetry = response.headers.get("Retry-After") || "";
    const seconds = /^\d+$/.test(rawRetry) ? Number(rawRetry) : NaN;
    throw new ApiError(
      messages[response.status] ||
        "Не удалось получить результат привязки почты.",
      response.status,
      response.status === 429 && Number.isSafeInteger(seconds) && seconds > 0
        ? seconds
        : undefined,
    );
  }
  if (response.status !== expectedStatus) throw invalidResponse();
  try {
    return await response.json();
  } catch {
    throw invalidResponse();
  }
}

/** The form validates before capturing an intent; transport repeats the same check. */
export function normalizeMemberEmailBindingEmail(value: string): string {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (
    typeof value !== "string" ||
    value.length > 1024 ||
    email.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  )
    throw new ApiError("Укажите корректный email.", 400);
  return email;
}

/** Caller owns the stable intent. No automatic retry or new key on a lost reply. */
export function requestMemberEmailBinding(
  input: MemberEmailBindingIntent & { email: string },
  signal: AbortSignal,
): Promise<MemberEmailBindingReceipt> {
  const { userId, requestKey } = captureIntent(input);
  const email = normalizeMemberEmailBindingEmail(input.email);
  return runApiRequest(
    apiUrl("/api/admin/member-email-bindings"),
    {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, email, requestKey }),
      signal,
    },
    async (response) =>
      receipt(
        exactObject(await readReply(response, 202), ["requestKey", "state"]),
        requestKey,
      ),
  );
}

/** Read the captured member/key only; sent is SMTP acceptance, not email binding. */
export function getMemberEmailBinding(
  intent: MemberEmailBindingIntent,
  signal: AbortSignal,
): Promise<MemberEmailBindingStatus> {
  const { userId, requestKey } = captureIntent(intent);
  return runApiRequest(
    apiUrl(`/api/admin/member-email-bindings/${requestKey}`),
    {
      method: "GET",
      cache: "no-store",
      signal,
    },
    async (response) => {
      const value = exactObject(await readReply(response, 200), [
        "requestKey",
        "userId",
        "state",
        "delivery",
        "expiresAt",
        "completedAt",
      ]);
      const accepted = receipt(value, requestKey);
      if (
        value.userId !== userId ||
        (value.delivery !== "queued" &&
          value.delivery !== "sent" &&
          value.delivery !== "unavailable") ||
        !isUtcDate(value.expiresAt) ||
        (accepted.state === "pending"
          ? value.completedAt !== null
          : !isUtcDate(value.completedAt))
      )
        throw invalidResponse();
      return {
        ...accepted,
        userId,
        delivery: value.delivery,
        expiresAt: value.expiresAt,
        completedAt: value.completedAt as string | null,
      };
    },
  );
}
