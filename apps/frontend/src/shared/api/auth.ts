/** REST-методы входа и профиля проверяют публичный ответ; HttpOnly-cookie остаётся транспортом браузерной сессии. */
import { apiUrl } from "@/shared/config/api";
import { discardLegacyCredentials } from "@/shared/api/token-storage";
import { ApiError, invalidResponse } from "./errors";
import { runApiRequest } from "./request-lifecycle";
import { parseRetryAfter } from "./retry-after";
export { ApiError } from "./errors";

/** Для REST-конвертов нужен объект полей; массив и null не подтверждают форму ответа. */
function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
/** Предпочитаем положительную задержку тела, иначе разбираем HTTP-заголовок одним общим парсером. */
function retryAfter(
  response: Response,
  data: Record<string, unknown>,
): number | undefined {
  const value = data.retryAfterSec;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const seconds = parseRetryAfter(String(Math.ceil(value)));
    if (seconds !== undefined) return seconds;
  }
  return parseRetryAfter(response.headers.get("Retry-After"));
}
/** Общий REST-вызов читает JSON внутри deadline, нормализует ошибки и отключает HTTP-кеш; T задаёт ожидание, а не runtime-валидацию payload. */
export async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  discardLegacyCredentials();
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  return runApiRequest(
    apiUrl(endpoint),
    { ...options, headers, cache: "no-store" },
    async (response) => {
      const body = await response.text();
      let data: unknown = {};
      try {
        data = body ? JSON.parse(body) : {};
      } catch {
        if (response.ok) throw invalidResponse();
      }
      if (!response.ok) {
        const details = isObject(data) ? data : {};
        const supplied = details.error || details.message;
        const message =
          response.status >= 500
            ? "Сервис временно недоступен. Попробуйте ещё раз."
            : typeof supplied === "string" && supplied.length <= 500
              ? supplied
              : response.status === 429
                ? "Слишком много запросов. Попробуйте позже."
                : "Не удалось выполнить запрос";
        throw new ApiError(
          message,
          response.status,
          retryAfter(response, details),
          details.requiresTotp === true,
        );
      }
      return data as T;
    },
    15_000,
    !endpoint.startsWith("/api/auth/"),
  );
}
export type AuthUser = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  loginMethod: string | null;
  gender: "female" | "male" | null;
  avatarUrl: string | null;
  lastSignedIn: string;
  role: string;
  profileRevision?: number;
};
type Session = {
  user: AuthUser;
};
// Публичный профиль собираем явным списком полей; добавленное сервером внутреннее поле не становится частью локальной сессии.
/** Проверяем обязательные поля профиля и собираем публичный объект явно, не распространяя внутренние серверные поля через spread. */
export function parseAuthUser(value: unknown): AuthUser {
  if (
    !isObject(value) ||
    !Number.isSafeInteger(value.id) ||
    Number(value.id) <= 0 ||
    typeof value.openId !== "string" ||
    !value.openId ||
    typeof value.role !== "string" ||
    !value.role ||
    typeof value.lastSignedIn !== "string" ||
    !Number.isFinite(Date.parse(value.lastSignedIn))
  )
    throw invalidResponse();
  for (const field of [
    "name",
    "email",
    "phone",
    "loginMethod",
    "avatarUrl",
  ] as const) {
    if (value[field] != null && typeof value[field] !== "string")
      throw invalidResponse();
  }
  if (
    value.gender != null &&
    value.gender !== "female" &&
    value.gender !== "male"
  )
    throw invalidResponse();
  if (
    value.profileRevision !== undefined &&
    (!Number.isSafeInteger(value.profileRevision) ||
      Number(value.profileRevision) < 0)
  )
    throw invalidResponse();
  return {
    id: value.id as number,
    openId: value.openId,
    role: value.role,
    ...(value.profileRevision === undefined
      ? {}
      : { profileRevision: value.profileRevision as number }),
    lastSignedIn: value.lastSignedIn,
    name: (value.name ?? null) as string | null,
    email: (value.email ?? null) as string | null,
    phone: (value.phone ?? null) as string | null,
    loginMethod: (value.loginMethod ?? null) as string | null,
    avatarUrl: (value.avatarUrl ?? null) as string | null,
    gender: (value.gender ?? null) as AuthUser["gender"],
  };
}
/** Ожидаем конверт с валидным user после POST; токен не возвращается и не сохраняется в браузерном хранилище. */
async function authenticate(
  endpoint: string,
  input: object,
  signal?: AbortSignal,
): Promise<Session> {
  const result = await apiCall<unknown>(endpoint, {
    method: "POST",
    body: JSON.stringify(input),
    signal,
  });
  if (!isObject(result)) throw invalidResponse();
  return { user: parseAuthUser(result.user) };
}
/** Вход отправляет email/пароль и необязательный TOTP существующему REST login, сохраняя сигнал владельца формы. */
export const loginWithEmail = (
  email: string,
  password: string,
  totp?: string,
  signal?: AbortSignal,
) => authenticate("/api/auth/login", { email, password, totp }, signal);

