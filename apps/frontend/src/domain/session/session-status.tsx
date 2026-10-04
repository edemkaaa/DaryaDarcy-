"use client";
import { useAuth } from "./session-context";
import { QueryRetryState } from "@/shared/ui/query-retry-state";
import { ScreenContainer } from "@/shared/ui/screen-container";

/** Used by private screens so a failed session check never masquerades as a guest. */
export function SessionStatus() {
  const { loading, error, status, refresh, logout } = useAuth();
  return (
    <ScreenContainer backgroundColor="#FDF8F0">
      <QueryRetryState
        isLoading={loading}
        isError={Boolean(error)}
        message={error?.message}
        onRetry={() => {
          void (status === "logout-error" ? logout() : refresh());
        }}
      />
    </ScreenContainer>
  );
}
