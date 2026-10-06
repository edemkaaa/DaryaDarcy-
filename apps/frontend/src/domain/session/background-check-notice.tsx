"use client";
import { useState } from "react";
import { useAuth } from "./session-context";
import { useClub } from "@/domain/subscription/subscription-context";
import { Action } from "@/shared/ui/action";
import classes from "./background-check-notice.module.scss";

/** Render beside the screen so a failed background check cannot replace its state. */
export function BackgroundCheckNotice() {
  const session = useAuth();
  const club = useClub();
  const [retrying, setRetrying] = useState(false);
  if (!session.refreshError && !club.refreshError) return null;
  return (
    <div className={classes.notice} role="status">
      <span>
        {session.refreshError
          ? "Не удалось обновить сессию. Проверьте соединение."
          : "Не удалось обновить подписку. Попробуйте ещё раз."}
      </span>
      <Action
        className={classes.retry}
        disabled={retrying}
        onClick={async () => {
          setRetrying(true);
          try {
            await Promise.all([
              session.refreshError ? session.refresh() : undefined,
              club.refreshError ? club.refreshSubscription() : undefined,
            ]);
          } finally {
            setRetrying(false);
          }
        }}
      >
        {retrying ? "Проверяем…" : "Повторить"}
      </Action>
    </div>
  );
}
