"use client";
/** Выбранные фото и журнал отправки принадлежат одной ветке; восстановление использует сохранённые исходники и прежний ключ. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/domain/session/session-context";
import { PrivateCommentJournal } from "@/domain/post/private-comment-journal";
import {
  preparePrivateComment,
  prepareTextComment,
  savePrivateComment,
  type PrivateCommentPhoto,
  type PrivateCommentRecord,
} from "@/domain/post/private-comment-save";
import type { ApiInputs } from "@/shared/api/types";
import { trpc } from "@/shared/api/trpc";
import {
  getAppCapabilities,
  requirePrivateUpload,
} from "@/shared/api/capabilities";
import { ApiError } from "@/shared/api/errors";
import type { ScopedOperation } from "@/shared/browser/operation-scope";
import { fileForPhotoUpload, pickWebFiles } from "@/shared/media/image-upload";
import { checkPrivateUploadAvailability } from "@/shared/media/private-upload-availability";
import {
  commentPhotoReference as reference,
  syncCommentPhotoPreviews,
  releaseCommentPhotoPreviews,
  type CommentPhotoPreviews,
} from "./comment-photo-previews";

/** Владеем выбранными файлами, object URL и durable journal одного аккаунта/поста; повтор отправки использует прежний текст, исходники и ключ. */
export function usePrivateCommentFiles(
  enabled: boolean,
  postId: number,
  refreshComments: (task: ScopedOperation, parentId?: number) => Promise<void>,
) {
  const { user } = useAuth(),
    utils = trpc.useUtils();
  const journal = useMemo(
    () => new PrivateCommentJournal(user?.id ?? 0, postId),
    [user?.id, postId],
  );
  const [urls] = useState<CommentPhotoPreviews>(() => new Map());
  const [files, setFiles] = useState<PrivateCommentPhoto[]>([]);
  const [record, setRecord] = useState<PrivateCommentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, redraw] = useState(0);
  /** Освобождаем ссылки браузерных превью, не изменяя сохранённые в журнале исходники. */
  const release = useCallback(() => {
    releaseCommentPhotoPreviews(urls);
  }, [urls]);
  /** Читаем журнал только для включённой ветки; размонтированный владелец не получает поздний результат чтения. */
  useEffect(() => {
    let current = true;
    if (enabled)
      void journal.load().then(
        (value) => {
          if (current) {
            setRecord(value);
            setError(null);
            setLoading(false);
          }
        },
        () => {
          if (current) {
            setError(
              "Не удалось прочитать сохранённую отправку. Откройте обсуждение заново.",
            );
            setLoading(false);
          }
        },
      );
    return () => {
      current = false;
    };
  }, [enabled, journal]);
  /** Согласуем карту превью с текущими File и освобождаем её, когда ветка перестаёт владеть выбором. */
  useEffect(() => {
    if (enabled) {
      syncCommentPhotoPreviews(urls, files);
    } else release();
    redraw((value) => value + 1);
  }, [enabled, files, release, urls]);
  useEffect(() => release, [release]);
  /** Очищаем свежий выбор файлов вместе с его object URL. */
  const reset = useCallback(() => {
    release();
    setFiles([]);
  }, [release]);
  /** Подтверждаем актуальность операции до и после чтения обсуждения и нужной родительской ветки. */
  const read = async (task: ScopedOperation, parentId?: number) => {
    task.assertCurrent();
    await refreshComments(task, parentId);
    task.assertCurrent();
  };
  /** Явный отказ удаляет только текущую локальную запись; существование родителя и доступность списка для этого не требуются. */
  const clear = async (
    current: PrivateCommentRecord,
    task: ScopedOperation,
  ) => {
    // Explicit discard is local: a missing parent or failed read cannot block it.
    // The journal still checks the owner, original intent and stored revision.
    task.assertCurrent();
    await journal.clear(current);
    task.assertCurrent();
    setRecord(null);
    reset();
  };
  return {
    record,
    loading: enabled && loading,
    error,
    /** Локальную ссылку разрешаем через карту object URL; потерянный локальный исходник не превращаем в сетевой адрес. */
    preview: (url: string) =>
      urls.get(url)?.url ?? (url.startsWith("local-comment:") ? "" : url),
    reset,
    /** Проверяем доступность загрузок до выбора, готовим ограниченный набор фото с удалением метаданных и даём каждому устойчивый локальный ключ. */
    pick: async (slots: number, task: ScopedOperation) => {
      await requirePrivateUpload("privateContentUploads", task.signal);
      const sources = await pickWebFiles(
        "image/jpeg,image/png,image/webp",
        slots > 1,
        { signal: task.signal, maxFiles: slots },
      );
      const prepared: PrivateCommentPhoto[] = [];
      for (const source of sources) {
        const file = await fileForPhotoUpload(source, {
          preserveAlpha: true,
          signal: task.signal,
        });
        task.assertCurrent();
        prepared.push({ key: crypto.randomUUID(), file });
      }
      task.assertCurrent();
      setFiles((previous) => [...previous, ...prepared]);
      return prepared.map(reference);
    },
    /** Освобождаем превью удалённого выбора и исключаем его File из свежего набора. */
    remove: (ref: string) => {
      const url = urls.get(ref);
      if (url) URL.revokeObjectURL(url.url);
      urls.delete(ref);
      setFiles((previous) =>
        previous.filter((file) => reference(file) !== ref),
      );
    },
    /** Возвращаем сохранённые исходники и ссылки выбора без создания новой операции. */
    restore: () => {
      if (!record) return null;
      setFiles(record.files);
      return { record, photos: record.files.map(reference) };
    },
    /** До создания журнала проверяем наличие каждого исходника и готовность приватного контракта; текстовый комментарий также получает ключ. */
    prepare: async (
      input: Pick<ApiInputs["club"]["addComment"], "text" | "parentId">,
      refs: string[],
      task: ScopedOperation,
    ) => {
      if (loading || error)
        throw new Error(error ?? "Проверяем сохранённую отправку…");
      const selected = refs.map((ref) => {
        const file = files.find((file) => reference(file) === ref);
        if (!file)
          throw new Error("Не удалось найти исходное фото комментария");
        return file;
      });
      // A fresh draft has no dispatched upload to recover. Probe before preparing its journal.
      if (!record && selected.length) {
        await checkPrivateUploadAvailability(
          (input, signal) =>
            utils.client.club.privateCommentPhotoStatus.query(input, {
              signal,
            }),
          task,
        );
      }
      const proposed = selected.length
        ? preparePrivateComment(journal.ownerId, { postId, ...input }, selected)
        : prepareTextComment(journal.ownerId, { postId, ...input });
      const prepared = await journal.prepare(proposed);
      task.assertCurrent();
      setRecord(prepared.record);
      return prepared;
    },
    /** Проходим upload/status/add по сохранённому ключу с checkpoint; очищаем журнал лишь после успешного чтения обсуждения. */
    save: async (current: PrivateCommentRecord, task: ScopedOperation) => {
      const id = await savePrivateComment(
        current,
        {
          upload: async (input, signal) => {
            await requirePrivateUpload("privateContentUploads", signal);
            return utils.client.club.uploadPrivateCommentPhoto.mutate(input, {
              signal,
            });
          },
          status: (input, signal) =>
            utils.client.club.privateCommentPhotoStatus.query(input, {
              signal,
            }),
          add: async (input, signal) => {
            // Keyed text comments share the private-content server gate.
            // Never downgrade a stored keyed operation to an unkeyed write.
            if (!(await getAppCapabilities(signal)).privateContentUploads)
              throw new ApiError(
                "Отправка комментария сейчас недоступна. Попробуйте позже.",
                503,
              );
            return utils.client.club.addComment.mutate(input, { signal });
          },
        },
        task,
        async (value) => {
          await journal.checkpoint(value);
          task.assertCurrent();
          setRecord({ ...value });
        },
      );
      // Журнал очищается после чтения обсуждения: потеря последующего ответа оставляет возможность проверить прежнюю отправку.
      await read(task, current.parentId);
      await clear(current, task);
      return id;
    },
    read,
    discard: clear,
  };
}
