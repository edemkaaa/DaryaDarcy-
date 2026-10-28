"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  PROFILE_NAME_DRAFT_KEY,
  profileSnapshot,
  restoreProfileDraft,
  type ProfileDraft,
  type ProfileDraftValues,
  type ProfileInput,
} from "./profile-draft";

type PendingProfile = ProfileInput & { expectedRevision?: number };

/** Explicit profile edits only. An unknown write is reconciled by a fresh read. */
export function useProfileUpdate(recoveryKey: string, draftKey: string) {
  const { user, reconcileProfile, confirmProfileUpdate } = useAuth();
  const utils = trpc.useUtils();
  const operation = useSessionOperation();
  const pending = useRef<PendingProfile | null>(null);
  const draft = useRef<ProfileDraft | null>(null);
  const [draftState, setDraftState] = useState<ProfileDraft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [unknown, setUnknown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [storageError, setStorageError] = useState(false);
  const ownerId = user?.id;
  const writeDraft = useCallback(
    (value: ProfileDraft) => {
      if (!ownerId || !isPersonalDataOwner(ownerId))
        throw new Error("Аккаунт изменился");
      // Keep the in-memory input even if durable storage is unavailable.
      draft.current = value;
      setDraftState(value);
      const encoded = JSON.stringify(value);
      requiredStorage.setItem(draftKey, encoded);
      if (requiredStorage.getItem(draftKey) !== encoded)
        throw new Error("Черновик не сохранён");
      setDraftError(null);
    },
    [ownerId, draftKey],
  );
  const clearDraft = () => {
    if (!ownerId || !isPersonalDataOwner(ownerId)) return;
    // A successful older operation must not delete a different tab's draft.
    if (requiredStorage.getItem(draftKey) === JSON.stringify(draft.current))
      requiredStorage.removeItem(draftKey);
    draft.current = null;
    setDraftState(null);
    setDraftError(null);
  };
  const beginEdit = (
    defaults: ProfileDraftValues,
    legacyInput = false,
  ): ProfileDraftValues | null => {
    if (!user || !isPersonalDataOwner(user.id)) return null;
    try {
      const raw = requiredStorage.getItem(draftKey);
      const restored = restoreProfileDraft(
        raw ?? (legacyInput ? JSON.stringify(defaults) : null),
        user.id,
        profileSnapshot(user),
        defaults,
        draftKey === PROFILE_NAME_DRAFT_KEY,
      );
      // An in-memory draft also survives closing/reopening after a storage error.
      const value = draft.current ?? restored;
      draft.current = value;
      setDraftState(value);
      if (value.needsReview)
        setError(
          "Сверьте сохранённый ввод с актуальным профилем перед сохранением.",
        );
      return { ...value.values, ...pending.current };
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось прочитать черновик.",
      );
      return null;
    }
  };
  const storeDraft = useCallback(
    (input: ProfileDraftValues) => {
      if (!draft.current) return;
      try {
        writeDraft({
          ...draft.current,
          values: { ...draft.current.values, ...input },
        });
      } catch {
        setDraftError(
          draftKey === PROFILE_NAME_DRAFT_KEY
            ? "Черновик имени не сохранён на устройстве. Не закрывайте страницу до сохранения имени."
            : "Черновик профиля не сохранён на устройстве. Не закрывайте страницу до сохранения профиля.",
        );
      }
    },
    [draftKey, writeDraft],
  );
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
    if (input) {
      const encoded = JSON.stringify(input);
      requiredStorage.setItem(recoveryKey, encoded);
      if (requiredStorage.getItem(recoveryKey) !== encoded)
        throw new Error("Ввод не сохранён");
    } else requiredStorage.removeItem(recoveryKey);
    pending.current = input;
    setUnknown(input !== null);
  };
  const save = async (input: ProfileInput): Promise<boolean> => {
    if (restoring || storageError || pending.current || !user) return false;
    if (!draft.current || draft.current.needsReview) {
      setError(
        "Сверьте сохранённый ввод с актуальным профилем перед сохранением.",
      );
      return false;
    }
    const expectedRevision = draft.current.base.revision;
    if (expectedRevision === null) {
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
        writeDraft({
          ...draft.current,
          values: { ...draft.current.values, ...input },
        });
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
      clearDraft();
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
    if (!user || (!input && !draft.current)) return false;
    const task = operation.begin("check-profile");
    if (!task) return false;
    try {
      const fresh = await getMe(task.signal);
      task.assertCurrent();
      if (!(await reconcileProfile(user.id, fresh)) || !fresh) return false;
      task.assertCurrent();
      const saved =
        !!input &&
        Object.entries(input).every(
          ([key, value]) =>
            key === "expectedRevision" ||
            fresh[key as keyof ProfileInput] === value,
        ) &&
        (input.expectedRevision === undefined ||
          (fresh.profileRevision !== undefined &&
            fresh.profileRevision > input.expectedRevision));
      if (fresh.profileRevision === undefined) throw invalidResponse();
      if (saved) clearDraft();
      else {
        const currentDraft =
          draft.current ??
          restoreProfileDraft(
            requiredStorage.getItem(draftKey),
            user.id,
            profileSnapshot(user),
            input ?? {},
            draftKey === PROFILE_NAME_DRAFT_KEY,
          );
        // Persist the review BEFORE retiring the pending operation. Reload must
        // retain the conflict and must never silently rebase the user's input.
        writeDraft({
          ...currentDraft,
          values: {
            ...currentDraft.values,
            ...(input
              ? {
                  name: input.name ?? currentDraft.values.name,
                  gender: input.gender ?? currentDraft.values.gender,
                }
              : {}),
          },
          needsReview: true,
          review: profileSnapshot(fresh),
        });
      }
      remember(null);
      setError(
        saved
          ? null
          : !input
            ? "Сравните актуальные данные с вашим вводом и подтвердите использование черновика."
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
    beginEdit,
    storeDraft,
    draftError,
    needsReview: draftState?.needsReview ?? false,
    review: draftState?.review,
    acceptReview: () => {
      const current = draft.current;
      if (
        !current?.review ||
        current.review.revision === null ||
        pending.current
      )
        return;
      try {
        writeDraft({
          ...current,
          base: current.review,
          review: undefined,
          needsReview: false,
        });
        setError(null);
      } catch {
        // Saving stays blocked until the reviewed baseline is durable.
        draft.current = current;
        setDraftState(current);
        setDraftError(
          "Не удалось сохранить сверенный черновик. Повторите после восстановления хранилища.",
        );
      }
    },
    save,
    check,
    unknown,
    pendingInput: pending.current,
    error,
    busy: operation.busy || restoring || storageError,
  };
}
