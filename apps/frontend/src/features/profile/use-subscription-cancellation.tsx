"use client";
/** После запроса отмены различаем неизвестный результат и подтверждение провайдера; повторная проверка только читает состояние подписки. */
import { TRPCClientError } from "@trpc/client";
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
import { parseClubAccess } from "@/shared/api/club-access";
import type { ScopedOperation } from "@/shared/browser/operation-scope";

type Notice = { status: "unknown" | "error"; message: string };
const unconfirmed =
  "Отмена ещё не подтверждена. Автосписание может оставаться активным. Проверьте статус; если отмена не подтверждается, обратитесь в поддержку.";
const requested =
  "Запрос на отмену сохранён. Провайдер пока не подтвердил отмену. Автосписание может оставаться активным. Проверьте статус позже.";

function validExpiration(value: unknown): boolean {
  return (
    value === null ||
    ((value instanceof Date || typeof value === "string") &&
      Number.isFinite(new Date(value).getTime()))
  );
}

function requireSubscription(value: ApiOutputs["club"]["subscription"]) {
  return parseClubAccess(value);
}

/** A timed-out write may already be queued by the server; retry only reads. */
function useCancellationController(active: boolean) {
  const { isSubscribed, isOwner, cancelAtPeriodEnd, cancellationStatus } =
    useClub();
  const operation = useSessionOperation(active);
  const utils = trpc.useUtils();
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeRef = useRef(notice);
  useEffect(() => {
    if (cancellationStatus === "confirmed") {
      noticeRef.current = null;
      setNotice(null);
    }
  }, [cancellationStatus]);
  const remember = (value: Notice | null) => {
    noticeRef.current = value;
    setNotice(value);
  };
  const serverPending = cancellationStatus === "pending";
  const eligible =
    isSubscribed &&
    !isOwner &&
    !cancelAtPeriodEnd &&
    cancellationStatus === "none";

  const readStatus = async (task: ScopedOperation) => {
    // Do not let an older background read overwrite this verification.
    await utils.club.subscription.cancel();
    task.assertCurrent();
    const value = await utils.client.club.subscription.query(undefined, {
      signal: task.signal,
    });
    task.assertCurrent();
    const subscription = requireSubscription(value);
    await utils.club.subscription.cancel();
    task.assertCurrent();
    utils.club.subscription.setData(undefined, subscription);
    remember(
      subscription.cancellationStatus === "confirmed"
        ? null
        : {
            status: "unknown",
            message:
              subscription.cancellationStatus === "pending"
                ? requested
                : unconfirmed,
          },
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
      if (
        !validExpiration(result.expiresAt) ||
        !["pending", "confirmed"].includes(result.cancellationStatus) ||
        typeof result.message !== "string" ||
        !result.message.trim()
      )
        throw invalidResponse();
      if (result.cancellationStatus === "pending")
        remember({ status: "unknown", message: result.message });
      await readStatus(task);
    } catch (cause) {
      checkOperationAccessError(cause);
      if (!task.isCurrent()) return;
      // club.cancel reserves BAD_REQUEST for a refusal before any write.
      // A proxy's HTTP 400 or a failed status read cannot prove that refusal.
      const refused =
        cause instanceof TRPCClientError &&
        cause.data?.code === "BAD_REQUEST" &&
        cause.data?.httpStatus === 400 &&
        cause.data?.path === "club.cancel";
      if (
        !verifying &&
        (refused || [401, 403, 429].includes(getHttpStatus(cause) ?? 0))
      )
        remember({ status: "error", message: getRequestErrorMessage(cause) });
    } finally {
      task.finish();
    }
  };

  // Проверка результата не отправляет отмену повторно и не принимает ожидание провайдера за завершение.
  const check = async () => {
    if (!serverPending && noticeRef.current?.status !== "unknown") return;
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
    notice:
      cancellationStatus === "confirmed"
        ? null
        : serverPending
          ? { status: "unknown" as const, message: requested }
          : eligible || notice?.status === "unknown"
            ? notice
            : null,
    busy: operation.busy,
    pending: operation.kind,
    blocked: operation.busy || serverPending || notice?.status === "unknown",
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
