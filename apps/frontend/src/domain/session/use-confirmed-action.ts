"use client";
/** У действия есть отдельное состояние неподтверждённого результата: чтение списка помогает проверить запись, но само по себе не повторяет её. */
import { useRef, useState } from "react";
import { getHttpStatus, getRequestErrorMessage } from "@/shared/api/errors";
import {
  checkOperationAccessError,
  useSessionOperation,
} from "./use-session-operation";

type UnknownAction = {
  label: string;
  read: (signal: AbortSignal) => Promise<void>;
  keepBlocked: boolean;
};

/** Сериализуем запись в пределах сессии и экрана; неизвестный исход блокирует следующую команду до отдельного чтения или явного отказа. */
export function useConfirmedAction(
  active = true,
  scopeKey: string | number | null = null,
) {
  const operation = useSessionOperation(active, scopeKey);
  const unknownRef = useRef<UnknownAction | null>(null);
  const [unknown, setUnknown] = useState<UnknownAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Синхронный ref закрывает окно повторного клика до render, state отображает тот же запрет в интерфейсе. */
  const remember = (value: UnknownAction | null) => {
    unknownRef.current = value;
    setUnknown(value);
  };
  /** Запоминаем неопределённость до отправки, проверяем ACK перед commit; временный сбой не превращаем в разрешение слепого повтора. */
  const run = async <T>({
    kind,
    label,
    perform,
    validate,
    commit,
    read,
    keepBlocked = false,
  }: {
    kind: string;
    label: string;
    perform: (signal: AbortSignal) => Promise<T>;
    validate: (result: T) => void;
    commit: (result: T) => void;
    read: (signal: AbortSignal) => Promise<void>;
    keepBlocked?: boolean;
  }) => {
    if (unknownRef.current) return;
    const task = operation.begin(kind);
    if (!task) return;
    setError(null);
    let confirmed = false;
    // Cancellation cannot undo a dispatched request; retain this guard on return.
    // Ставим запрет до отправки: отмена браузерного ожидания не откатывает уже принятую сервером запись.
    remember({ label, read, keepBlocked });
    try {
      const result = await perform(task.signal);
      task.assertCurrent();
      validate(result);
      confirmed = true;
      remember(null);
      commit(result);
    } catch (cause) {
      checkOperationAccessError(cause);
      if (!task.isCurrent()) return;
      const status = getHttpStatus(cause);
      if (!confirmed && (!status || status >= 500)) {
        remember({ label, read, keepBlocked });
        setError(
          `Результат действия «${label}» не подтверждён. Обновите список и проверьте результат перед новой попыткой.`,
        );
      } else {
        remember(null);
        setError(getRequestErrorMessage(cause));
      }
    } finally {
      task.finish();
    }
  };
  /** Проверяем список читающим запросом, не повторяя команду; keepBlocked сохраняет запрет для неидемпотентной отправки. */
  const check = async () => {
    const pending = unknownRef.current;
    if (!pending) return;
    const task = operation.begin("check");
    if (!task) return;
    try {
      await pending.read(task.signal);
      task.assertCurrent();
      // Для неидемпотентной отправки чтение списка не доказывает отсутствие записи: решение остаётся явным.
      if (!pending.keepBlocked) remember(null);
      setError(
        pending.keepBlocked
          ? "Список обновлён. Проверьте, появился ли комментарий. Чтобы начать новый, откажитесь от неподтверждённой отправки."
          : "Список обновлён. Проверьте результат предыдущего действия.",
      );
    } catch (cause) {
      checkOperationAccessError(cause);
      if (task.isCurrent()) setError(getRequestErrorMessage(cause));
    } finally {
      task.finish();
    }
  };
  return {
    operation,
    error,
    setError,
    unknown,
    blocked: operation.busy || unknown !== null,
    run,
    check,
    /** Явно снимаем неподтверждённое намерение только вне выполняющейся операции; уже отправленную запись это не откатывает. */
    discard: () => {
      if (operation.busy) return;
      remember(null);
      setError(null);
    },
  };
}
