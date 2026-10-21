"use client";
import { useState } from "react";
import { getMe } from "@/shared/api/auth";
import {
  getHttpStatus,
  getRequestErrorMessage,
  invalidResponse,
} from "@/shared/api/errors";
import { uriToBase64 } from "@/shared/media/image-upload";
import { trpc } from "@/shared/api/trpc";
import { useAuth } from "@/domain/session/session-context";
import {
  checkOperationAccessError,
  useSessionOperation,
} from "@/domain/session/use-session-operation";

/** Uploading a photo never sends cached name/gender fields. */
export function useProfileAvatar() {
  const { user, reconcileProfile, confirmProfileUpdate } = useAuth();
  const utils = trpc.useUtils();
  const operation = useSessionOperation();
  const [unknown, setUnknown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upload = async (uri: string): Promise<boolean> => {
    if (!user || unknown) return false;
    const task = operation.begin("upload-profile-photo");
    if (!task) return false;
    setError(null);
    let dispatched = false;
    try {
      const base64 = await uriToBase64(uri);
      task.assertCurrent();
      if (!base64) throw new Error("Не удалось прочитать фото");
      dispatched = true;
      const result = await utils.client.profile.uploadAvatar.mutate(
        { base64, filename: "avatar.jpg", mimeType: "image/jpeg" },
        { signal: task.signal },
      );
      task.assertCurrent();
      if (!result?.url || !/^https?:\/\//.test(result.url))
        throw invalidResponse();
      if (!confirmProfileUpdate(user.id, { avatarUrl: result.url }))
        throw invalidResponse();
      task.assertCurrent();
      void utils.club.comments.invalidate();
      return true;
    } catch (cause) {
      checkOperationAccessError(cause);
      if (task.isCurrent()) {
        const status = getHttpStatus(cause);
        const uncertain = dispatched && (!status || status >= 500);
        setUnknown(uncertain);
        setError(
          uncertain
            ? "Загрузка фото не подтверждена. Черновик сохранён. Проверьте фото в профиле перед повторной загрузкой."
            : getRequestErrorMessage(cause),
        );
      }
      return false;
    } finally {
      task.finish();
    }
  };
  const check = async () => {
    if (!user) return;
    const task = operation.begin("check-profile-photo");
    if (!task) return;
    try {
      const fresh = await getMe(task.signal);
      task.assertCurrent();
      if (!(await reconcileProfile(user.id, fresh))) return;
      task.assertCurrent();
      setUnknown(false);
      setError(
        "Профиль обновлён. Проверьте фото; при необходимости повторите загрузку черновика.",
      );
    } catch (cause) {
      checkOperationAccessError(cause);
      if (task.isCurrent())
        setError(
          "Не удалось проверить фото. Черновик сохранён. Попробуйте проверить ещё раз.",
        );
    } finally {
      task.finish();
    }
  };
  return { upload, check, unknown, error, busy: operation.busy };
}
