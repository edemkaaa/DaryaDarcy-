// Архив Expo. Преобразует старый REST-профиль в локальную модель с датой; это отображение полей, не подтверждение роли на клиенте.
import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { isOwnerUser } from "@/constants/oauth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";
import { registerPushToken } from "@/lib/register-push";

type UseAuthOptions = {
  autoFetch?: boolean;
};

type AuthContextValue = {
  user: Auth.User | null;
  loading: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  isOwner: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  applySession: (apiUser: Api.AuthUser | null) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function mapApiUser(apiUser: Api.AuthUser): Auth.User {
  // Преобразует старый REST-профиль в локальную модель с датой; это отображение полей, не подтверждение роли на клиенте.

  return {
    id: apiUser.id,
    openId: apiUser.openId,
    name: apiUser.name,
    email: apiUser.email,
    phone: apiUser.phone ?? null,
    loginMethod: apiUser.loginMethod,
    gender: apiUser.gender ?? null,
    avatarUrl: apiUser.avatarUrl ?? null,
    lastSignedIn: new Date(apiUser.lastSignedIn),
    role: apiUser.role || "user",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Владеет старой сессией и загрузкой профиля отдельно для cookie-web и SecureStore-native.

  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const applySession = useCallback(async (apiUser: Api.AuthUser | null) => {
    // Обновляет профиль в памяти/локальном кеше и запускает необязательную регистрацию push после подтверждения пользователя.

    if (!apiUser) {
      setUser(null);
      await Auth.clearUserInfo();
      return;
    }
    const userInfo = mapApiUser(apiUser);
    setUser(userInfo);
    await Auth.setUserInfo(userInfo);
    void registerPushToken();
  }, []);

  const fetchUser = useCallback(async () => {
    // На web читает серверную сессию, на native — исторический локальный кеш; в этой версии ошибка сбрасывает пользователя.

    try {
      setLoading(true);
      setError(null);

      if (Platform.OS === "web") {
        const apiUser = await Api.getMe();
        if (apiUser) {
          await applySession(apiUser);
        } else {
          setUser(null);
          await Auth.clearUserInfo();
          await Auth.removeSessionToken();
        }
      } else {

        const sessionToken = await Auth.getSessionToken();
        if (!sessionToken) {
          setUser(null);
        } else {
          const cachedUser = await Auth.getUserInfo();
          setUser(cachedUser);
        }
      }
    } catch (err) {
      const nextError = err instanceof Error ? err : new Error("Failed to fetch user");
      setError(nextError);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [applySession]);

  const logout = useCallback(async () => {
    // Пробует серверный выход и всегда очищает локальные данные; сбой API не доказывает отзыв токена.

    try {
      await Api.logout();
    } catch (err) {
      console.error("[Auth] Logout API call failed:", err);
    } finally {
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      setUser(null);
      setError(null);
    }
  }, []);

  const isAuthenticated = useMemo(() => /* Вычисляет локальный признак наличия профиля без дополнительного запроса. */ Boolean(user), [user]);
  const isOwner = useMemo(() => /* Вычисляет UI-признак администратора через общий guard, не выдавая серверные права. */ isOwnerUser(user), [user]);

  useEffect(() => {
    // При монтировании запускает чтение сессии; зависимость от fetchUser определяет повтор запуска.

    void fetchUser();
  }, [fetchUser]);

  const value = useMemo(
    () => /* Собирает стабильное значение контекста из текущего профиля, ошибки и действий. */ ({
      user,
      loading,
      error,
      isAuthenticated,
      isOwner,
      refresh: fetchUser,
      logout,
      applySession,
    }),
    [user, loading, error, isAuthenticated, isOwner, fetchUser, logout, applySession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(_options?: UseAuthOptions) {
  // Требует AuthProvider над потребителем и возвращает его состояние без отдельного запроса.

  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
