"use client";
/** Загрузка и привязка аватара имеют раздельные подтверждения; возвращённый результат применяется только к своему аккаунту. */
import { useEffect, useState } from "react";
import { getMe } from "@/shared/api/auth";
import {
  getHttpStatus,
  getRequestErrorMessage,
  invalidResponse,
} from "@/shared/api/errors";
import { uriToPhotoUpload } from "@/shared/media/image-upload";
import { MAX_AVATAR_SOURCE_BYTES } from "@/shared/browser/file-operations";
import type { ScopedOperation } from "@/shared/browser/operation-scope";
import { trpc } from "@/shared/api/trpc";
import { useAuth } from "@/domain/session/session-context";
import {
  checkOperationAccessError,
  useSessionOperation,
} from "@/domain/session/use-session-operation";
import {
  avatarIntentUri,
  readAvatarIntent,
  saveAvatarIntent,
  removeAvatarIntent,
  requireAvatarReceipt,
  CorruptAvatarIntentError,
  discardCorruptAvatarIntent,
  type AvatarUploadIntent,
} from "./avatar-upload-journal";

const uncertainMessage =
  "Загрузка фото не подтверждена. Проверьте её перед повторной загрузкой.";
const storageMessage =
  "Не удалось сохранить или прочитать фото на устройстве. Не закрывайте страницу.";
type State = {
  ownerId: number;
  intent: AvatarUploadIntent | null;
  draft: string | null;
  unknown: boolean;
  error: string | null;
  canRetry: boolean;
  corrupt: CorruptAvatarIntentError | null;
};

