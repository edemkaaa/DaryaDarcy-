"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useClub } from "@/domain/subscription/subscription-context";
import {
  checkOperationAccessError,
  useSessionOperation,
} from "@/domain/session/use-session-operation";
import { requireOk } from "@/shared/api/action-result";
import {
  getHttpStatus,
  getRequestErrorMessage,
  invalidResponse,
} from "@/shared/api/errors";
import { trpc } from "@/shared/api/trpc";
import type { ApiOutputs } from "@/shared/api/types";
import type { ScopedOperation } from "@/shared/browser/operation-scope";

type Notice = { status: "unknown" | "error"; message: string };
const unconfirmed =
  "Отмена ещё не подтверждена. Автосписание может оставаться активным. Проверьте статус; если отмена не подтверждается, обратитесь в поддержку.";

function validExpiration(value: unknown): boolean {
  return (
    value === null ||
    ((value instanceof Date || typeof value === "string") &&
      Number.isFinite(new Date(value).getTime()))
  );
}

function requireSubscription(value: ApiOutputs["club"]["subscription"]) {
  if (
    !value ||
    typeof value.subscribed !== "boolean" ||
    typeof value.cancelAtPeriodEnd !== "boolean" ||
    typeof value.isOwner !== "boolean" ||
    typeof value.monthlyPrice !== "string" ||
    !validExpiration(value.expiresAt) ||
    (value.subscribed && !value.isOwner && value.expiresAt === null)
  )
    throw invalidResponse();
}

/** A timed-out write may already be queued by the server; retry only reads. */
function useCancellationController(active: boolean) {
  const { isSubscribed, isOwner, cancelAtPeriodEnd } = useClub();
  const operation = useSessionOperation(active);
  const utils = trpc.useUtils();
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeRef = useRef(notice);
  useEffect(() => {
    if (cancelAtPeriodEnd) {
      noticeRef.current = null;
      setNotice(null);
    }
  }, [cancelAtPeriodEnd]);
  const remember = (value: Notice | null) => {
    noticeRef.current = value;
    setNotice(value);
  };
  const eligible = isSubscribed && !isOwner && !cancelAtPeriodEnd;

  const readStatus = async (task: ScopedOperation) => {
    // Do not let an older background read overwrite this verification.
    await utils.club.subscription.cancel();
    task.assertCurrent();
    const value = await utils.client.club.subscription.query(undefined, {
      signal: task.signal,
    });
    task.assertCurrent();
    requireSubscription(value);
    await utils.club.subscription.cancel();
    task.assertCurrent();
    utils.club.subscription.setData(undefined, value);
    remember(
      value.cancelAtPeriodEnd
        ? null
        : { status: "unknown", message: unconfirmed },
    );
  };

  const cancel = async () => {
    if (!eligible || noticeRef.current?.status === "unknown" || operation.busy)
      return;
    if (
      !window.confirm(
        "Отменить автосписание? Клуб останется открытым до конца оплаченного периода.",
      )
    )
      return;
    const task = operation.begin("cancel-subscription");
    if (!task) return;
    remember({ status: "unknown", message: unconfirmed });
    let verifying = false;
    try {
      const result = await utils.client.club.cancel.mutate(undefined, {
        signal: task.signal,
      });
      verifying = true;
      task.assertCurrent();
      requireOk(result);
      if (!validExpiration(result.expiresAt)) throw invalidResponse();
      await readStatus(task);
    } catch (cause) {
      checkOperationAccessError(cause);
      if (!task.isCurrent()) return;
      // These middleware refusals happen before the cancellation handler.
      // A BAD_REQUEST from that handler can follow an already stored request.
      if (!verifying && [401, 403, 429].includes(getHttpStatus(cause) ?? 0))
        remember({ status: "error", message: getRequestErrorMessage(cause) });
    } finally {
      task.finish();
    }
  };

  const check = async () => {
    if (!eligible || noticeRef.current?.status !== "unknown") return;
    const task = operation.begin("check-cancellation");
    if (!task) return;
    try {
      await readStatus(task);
    } catch (cause) {
      checkOperationAccessError(cause);
      if (task.isCurrent())
        remember({
          status: "unknown",
          message: `Не удалось проверить отмену. ${unconfirmed}`,
        });
    } finally {
      task.finish();
    }
  };

  return {
    cancel,
    check,
    notice: eligible ? notice : null,
    busy: operation.busy,
    pending: operation.kind,
    blocked: operation.busy || notice?.status === "unknown",
  };
}

const CancellationContext = createContext<ReturnType<
  typeof useCancellationController
> | null>(null);

/** Keep an uncertain write across profile unmounts, inside the account scope. */
export function SubscriptionCancellationProvider({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const value = useCancellationController(active);
  return (
    <CancellationContext.Provider value={value}>
      {children}
    </CancellationContext.Provider>
  );
}

export function useSubscriptionCancellation() {
  const value = useContext(CancellationContext);
  if (!value) throw new Error("Cancellation provider is missing");
  return value;
}
