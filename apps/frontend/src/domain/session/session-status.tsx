"use client";
/** Общий экран проверки сессии показывает ошибку отдельно от подтверждённого гостевого состояния. */
import { useAuth } from "./session-context";
import { QueryRetryState } from "@/shared/ui/query-retry-state";
import { ScreenStatus } from "@/shared/ui/screen-status";

/** Различаем повтор проверки и повтор незавершённого выхода; ошибку сессии не подменяем предложением входа гостю. */
export function SessionStatus() {
  const { loading, error, status, refresh, logout } = useAuth();
  return (
    <ScreenStatus>
      <QueryRetryState
        isLoading={loading}
        isError={Boolean(error)}
        message={error?.message}
        onRetry={() => {
          void (status === "logout-error" ? logout() : refresh());
        }}
      />
    </ScreenStatus>
  );
}
