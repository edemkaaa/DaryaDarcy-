"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useAuth } from "./session-context";
import { isPersonalDataOwner } from "@/shared/browser/storage";
import { OperationScope } from "@/shared/browser/operation-scope";
import { getSessionRequestSignal } from "@/shared/api/request-lifecycle";
import { getHttpStatus } from "@/shared/api/errors";
import { requestSessionCheck } from "@/shared/api/session-events";

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
    begin: (operationKind: string) => {
      const ownerId = user?.id;
      if (!active || !isAuthenticated || !ownerId) return null;
      return scope.begin(operationKind, getSessionRequestSignal(), () =>
        isPersonalDataOwner(ownerId),
      );
    },
  };
}

/** Direct cancellable tRPC calls also participate in the access-error policy. */
export function checkOperationAccessError(error: unknown): void {
  const status = getHttpStatus(error);
  if (status === 401 || status === 403) requestSessionCheck(status);
}
