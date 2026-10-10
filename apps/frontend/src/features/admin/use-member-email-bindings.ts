"use client";
import { useRef, useState } from "react";
import {
  useSessionOperation,
  checkOperationAccessError,
} from "@/domain/session/use-session-operation";
import {
  requestMemberEmailBinding,
  getMemberEmailBinding,
  type MemberEmailBindingStatus,
} from "@/shared/api/member-email-binding";
import { getRequestErrorMessage } from "@/shared/api/errors";

export const memberEmailBindingEnabled =
  process.env.NEXT_PUBLIC_MEMBER_EMAIL_BINDING_ENABLED === "true";
export type BindingResult = {
  requestKey: string;
  email: string;
  phase: "unknown" | "accepted" | "checked";
  message: string;
};
function statusMessage(value: MemberEmailBindingStatus): string {
  if (value.state === "confirmed")
    return "Почта подтверждена. Обновляем данные аккаунта.";
  if (value.state === "expired")
    return "Срок заявки истёк. Почта этой заявкой не привязана.";
  if (value.state === "cancelled")
    return "Заявка отменена. Почта этой заявкой не привязана.";
  if (Date.parse(value.expiresAt) <= Date.now())
    return "Срок подтверждения истёк. Ожидается закрытие заявки сервером.";
  if (value.delivery === "sent")
    return "Почтовый сервер принял письмо. Ожидаем подтверждения адреса участницей; доставка в почтовый ящик не подтверждена.";
  return value.delivery === "queued"
    ? "Письмо в очереди. Почта ещё не привязана."
    : "Доставка недоступна. Почта ещё не привязана; требуется проверка заявки.";
}

/** Above the members tab: closing the draft cannot undo an accepted server intent. */
export function useMemberEmailBindings(
  active: boolean,
  refreshMembers: () => Promise<void>,
) {
  const operation = useSessionOperation(active && memberEmailBindingEnabled);
  const [results, setResults] = useState<Record<number, BindingResult>>({});
  const current = useRef(results);
  const remember = (id: number, result: BindingResult) => {
    current.current = { ...current.current, [id]: result };
    setResults(current.current);
  };
  const run = async (userId: number, email?: string) => {
    const previous = current.current[userId];
    const sending = email !== undefined;
    if (
      (!sending && !previous) ||
      (sending && previous && previous.phase !== "unknown")
    )
      return;
    const task = operation.begin(`email-binding-${userId}`);
    if (!task) return;
    let intent = previous;
    try {
      intent ??= {
        requestKey: crypto.randomUUID(),
        email: email!.trim().toLowerCase(),
        phase: "unknown",
        message:
          "Результат запроса неизвестен. Проверьте заявку; повтор использует тот же ключ.",
      };
      // Capture synchronously before HTTP; never mint another key on timeout or cancellation.
      remember(userId, intent);
      if (sending) {
        const receipt = await requestMemberEmailBinding(
          { userId, email: intent.email, requestKey: intent.requestKey },
          task.signal,
        );
        task.assertCurrent();
        remember(userId, {
          ...intent,
          phase: "accepted",
          message:
            receipt.state === "pending"
              ? "Заявка принята. Почта ещё не привязана; проверьте состояние доставки."
              : "Получен результат прежней заявки. Проверьте её состояние.",
        });
        if (receipt.state === "confirmed") await refreshMembers();
      } else {
        const status = await getMemberEmailBinding(
          { userId, requestKey: intent.requestKey },
          task.signal,
        );
        task.assertCurrent();
        remember(userId, {
          ...intent,
          phase: "checked",
          message: statusMessage(status),
        });
        if (status.state === "confirmed") await refreshMembers();
      }
    } catch (error) {
      checkOperationAccessError(error);
      if (!task.isCurrent() || !intent) return;
      const saved = current.current[userId];
      remember(userId, {
        ...saved,
        message: `${saved.phase === "unknown" ? "Результат запроса неизвестен. " : ""}${getRequestErrorMessage(error)} Проверьте заявку перед дальнейшими действиями.`,
      });
    } finally {
      task.finish();
    }
  };
  return {
    results,
    busy: operation.busy,
    send: (id: number, email: string) => run(id, email),
    inspect: (id: number) => run(id),
  };
}
