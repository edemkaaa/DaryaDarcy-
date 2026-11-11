"use client";
/** Повтор письма использует durable административную операцию; обновление списка участников не доказывает его постановку в очередь. */
import type { ApiOutputs } from "@/shared/api/types";
import type { AdminActionRecovery } from "./use-admin-action-recovery";

export type AccessEmailMember = ApiOutputs["admin"]["members"][number];
export type AccessEmailResult = {
  status: "queued" | "unknown" | "error";
  message: string;
};

export function canResendAccessEmail(member: AccessEmailMember) {
  // Клиент разрешает письмо только активной незаблокированной участнице с почтой; решение сервера остаётся окончательным.

  return Boolean(
    member.email?.trim() &&
    !member.blockedAt &&
    member.clubExpiresAt &&
    new Date(member.clubExpiresAt).getTime() > Date.now(),
  );
}

/** Kept above the members tab: a fresh list cannot verify email enqueueing. */
export function useAccessEmailResend(recovery: AdminActionRecovery) {
  // Квитанция очереди не равна доставке письма; неподтверждённая команда отображается отдельно от результатов других участниц.

  const results: Record<number, AccessEmailResult> = {};
  for (const receipt of Object.values(recovery.receipts)) {
    if (receipt.kind !== "resendAccessEmail") continue;
    results[receipt.userId] =
      receipt.state === "succeeded"
        ? {
            status: "queued",
            message:
              "Письмо с доступом поставлено в очередь. Доставка ещё не подтверждена.",
          }
        : {
            status: "error",
            message: "Сервер подтвердил отказ в постановке письма в очередь.",
          };
  }
  const intent = recovery.intent;
  if (intent?.kind === "resendAccessEmail" && !intent.outcome) {
    delete results[intent.userId];
    results[intent.userId] = {
      status: "unknown",
      message:
        "Постановка письма в очередь не подтверждена. Проверьте результат сохранённого действия.",
    };
  }
  return {
    results,
    busy: recovery.busy,
    pendingId:
      recovery.busy && intent?.kind === "resendAccessEmail"
        ? `access-email-${intent.userId}`
        : null,
    send: async (member: AccessEmailMember) => {
      // Начинает письмо через общий журнал только при действующем доступе, отсутствии другой команды и завершённой задержке.

      if (
        !canResendAccessEmail(member) ||
        recovery.blocked ||
        recovery.cooldown
      )
        return;
      await recovery.start("resendAccessEmail", member.id);
    },
  };
}