// Регистрация и восстановление подтверждают принятие инструкции, а не установку пароля или доставку письма.
/** Регистрация или recovery принимают только ok=true и непустую инструкцию; этот ответ не подтверждает доставку письма. */
async function requestInstructions(
  endpoint: string,
  input: object,
  signal?: AbortSignal,
) {
  const result = await apiCall<unknown>(endpoint, {
    method: "POST",
    body: JSON.stringify(input),
    signal,
  });
  if (
    !isObject(result) ||
    result.ok !== true ||
    typeof result.message !== "string" ||
    !result.message.trim()
  )
    throw invalidResponse();
  return { ok: true, message: result.message };
}
/** Передаём версию согласия вместе с данными регистрации и возвращаем только принятую сервером инструкцию. */
export const registerWithEmail = (
  email: string,
  name?: string,
  consentVersion?: string,
  signal?: AbortSignal,
) =>
  requestInstructions(
    "/api/auth/register",
    { email, name, consentVersion },
    signal,
  );
/** Просим инструкцию для email без создания сессии; установку пароля выполняет отдельный одноразовый endpoint. */
export const requestPasswordInstructions = (
  email: string,
  signal?: AbortSignal,
) => requestInstructions("/api/auth/password/request", { email }, signal);
/** Совместимый SMS-метод только отправляет запрос коду; доступность функции контролируется отдельно capabilities. */
export const sendSmsCode = (phone: string) =>
  apiCall<{
    ok: true;
    retryAfterSec: number;
  }>("/api/auth/sms/send", { method: "POST", body: JSON.stringify({ phone }) });
/** Проверка кода использует тот же парсер публичной сессии, что и email-вход; сама функция не включает SMS-сценарий. */
export const verifySmsCode = (
  phone: string,
  code: string,
  consentVersion?: string,
  totp?: string,
) =>
  authenticate("/api/auth/sms/verify", { phone, code, consentVersion, totp });
/** Серверный выход подтверждается явным success=true; непонятный ответ оставляет отзыв сессии неподтверждённым. */
export async function logout(signal?: AbortSignal): Promise<void> {
  const result = await apiCall<unknown>("/api/auth/logout", {
    method: "POST",
    signal,
  });
  if (!isObject(result) || result.success !== true) throw invalidResponse();
}
/** Отличаем подтверждённый user=null от ошибки конверта или чтения; остальные профили проходят parseAuthUser. */
export async function getMe(signal?: AbortSignal): Promise<AuthUser | null> {
  const result = await apiCall<unknown>("/api/auth/me", { signal });
  if (!isObject(result) || !("user" in result)) throw invalidResponse();
  return result.user === null ? null : parseAuthUser(result.user);
}
/** Совместимый обмен отправляет bearer только на сервер установки сессии; локально строка токена не сохраняется. */
export async function establishSession(token: string) {
  await apiCall("/api/auth/session", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return true;
}
