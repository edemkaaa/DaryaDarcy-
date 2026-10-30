"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { AdminActionKind, AdminActionOutcome } from "@shared/admin-action";
import { useAuth } from "@/domain/session/session-context";
import { checkOperationAccessError } from "@/domain/session/use-session-operation";
import {
  AdminActionJournal,
  AdminActionJournalError,
  adminActionStorageKey,
  type AdminActionIntent,
} from "@/domain/session/admin-action-journal";
import { OperationScope } from "@/shared/browser/operation-scope";
import { isPersonalDataOwner } from "@/shared/browser/storage";
import { getSessionRequestSignal } from "@/shared/api/request-lifecycle";
import { adminActionApi } from "@/shared/api/admin-actions";
import { getRequestErrorMessage } from "@/shared/api/errors";
import { trpc } from "@/shared/api/trpc";

type State = {
  ownerId: number;
  loaded: boolean;
  intent: AdminActionIntent | null;
  confirmedKey?: string;
  error: string | null;
  receipts: Record<string, AdminActionOutcome>;
};
export const adminReceiptKey = (kind: AdminActionKind, userId: number) =>
  `${kind}:${userId}`;

export function useAdminActionRecovery(
  active: boolean,
  onConfirmed: (
    result: AdminActionOutcome,
    signal: AbortSignal,
  ) => Promise<void>,
) {
  const { user, isAuthenticated, loading, error, refreshError } = useAuth();
  const ownerId = user?.id;
  const ready =
    active &&
    isAuthenticated &&
    !!ownerId &&
    !loading &&
    !error &&
    !refreshError &&
    user?.role === "admin";
  const utils = trpc.useUtils();
  const [scope] = useState(() => new OperationScope());
  const operation = useSyncExternalStore(
    scope.subscribe,
    scope.getSnapshot,
    () => null,
  );
  const [state, setState] = useState<State | null>(null);
  const known = useRef<{
    ownerId: number;
    intent: AdminActionIntent | null;
    confirmedKey?: string;
  } | null>(null);
  const confirmedCallback = useRef(onConfirmed);
  useEffect(() => {
    confirmedCallback.current = onConfirmed;
  }, [onConfirmed]);
  useEffect(() => () => scope.cancel(), [scope, ready, ownerId]);

  const run = useCallback(
    async (
      mode: "check" | "start" | "replay",
      request?: { kind: AdminActionKind; userId: number },
    ) => {
      if (!ready || !ownerId) return;
      const task = scope.begin(mode, getSessionRequestSignal(), () =>
        isPersonalDataOwner(ownerId),
      );
      if (!task) return;
      const prior = known.current?.ownerId === ownerId ? known.current : null;
      const journal = new AdminActionJournal(
        ownerId,
        adminActionApi(utils.client),
        (intent) => {
          task.assertCurrent();
          known.current = { ownerId, intent };
          setState((old) => ({
            ownerId,
            loaded: true,
            intent,
            error: null,
            receipts: old?.ownerId === ownerId ? old.receipts : {},
          }));
        },
      );
      setState((old) =>
        old?.ownerId === ownerId
          ? { ...old, error: null }
          : { ownerId, loaded: false, intent: null, error: null, receipts: {} },
      );
      try {
        const intent =
          mode === "start" && request
            ? await journal.start(
                request.kind,
                request.userId,
                prior?.intent ?? null,
                prior?.confirmedKey,
                task.signal,
              )
            : mode === "replay" && prior?.intent
              ? await journal.replay(prior.intent, task.signal)
              : await journal.check(prior?.intent ?? null, task.signal);
        task.assertCurrent();
        known.current = {
          ownerId,
          intent,
          ...(intent?.outcome ? { confirmedKey: intent.idempotencyKey } : {}),
        };
        setState((old) => {
          const receipts = {
            ...(old?.ownerId === ownerId ? old.receipts : {}),
          };
          if (intent?.outcome)
            receipts[adminReceiptKey(intent.kind, intent.userId)] =
              intent.outcome;
          return {
            ownerId,
            intent,
            loaded: true,
            error: null,
            confirmedKey: intent?.outcome ? intent.idempotencyKey : undefined,
            receipts: Object.fromEntries(Object.entries(receipts).slice(-64)),
          };
        });
        if (intent?.outcome) {
          await confirmedCallback.current(intent.outcome, task.signal);
          task.assertCurrent();
        }
      } catch (cause) {
        checkOperationAccessError(cause);
        if (!task.isCurrent()) return;
        const message =
          cause instanceof AdminActionJournalError
            ? cause.message
            : getRequestErrorMessage(cause);
        setState((old) =>
          old?.ownerId === ownerId
            ? { ...old, loaded: true, error: message }
            : {
                ownerId,
                loaded: true,
                intent: prior?.intent ?? null,
                error: message,
                receipts: {},
              },
        );
      } finally {
        task.finish();
      }
    },
    [ready, ownerId, scope, utils.client],
  );

  useEffect(() => {
    if (!ready || !ownerId) return;
    let live = true;
    queueMicrotask(() => {
      if (live) void run("check");
    });
    const changed = (event: StorageEvent) => {
      if (event.key === adminActionStorageKey(ownerId) || event.key === null)
        void run("check");
    };
    window.addEventListener("storage", changed);
    return () => {
      live = false;
      window.removeEventListener("storage", changed);
    };
  }, [ready, ownerId, run]);

  const current = state?.ownerId === ownerId ? state : null;
  const [now, setNow] = useState(() => Date.now());
  const retryAt =
    current?.intent?.kind === "resendAccessEmail"
      ? current.intent.retryAt
      : undefined;
  useEffect(() => {
    if (!retryAt || retryAt <= now) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(0, Math.min(2_147_483_647, retryAt - Date.now())),
    );
    return () => clearTimeout(timer);
  }, [retryAt, now]);
  const cooldown = Boolean(retryAt && retryAt > now);
  const busy = operation !== null;
  return {
    intent: current?.intent ?? null,
    error: current?.error ?? null,
    receipts: current?.receipts ?? {},
    busy,
    cooldown,
    active: ready,
    blocked:
      !ready ||
      !current?.loaded ||
      busy ||
      Boolean(current.intent && !current.confirmedKey) ||
      Boolean(current.error && !current.confirmedKey),
    checking: operation === "check",
    check: () => run("check"),
    replay: () => run("replay"),
    start: (kind: AdminActionKind, userId: number) =>
      run("start", { kind, userId }),
  };
}
export type AdminActionRecovery = ReturnType<typeof useAdminActionRecovery>;
