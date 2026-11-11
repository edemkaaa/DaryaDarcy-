// Архив Expo. Запасной setter контекста ничего не меняет без Provider.
import { useCallback, useContext, useEffect, useMemo, createContext, type ReactNode } from "react";

import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

interface ClubContextType {
  isSubscribed: boolean;
  setIsSubscribed: (value: boolean) => void;
  refreshSubscription: () => void;
  expiresAt: Date | null;
  cancelAtPeriodEnd: boolean;
  isOwner: boolean;
  monthlyPrice: string;
}

const ClubContext = createContext<ClubContextType>({
  isSubscribed: false,
  setIsSubscribed: () => {
    // Запасной setter контекста ничего не меняет без Provider.
},
  refreshSubscription: () => {
    // Запасное действие контекста ничего не делает без Provider.
},
  expiresAt: null,
  cancelAtPeriodEnd: false,
  isOwner: false,
  monthlyPrice: "790",
});

export function ClubProvider({ children }: { children: ReactNode }) {
  // Объединяет старый subscribed-ответ и UI-признак owner для потребителей Клуба.

  const { user, isOwner } = useAuth();
  const utils = trpc.useUtils();
  const subscription = trpc.club.subscription.useQuery(undefined, {
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    // При смене userId инвалидирует чтение подписки, чтобы предыдущий аккаунт не оставался источником данных.

    void utils.club.subscription.invalidate();
  }, [user?.id]);

  const refreshSubscription = useCallback(() => {
    // Явно инвалидирует серверное чтение подписки для текущего контекста.

    void utils.club.subscription.invalidate();
  }, [utils]);

  const isSubscribed = isOwner || Boolean(subscription.data?.subscribed);
  const setIsSubscribed = useCallback((_value: boolean) => {
    // Совместимый setter только инвалидирует серверную подписку, не выдавая доступ локальным boolean.

    void utils.club.subscription.invalidate();
  }, [utils]);
  const expiresAt = subscription.data?.expiresAt ? new Date(subscription.data.expiresAt) : null;
  const cancelAtPeriodEnd = Boolean(subscription.data?.cancelAtPeriodEnd);
  const monthlyPrice = subscription.data?.monthlyPrice || "790";

  const value = useMemo(
    () => /* Собирает контекст подписки из серверных полей, цены и действий повторного чтения. */ ({
      isSubscribed,
      setIsSubscribed,
      refreshSubscription,
      expiresAt,
      cancelAtPeriodEnd,
      isOwner,
      monthlyPrice,
    }),
    [isSubscribed, setIsSubscribed, refreshSubscription, expiresAt, cancelAtPeriodEnd, isOwner, monthlyPrice],
  );

  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>;
}

export function useClub() {
  // Возвращает текущий клубный контекст без собственного состояния доступа.

  return useContext(ClubContext);
}
