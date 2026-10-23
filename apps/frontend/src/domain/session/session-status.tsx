"use client";
import { useAuth } from "./session-context";
import { QueryRetryState } from "@/shared/ui/query-retry-state";
import { ScreenStatus } from "@/shared/ui/screen-status";

/** Used by private screens so a failed session check never masquerades as a guest. */
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
