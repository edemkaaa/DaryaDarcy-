"use client";
/** Браузерная операция принадлежит текущей сессии и области экрана; отмена лишает поздний результат права менять интерфейс. */
import { useEffect, useState, useSyncExternalStore } from "react";
import { useAuth } from "./session-context";
import { isPersonalDataOwner } from "@/shared/browser/storage";
import { OperationScope } from "@/shared/browser/operation-scope";
import { getSessionRequestSignal } from "@/shared/api/request-lifecycle";
import { getHttpStatus } from "@/shared/api/errors";
import { requestSessionCheck } from "@/shared/api/session-events";

/** Один scope принадлежит экземпляру hook, активности, ключу объекта и пользователю; их смена отзывает право позднего ответа менять экран. */
export function useSessionOperation(
  active = true,
  scopeKey: string | number | null = null,
) {
  const { user, isAuthenticated } = useAuth();
  const [scope] = useState(() => new OperationScope());
  const kind = useSyncExternalStore(
    scope.subscribe,
    scope.getSnapshot,
    () => null,
  );
  useEffect(() => () => scope.cancel(), [scope, active, scopeKey, user?.id]);
  return {
    kind,
    busy: kind !== null,
    cancel: scope.cancel,
    /** Запускаем только подтверждённому активному владельцу; общий сигнал сессии и проверка storage owner сопровождают всю задачу. */
    begin: (operationKind: string) => {
      const ownerId = user?.id;
      if (!active || !isAuthenticated || !ownerId) return null;
      return scope.begin(operationKind, getSessionRequestSignal(), () =>
        isPersonalDataOwner(ownerId),
      );
    },
  };
}

/** Ошибка доступа прямого отменяемого вызова инициирует общую перепроверку сессии так же, как tRPC middleware. */
export function checkOperationAccessError(error: unknown): void {
  const status = getHttpStatus(error);
  if (status === 401 || status === 403) requestSessionCheck(status);
}
