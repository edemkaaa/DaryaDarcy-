import { apiUrl } from "@/shared/config/api";
import { discardLegacyCredentials } from "@/shared/api/token-storage";
import { ApiError, invalidResponse } from "./errors";
import { runApiRequest } from "./request-lifecycle";
export { ApiError } from "./errors";

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function retryAfter(
  response: Response,
  data: Record<string, unknown>,
): number | undefined {
  const value = data.retryAfterSec;
  if (typeof value === "number" && Number.isFinite(value) && value > 0)
    return Math.ceil(value);
  const header = response.headers.get("Retry-After");
  if (!header) return undefined;
  const seconds = /^\d+$/.test(header)
    ? Number(header)
    : (Date.parse(header) - Date.now()) / 1000;
  return Number.isFinite(seconds) && seconds > 0
    ? Math.ceil(seconds)
    : undefined;
}
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
};
type Session = {
  user: AuthUser;
};
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
  return {
    id: value.id as number,
    openId: value.openId,
    role: value.role,
    lastSignedIn: value.lastSignedIn,
    name: (value.name ?? null) as string | null,
    email: (value.email ?? null) as string | null,
    phone: (value.phone ?? null) as string | null,
    loginMethod: (value.loginMethod ?? null) as string | null,
    avatarUrl: (value.avatarUrl ?? null) as string | null,
    gender: (value.gender ?? null) as AuthUser["gender"],
  };
}
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
export const loginWithEmail = (
  email: string,
  password: string,
  totp?: string,
  signal?: AbortSignal,
) => authenticate("/api/auth/login", { email, password, totp }, signal);

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
export const requestPasswordInstructions = (
  email: string,
  signal?: AbortSignal,
) => requestInstructions("/api/auth/password/request", { email }, signal);
export const sendSmsCode = (phone: string) =>
  apiCall<{
    ok: true;
    retryAfterSec: number;
  }>("/api/auth/sms/send", { method: "POST", body: JSON.stringify({ phone }) });
export const verifySmsCode = (
  phone: string,
  code: string,
  consentVersion?: string,
  totp?: string,
) =>
  authenticate("/api/auth/sms/verify", { phone, code, consentVersion, totp });
export async function logout(signal?: AbortSignal): Promise<void> {
  const result = await apiCall<unknown>("/api/auth/logout", {
    method: "POST",
    signal,
  });
  if (
    !isObject(result) ||
    (Object.keys(result).length > 0 && result.ok !== true)
  )
    throw invalidResponse();
}
export async function getMe(signal?: AbortSignal): Promise<AuthUser | null> {
  const result = await apiCall<unknown>("/api/auth/me", { signal });
  if (!isObject(result) || !("user" in result)) throw invalidResponse();
  return result.user === null ? null : parseAuthUser(result.user);
}
export async function establishSession(token: string) {
  await apiCall("/api/auth/session", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return true;
}
