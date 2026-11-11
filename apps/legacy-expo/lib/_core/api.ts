// Архив Expo. Запрашивает письмо восстановления через REST; клиент не создаёт токен сам.
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "./auth";
import type { LaunchCapabilities } from "../../../../packages/shared/src/capabilities";

export async function requestPasswordInstructions(
  email: string,
): Promise<{ ok: boolean; message: string }> {
  // Запрашивает письмо восстановления через REST; клиент не создаёт токен сам.

  return apiCall("/api/auth/password/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}
export async function getAppCapabilities(): Promise<LaunchCapabilities> {
  // Оставляет включёнными только явно true флаги старого контракта, неизвестные поля игнорирует.

  const result =
    await apiCall<Partial<LaunchCapabilities>>("/api/capabilities");
  return {
    smsLogin: result?.smsLogin === true,
    penPals: result?.penPals === true,
    shopOnlinePayment: result?.shopOnlinePayment === true,
    webPush: result?.webPush === true,
  };
}

export async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  // Добавляет платформенную авторизацию и cookie, разбирает ошибку/JSON; старый wrapper не имеет общего timeout.

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  const sessionToken = await Auth.getSessionToken();
  if (sessionToken) {
    headers["Authorization"] = `Bearer ${sessionToken}`;
  }

  const baseUrl = getApiBaseUrl();
  // Ensure no double slashes between baseUrl and endpoint
  const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = baseUrl ? `${cleanBaseUrl}${cleanEndpoint}` : endpoint;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = errorText;
      let retryAfterSec: number | undefined;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.message || errorText;
        if (typeof errorJson.retryAfterSec === "number") {
          retryAfterSec = errorJson.retryAfterSec;
        }
        const error = new Error(
          errorMessage || `API call failed: ${response.statusText}`,
        ) as Error & {
          retryAfterSec?: number;
          requiresTotp?: boolean;
        };
        if (retryAfterSec) error.retryAfterSec = retryAfterSec;
        if (errorJson.requiresTotp) error.requiresTotp = true;
        throw error;
      } catch (parseErr) {
        if (parseErr instanceof Error && "requiresTotp" in parseErr)
          throw parseErr;
        // Not JSON, use text as is
      }
      const error = new Error(
        errorMessage || `API call failed: ${response.statusText}`,
      ) as Error & {
        retryAfterSec?: number;
      };
      if (retryAfterSec) error.retryAfterSec = retryAfterSec;
      throw error;
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      return data as T;
    }

    const text = await response.text();
    return (text ? JSON.parse(text) : {}) as T;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Unknown error occurred");
  }
}

// Logout
export async function logout(): Promise<void> {
  // Отправляет серверный POST выхода; очисткой локального состояния занимается владелец сессии.

  await apiCall<void>("/api/auth/logout", {
    method: "POST",
  });
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

export async function loginWithEmail(
  email: string,
  password: string,
  totp?: string,
): Promise<{ sessionToken: string; user: AuthUser }> {
  // Выполняет старый email-вход и сохраняет токен только если API его вернул.

  const result = await apiCall<{ sessionToken: string; user: AuthUser }>(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password, totp }),
    },
  );
  if (result.sessionToken) {
    await Auth.setSessionToken(result.sessionToken);
  }
  return result;
}

export async function registerWithEmail(
  email: string,
  name?: string,
  consentVersion?: string,
): Promise<{ ok: boolean; message: string }> {
  // Передаёт email, имя и версию согласия серверу без локальной выдачи аккаунта.

  return apiCall("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, name, consentVersion }),
  });
}

export async function sendSmsCode(
  phone: string,
): Promise<{ ok: true; retryAfterSec: number }> {
  // Исторический необязательный SMS-путь запрашивает код и серверную задержку повтора.

  return apiCall<{ ok: true; retryAfterSec: number }>("/api/auth/sms/send", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

export async function verifySmsCode(
  phone: string,
  code: string,
  consentVersion?: string,
  totp?: string,
): Promise<{ sessionToken: string; user: AuthUser }> {
  // Подтверждает код/согласие через сервер и принимает профиль старого формата.

  const result = await apiCall<{ sessionToken: string; user: AuthUser }>(
    "/api/auth/sms/verify",
    {
      method: "POST",
      body: JSON.stringify({ phone, code, consentVersion, totp }),
    },
  );
  if (result.sessionToken) {
    await Auth.setSessionToken(result.sessionToken);
  }
  return result;
}

// Get current authenticated user (web uses cookie-based auth)
export async function getMe(): Promise<{
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
} | null> {
  // Исторически сводит любую ошибку проверки к null; это ограничение архивного клиента, не нынешний контракт временных ошибок.

  try {
    const result = await apiCall<{ user: any }>("/api/auth/me");
    return result.user || null;
  } catch (error) {
    return null;
  }
}

// Establish session cookie on the backend (3000-xxx domain)
// Called after receiving token via postMessage to get a proper Set-Cookie from the backend
export async function establishSession(token: string): Promise<boolean> {
  // Обменивает переданный Bearer на серверную cookie отдельным credentialed POST; false включает сетевые ошибки.

  try {
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}/api/auth/session`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      credentials: "include", // Important: allows Set-Cookie to be stored
    });

    if (!response.ok) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}
