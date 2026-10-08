"use client";
import { useRef, useState } from "react";
import {
  checkOperationAccessError,
  useSessionOperation,
} from "@/domain/session/use-session-operation";
import { resendAccessEmail } from "@/shared/api/access-email";
import { getHttpStatus, getRequestErrorMessage } from "@/shared/api/errors";
import type { ApiOutputs } from "@/shared/api/types";

export type AccessEmailMember = ApiOutputs["admin"]["members"][number];
export type AccessEmailResult = {
  status: "queued" | "unknown" | "error";
  message: string;
};

export function canResendAccessEmail(member: AccessEmailMember) {
  return Boolean(
    member.email?.trim() &&
    !member.blockedAt &&
    member.clubExpiresAt &&
    new Date(member.clubExpiresAt).getTime() > Date.now(),
  );
}

/** Kept above the members tab: a fresh list cannot verify email enqueueing. */
export function useAccessEmailResend(active: boolean) {
  const operation = useSessionOperation(active);
  const [results, setResults] = useState<Record<number, AccessEmailResult>>({});
  const resultsRef = useRef(results);
  const remember = (id: number, value: AccessEmailResult) => {
    resultsRef.current = { ...resultsRef.current, [id]: value };
    setResults(resultsRef.current);
  };
  const send = async (member: AccessEmailMember) => {
    if (
      !canResendAccessEmail(member) ||
      (resultsRef.current[member.id] &&
        resultsRef.current[member.id].status !== "error")
    )
      return;
    const task = operation.begin(`access-email-${member.id}`);
    if (!task) return;
    // Cancellation does not undo a request the server has already accepted.
    remember(member.id, {
      status: "unknown",
      message:
        "Постановка письма в очередь не подтверждена. Не повторяйте запрос до проверки получения письма.",
    });
    try {
      await resendAccessEmail(member.id, task.signal);
      task.assertCurrent();
      remember(member.id, {
        status: "queued",
        message:
          "Письмо с доступом поставлено в очередь. Доставка ещё не подтверждена.",
      });
    } catch (cause) {
      checkOperationAccessError(cause);
      if (!task.isCurrent()) return;
      const status = getHttpStatus(cause);
      if (status && status >= 400 && status < 500)
        remember(member.id, {
          status: "error",
          message: getRequestErrorMessage(cause),
        });
    } finally {
      task.finish();
    }
  };
  return {
    results,
    busy: operation.busy,
    pendingId: operation.kind,
    send,
  };
}
