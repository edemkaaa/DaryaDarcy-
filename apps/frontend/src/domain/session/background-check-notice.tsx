"use client";
import { useAuth } from "./session-context";
import { useClub } from "@/domain/subscription/subscription-context";
import { useBackgroundNotice } from "@/shared/ui/background-notice";

/** Render beside the screen so a failed background check cannot replace its state. */
export function BackgroundCheckNotice() {
  const session = useAuth();
  const club = useClub();
  useBackgroundNotice({
    when: Boolean(session.refreshError),
    priority: 2,
    message: "Не удалось обновить сессию. Проверьте соединение.",
    onRetry: session.refresh,
  });
  useBackgroundNotice({
    when: Boolean(club.refreshError),
    priority: 1,
    message: "Не удалось обновить подписку. Попробуйте ещё раз.",
    onRetry: club.refreshSubscription,
  });
  return null;
}
