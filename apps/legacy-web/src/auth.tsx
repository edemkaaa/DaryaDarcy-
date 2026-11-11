/** Архивная браузерная сессия Vite. Не переносить её упрощённую политику ошибок в действующий клиент. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type AuthUser = {
  id: number;
  name: string | null;
  email: string | null;
  role: string;
  avatarUrl?: string | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string, consentVersion?: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Читает ответ один раз и извлекает прежнее публичное сообщение, сохраняя текстовый fallback. */
async function readError(res: Response) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return json.error || json.message || text;
  } catch {
    return text || res.statusText;
  }
}

/** Хранит старую модель пользователя и предоставляет действия входа. Этот архивный код не содержит современных журналов неопределённых операций. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  /** Старое поведение очищает пользователя и при HTTP-ошибке, и при сетевом сбое; это ограничение архива, а не требование действующего клиента. */
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) {
        setUser(null);
        return;
      }
      const data = await res.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  /** Передаёт пароль серверу с cookie и читает профиль из успешного JSON-ответа. */
  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(await readError(res));
    const data = await res.json();
    setUser(data.user ?? null);
  }, []);

  /** Сохраняет прежнее ожидание профиля в ответе регистрации; современная регистрация может иметь другой публичный контракт. */
  const register = useCallback(async (email: string, password: string, name?: string, consentVersion?: string) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, consentVersion }),
    });
    if (!res.ok) throw new Error(await readError(res));
    const data = await res.json();
    setUser(data.user ?? null);
  }, []);

  /** Старый путь очищает локальный профиль без проверки успешного HTTP-статуса выхода. */
  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
  }, []);

  /** Сохраняет ссылку на контекст между рендерами, пока пользователь и действия не изменились. */
  const value = useMemo(
    () => ({ user, loading, refresh, login, register, logout }),
    [user, loading, refresh, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Не допускает использования старого контекста вне его провайдера. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
