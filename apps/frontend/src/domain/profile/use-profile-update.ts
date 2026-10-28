"use client";
import { useEffect, useRef, useState } from "react";
import { isPersonalDataOwner, requiredStorage } from "@/shared/browser/storage";
import { getMe } from "@/shared/api/auth";
import {
  getHttpStatus,
  getRequestErrorMessage,
  invalidResponse,
} from "@/shared/api/errors";
import { trpc } from "@/shared/api/trpc";
import { useAuth } from "@/domain/session/session-context";
import {
  checkOperationAccessError,
  useSessionOperation,
} from "@/domain/session/use-session-operation";

type ProfileInput = { name?: string; gender?: "female" | "male" };
type PendingProfile = ProfileInput & { expectedRevision?: number };

/** Explicit profile edits only. An unknown write is reconciled by a fresh read. */
export function useProfileUpdate(recoveryKey: string) {
  const { user, reconcileProfile, confirmProfileUpdate } = useAuth();
  const utils = trpc.useUtils();
  const operation = useSessionOperation();
  const pending = useRef<PendingProfile | null>(null);
  const editingRevision = useRef<number | undefined>(undefined);
  const [unknown, setUnknown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [storageError, setStorageError] = useState(false);
  const ownerId = user?.id;
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve()
      .then(() => requiredStorage.getItem(recoveryKey))
      .then((raw) => {
        if (cancelled || !ownerId || !isPersonalDataOwner(ownerId)) return;
        try {
          const value: unknown = raw ? JSON.parse(raw) : null;
          if (value && typeof value === "object") {
            const stored = value as Record<string, unknown>;
            const input: PendingProfile = {};
            if (typeof stored.name === "string" && stored.name.trim())
              input.name = stored.name;
            if (stored.gender === "female" || stored.gender === "male")
              input.gender = stored.gender;
            if (Object.keys(input).length) {
              if (
                Number.isSafeInteger(stored.expectedRevision) &&
                Number(stored.expectedRevision) >= 0
              )
                input.expectedRevision = Number(stored.expectedRevision);
              pending.current = input;
              setUnknown(true);
              setError(
                "Сохранение прервалось. Ваш ввод сохранён. Проверьте результат перед новой попыткой.",
              );
            }
          }
        } catch {
          /* Keep an invalid optional recovery record out of writes. */
        }
        setRestoring(false);
        setStorageError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setStorageError(true);
        setRestoring(false);
        setError(
          "Не удалось прочитать сохранённый ввод. Разрешите хранение данных сайта и перезагрузите страницу.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [ownerId, recoveryKey]);
  const remember = (input: PendingProfile | null) => {
    if (!ownerId || !isPersonalDataOwner(ownerId))
      throw new Error("Аккаунт изменился");
    if (input) requiredStorage.setItem(recoveryKey, JSON.stringify(input));
    else requiredStorage.removeItem(recoveryKey);
    pending.current = input;
    setUnknown(input !== null);
  };
  const save = async (input: ProfileInput): Promise<boolean> => {
    if (restoring || storageError || pending.current || !user) return false;
    const expectedRevision = editingRevision.current;
    if (expectedRevision === undefined) {
      setError(
        "Версия профиля недоступна. Обновите страницу перед сохранением.",
      );
      return false;
    }
    const task = operation.begin("save-profile");
    if (!task) return false;
    setError(null);
    try {
      try {
        remember({ ...input, expectedRevision });
      } catch {
        setError(
          "Не удалось сохранить ввод на устройстве. Запрос не отправлен. Не закрывайте страницу; разрешите хранение данных сайта и повторите сохранение.",
        );
        return false;
      }
      const result = await utils.client.profile.update.mutate(
        { ...input, expectedRevision },
        {
          signal: task.signal,
        },
      );
      task.assertCurrent();
      if (
        result?.success !== true ||
        result.profileRevision !== expectedRevision + 1
      )
        throw invalidResponse();
      if (
        !confirmProfileUpdate(user.id, {
          ...input,
          profileRevision: result.profileRevision,
        })
      )
        throw invalidResponse();
      task.assertCurrent();
      editingRevision.current = result.profileRevision;
      remember(null);
      void utils.club.comments.invalidate();
      void utils.club.commentsPage.invalidate();
      return true;
    } catch (cause) {
      checkOperationAccessError(cause);
      if (task.isCurrent()) {
        const status = getHttpStatus(cause);
        if (status && status < 500 && status !== 409) {
          try {
            remember(null);
          } catch {
            /* Keep the durable recovery record. */
          }
        }
        setError(
          pending.current
            ? "Результат сохранения не подтверждён. Ваш ввод сохранён. Проверьте сохранение перед новой попыткой."
            : getRequestErrorMessage(cause),
        );
      }
      return false;
    } finally {
      task.finish();
    }
  };
  const check = async (): Promise<boolean> => {
    const input = pending.current;
    if (!input || !user) return false;
    const task = operation.begin("check-profile");
    if (!task) return false;
    try {
      const fresh = await getMe(task.signal);
      task.assertCurrent();
      if (!(await reconcileProfile(user.id, fresh)) || !fresh) return false;
      task.assertCurrent();
      const saved =
        Object.entries(input).every(
          ([key, value]) =>
            key === "expectedRevision" ||
            fresh[key as keyof ProfileInput] === value,
        ) &&
        (input.expectedRevision === undefined ||
          (fresh.profileRevision !== undefined &&
            fresh.profileRevision > input.expectedRevision));
      if (fresh.profileRevision === undefined) throw invalidResponse();
      editingRevision.current = fresh.profileRevision;
      remember(null);
      setError(
        saved
          ? null
          : input.expectedRevision !== undefined &&
              fresh.profileRevision > input.expectedRevision
            ? "Профиль уже изменён. Ваш ввод сохранён; проверьте его и сохраните явно, если хотите заменить актуальные данные."
            : "Предыдущий запрос мог ещё выполняться. Ваш ввод сохранён; повторное сохранение защищено проверкой версии профиля.",
      );
      if (saved) void utils.club.comments.invalidate();
      if (saved) void utils.club.commentsPage.invalidate();
      return saved;
    } catch (cause) {
      checkOperationAccessError(cause);
      if (task.isCurrent())
        setError(
          "Не удалось проверить сохранение. Ваш ввод сохранён. Попробуйте проверить ещё раз.",
        );
      return false;
    } finally {
      task.finish();
    }
  };
  return {
    beginEdit: () => {
      if (!pending.current) editingRevision.current = user?.profileRevision;
    },
    save,
    check,
    unknown,
    pendingInput: pending.current,
    error,
    busy: operation.busy || restoring || storageError,
  };
}