/** Разделяем подготовку, загрузку и факт применения аватара; каждый поздний результат проверяет владельца и scope. Повтор сначала читает квитанцию и использует исходные байты с тем же ключом. */
export function useProfileAvatar() {
  const { user, reconcileProfile, confirmProfileUpdate } = useAuth();
  const ownerId = user?.id;
  const utils = trpc.useUtils();
  const operation = useSessionOperation();
  const [state, setState] = useState<State | null>(null);
  const current = state?.ownerId === ownerId ? state : null;
  useEffect(() => {
    // Восстановление ждёт установки владельца сессии; cleanup не даёт старому microtask показать черновик другого аккаунта.
    let active = true;
    // Wait until the authenticated owner has been installed by the session.
    void Promise.resolve().then(() => {
      if (!active || !ownerId) return;
      try {
        const intent = readAvatarIntent(ownerId);
        setState({
          ownerId,
          intent,
          draft: intent ? avatarIntentUri(intent) : null,
          unknown: !!intent,
          error: intent ? uncertainMessage : null,
          canRetry: false,
          corrupt: null,
        });
      } catch (cause) {
        setState({
          ownerId,
          intent: null,
          draft: null,
          unknown: true,
          error:
            cause instanceof CorruptAvatarIntentError
              ? cause.message
              : storageMessage,
          canRetry: false,
          corrupt: cause instanceof CorruptAvatarIntentError ? cause : null,
        });
      }
    });
    return () => {
      active = false;
    };
  }, [ownerId]);

  /** Готовая квитанция может уже не быть текущей: тогда читаем профиль вместо перезаписи более нового аватара; журнал удаляем после подтверждения. */
  const complete = async (
    intent: AvatarUploadIntent,
    value: unknown,
    task: ScopedOperation,
  ) => {
    const receipt = requireAvatarReceipt(value);
    task.assertCurrent();
    if (receipt.state !== "ready") {
      setState({
        ownerId: intent.ownerId,
        intent,
        draft: avatarIntentUri(intent),
        unknown: false,
        canRetry: true,
        corrupt: null,
        error:
          "Фото ещё не подтверждено. Можно повторить загрузку сохранённого черновика.",
      });
      return false;
    }
    if (receipt.isCurrent) {
      if (!confirmProfileUpdate(intent.ownerId, { avatarUrl: receipt.url }))
        throw invalidResponse();
    } else {
      // The upload must not replace a newer avatar, even if it once applied.
      const fresh = await getMe(task.signal);
      task.assertCurrent();
      if (!(await reconcileProfile(intent.ownerId, fresh))) return false;
    }
    task.assertCurrent();
    removeAvatarIntent(intent);
    setState({
      ownerId: intent.ownerId,
      intent: null,
      draft: null,
      unknown: false,
      error: null,
      canRetry: false,
      corrupt: null,
    });
    void utils.club.comments.invalidate();
    void utils.club.commentsPage.invalidate();
    return true;
  };

  /** Отличаем терминальный 409 от неизвестного исхода; сбой durable-cleanup сохраняет блокировку восстановления. */
  const failed = (
    cause: unknown,
    task: ScopedOperation,
    intent: AvatarUploadIntent | null,
  ) => {
    checkOperationAccessError(cause);
    if (!task.isCurrent()) return;
    const status = getHttpStatus(cause);
    // A conflict is terminal, not an instruction to retry with a new key.
    if (status === 409 && intent) {
      try {
        removeAvatarIntent(intent);
        setState({
          ownerId: intent.ownerId,
          intent: null,
          draft: avatarIntentUri(intent),
          unknown: false,
          canRetry: false,
          corrupt: null,
          error: "Эту загрузку нельзя продолжить. Выберите фото заново.",
        });
        return;
      } catch {
        /* Keep recovery locked if durable cleanup failed. */
      }
    }
    setState(
      (previous) =>
        previous && {
          ...previous,
          intent,
          unknown: true,
          canRetry: false,
          error:
            cause instanceof CorruptAvatarIntentError
              ? cause.message
              : intent
                ? !status || status >= 500
                  ? uncertainMessage
                  : getRequestErrorMessage(cause)
                : storageMessage,
          corrupt:
            cause instanceof CorruptAvatarIntentError
              ? cause
              : previous.corrupt,
        },
    );
  };

  /** Сначала проверяем чужое намерение вкладки и сохраняем точные байты; повтор использует прежний key и читающий status. */
  const upload = async (uri: string): Promise<boolean> => {
    if (!ownerId || !current || current.unknown) return false;
    const task = operation.begin("upload-profile-photo");
    if (!task) return false;
    let intent = current.intent;
    setState({ ...current, draft: uri, error: null, canRetry: false });
    try {
      // Also detect a pending upload created in another tab before replacing it.
      const saved = readAvatarIntent(ownerId);
      if (saved && saved.idempotencyKey !== intent?.idempotencyKey) {
        setState({
          ownerId,
          intent: saved,
          draft: avatarIntentUri(saved),
          unknown: true,
          error: uncertainMessage,
          canRetry: false,
          corrupt: null,
        });
        return false;
      }
      if (intent) {
        saveAvatarIntent(intent);
        const status = await utils.client.profile.avatarUploadStatus.query(
          { idempotencyKey: intent.idempotencyKey },
          { signal: task.signal },
        );
        task.assertCurrent();
        if (requireAvatarReceipt(status).state === "ready")
          return await complete(intent, status, task);
      } else {
        const { base64, mimeType } = await uriToPhotoUpload(uri, {
          maxInputBytes: MAX_AVATAR_SOURCE_BYTES,
          signal: task.signal,
        });
        task.assertCurrent();
        const prepared: AvatarUploadIntent = {
          version: 1,
          ownerId,
          base64,
          filename:
            mimeType === "image/png"
              ? "avatar.png"
              : mimeType === "image/webp"
                ? "avatar.webp"
                : "avatar.jpg",
          mimeType,
          idempotencyKey: crypto.randomUUID(),
        };
        saveAvatarIntent(prepared);
        intent = prepared;
        setState({
          ownerId,
          intent,
          draft: avatarIntentUri(intent),
          unknown: true,
          error: null,
          canRetry: false,
          corrupt: null,
        });
      }
      task.assertCurrent();
      const { base64, filename, mimeType, idempotencyKey } = intent;
      const result = await utils.client.profile.uploadAvatarWithReceipt.mutate(
        { base64, filename, mimeType, idempotencyKey },
        { signal: task.signal },
      );
      return await complete(intent, result, task);
    } catch (cause) {
      failed(cause, task, intent);
      return false;
    } finally {
      task.finish();
    }
  };

  /** Проверяем статус сохранённого намерения без отправки новых байтов; отсутствие журнала позволяет повторить только оставшийся локальный черновик. */
  const check = async () => {
    if (!ownerId || !current) return;
    const task = operation.begin("check-profile-photo");
    if (!task) return;
    let intent = current.intent;
    try {
      intent = readAvatarIntent(ownerId) ?? intent;
      if (!intent) {
        setState({
          ...current,
          intent: null,
          unknown: false,
          corrupt: null,
          canRetry: !!current.draft,
          error: current.draft
            ? "Черновик не отправлен. Повторите загрузку фото."
            : null,
        });
        return;
      }
      const result = await utils.client.profile.avatarUploadStatus.query(
        { idempotencyKey: intent.idempotencyKey },
        { signal: task.signal },
      );
      await complete(intent, result, task);
    } catch (cause) {
      failed(cause, task, intent);
    } finally {
      task.finish();
    }
  };
  /** До удаления повреждённого журнала проверяем известные ключи и актуальный профиль; pending запрещает сброс. */
  const resetCorrupt = async () => {
    if (!ownerId || !current?.corrupt) return;
    const task = operation.begin("reset-corrupt-profile-photo");
    if (!task) return;
    try {
      const keys = new Set([
        current.corrupt.idempotencyKey,
        current.intent?.idempotencyKey,
      ]);
      for (const key of keys) {
        if (!key) continue;
        const receipt = requireAvatarReceipt(
          await utils.client.profile.avatarUploadStatus.query(
            { idempotencyKey: key },
            { signal: task.signal },
          ),
        );
        task.assertCurrent();
        if (receipt.state === "pending")
          throw new Error(
            "Предыдущая загрузка фото ещё обрабатывается. Повторите проверку позже.",
          );
      }
      const fresh = await getMe(task.signal);
      task.assertCurrent();
      if (!(await reconcileProfile(ownerId, fresh))) return;
      task.assertCurrent();
      discardCorruptAvatarIntent(current.corrupt);
      setState({
        ownerId,
        intent: null,
        draft: null,
        unknown: false,
        error: null,
        canRetry: false,
        corrupt: null,
      });
    } catch (cause) {
      checkOperationAccessError(cause);
      if (task.isCurrent())
        setState(
          (previous) =>
            previous && {
              ...previous,
              error: cause instanceof Error ? cause.message : storageMessage,
            },
        );
    } finally {
      task.finish();
    }
  };
  return {
    upload,
    check,
    resetCorrupt,
    corrupt: current?.corrupt ?? null,
    draft: current?.draft ?? null,
    error: current?.error ?? null,
    unknown: current?.unknown ?? true,
    canRetry: current?.canRetry ?? false,
    busy: operation.busy,
    canChoose: !!current && !current.unknown && !current.intent,
  };
}
