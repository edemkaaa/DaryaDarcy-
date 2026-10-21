"use client";
import { useEffect, useRef, useState } from "react";
import AsyncStorage, { isPersonalDataOwner } from "@/shared/browser/storage";
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

/** Explicit profile edits only. An unknown write is reconciled by a fresh read. */
export function useProfileUpdate(recoveryKey: string) {
  const { user, reconcileProfile, confirmProfileUpdate } = useAuth();
  const utils = trpc.useUtils();
  const operation = useSessionOperation();
  const pending = useRef<ProfileInput | null>(null);
  const [unknown, setUnknown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);
  const ownerId = user?.id;
  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(recoveryKey).then((raw) => {
      if (cancelled || !ownerId || !isPersonalDataOwner(ownerId)) return;
      try {
        const value: unknown = raw ? JSON.parse(raw) : null;
        if (value && typeof value === "object") {
          const stored = value as Record<string, unknown>;
          const input: ProfileInput = {};
          if (typeof stored.name === "string" && stored.name.trim())
            input.name = stored.name;
          if (stored.gender === "female" || stored.gender === "male")
            input.gender = stored.gender;
          if (Object.keys(input).length) {
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
    });
    return () => {
      cancelled = true;
    };
  }, [ownerId, recoveryKey]);
  const remember = (input: ProfileInput | null) => {
    pending.current = input;
    setUnknown(input !== null);
    if (!ownerId || !isPersonalDataOwner(ownerId)) return;
    if (input) void AsyncStorage.setItem(recoveryKey, JSON.stringify(input));
    else void AsyncStorage.removeItem(recoveryKey);
  };
  const save = async (input: ProfileInput): Promise<boolean> => {
    if (restoring || pending.current || !user) return false;
    const task = operation.begin("save-profile");
    if (!task) return false;
    setError(null);
    remember(input);
    try {
      const result = await utils.client.profile.update.mutate(input, {
        signal: task.signal,
      });
      task.assertCurrent();
      if (result?.success !== true) throw invalidResponse();
      if (!confirmProfileUpdate(user.id, input)) throw invalidResponse();
      task.assertCurrent();
      remember(null);
      void utils.club.comments.invalidate();
      return true;
    } catch (cause) {
      checkOperationAccessError(cause);
      if (task.isCurrent()) {
        const status = getHttpStatus(cause);
        if (status && status < 500) remember(null);
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
      const saved = Object.entries(input).every(
        ([key, value]) => fresh[key as keyof ProfileInput] === value,
      );
      remember(null);
      setError(
        saved
          ? null
          : "Изменения не найдены на сервере. Проверьте данные и повторите сохранение.",
      );
      if (saved) void utils.club.comments.invalidate();
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
  return { save, check, unknown, error, busy: operation.busy || restoring };
}
