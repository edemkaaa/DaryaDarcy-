"use client";
/** Фоновый сбой проверки показываем поверх подтверждённого состояния, не выдавая его за выход пользователя. */
import { useAuth } from "./session-context";
import { useClub } from "@/domain/subscription/subscription-context";
import { useBackgroundNotice } from "@/shared/ui/background-notice";

/** Регистрируем независимые фоновые ошибки сессии и подписки с приоритетами, оставляя подтверждённый контент на экране. */
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
