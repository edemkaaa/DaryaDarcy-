"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/domain/session/session-context";
import { PrivateCommentJournal } from "@/domain/post/private-comment-journal";
import {
  preparePrivateComment,
  savePrivateComment,
  type PrivateCommentPhoto,
  type PrivateCommentRecord,
} from "@/domain/post/private-comment-save";
import type { ApiInputs } from "@/shared/api/types";
import { trpc } from "@/shared/api/trpc";
import { requirePrivateUpload } from "@/shared/api/capabilities";
import { requireIdList } from "@/shared/api/action-result";
import type { ScopedOperation } from "@/shared/browser/operation-scope";
import { fileForPhotoUpload, pickWebFiles } from "@/shared/media/image-upload";
import { checkPrivateUploadAvailability } from "@/shared/media/private-upload-availability";
const reference = (file: PrivateCommentPhoto) => `local-comment:${file.key}`;

/** The keyed comment thread owns selection, previews and this account/post journal. */
export function usePrivateCommentFiles(enabled: boolean, postId: number) {
  const { user } = useAuth(),
    utils = trpc.useUtils();
  const journal = useMemo(
    () => new PrivateCommentJournal(user?.id ?? 0, postId),
    [user?.id, postId],
  );
  const [urls] = useState(() => new Map<string, string>());
  const [files, setFiles] = useState<PrivateCommentPhoto[]>([]);
  const [record, setRecord] = useState<PrivateCommentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, redraw] = useState(0);
  const release = useCallback(() => {
    for (const url of urls.values()) URL.revokeObjectURL(url);
    urls.clear();
  }, [urls]);
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
  useEffect(() => {
    if (enabled) {
      for (const file of files)
        urls.set(reference(file), URL.createObjectURL(file.file));
      redraw((value) => value + 1);
    }
    return release;
  }, [enabled, files, release, urls]);
  const reset = useCallback(() => {
    release();
    setFiles([]);
  }, [release]);
  const read = async (task: ScopedOperation) => {
    await utils.club.comments.cancel({ postId });
    task.assertCurrent();
    const rows = await utils.client.club.comments.query(
      { postId },
      { signal: task.signal },
    );
    task.assertCurrent();
    requireIdList(rows);
    await utils.club.comments.cancel({ postId });
    task.assertCurrent();
    utils.club.comments.setData({ postId }, rows);
  };
  const clear = async (
    current: PrivateCommentRecord,
    task: ScopedOperation,
  ) => {
    await read(task);
    await journal.clear(current);
    task.assertCurrent();
    setRecord(null);
    reset();
  };
  return {
    record,
    loading: enabled && loading,
    error,
    preview: (url: string) =>
      urls.get(url) ?? (url.startsWith("local-comment:") ? "" : url),
    reset,
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
    remove: (ref: string) => {
      const url = urls.get(ref);
      if (url) URL.revokeObjectURL(url);
      urls.delete(ref);
      setFiles((previous) =>
        previous.filter((file) => reference(file) !== ref),
      );
    },
    restore: () => {
      if (!record) return null;
      setFiles(record.files);
      return { record, photos: record.files.map(reference) };
    },
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
      const proposed = preparePrivateComment(
        journal.ownerId,
        { postId, ...input },
        selected,
      );
      const prepared = await journal.prepare(proposed);
      task.assertCurrent();
      setRecord(prepared.record);
      return prepared;
    },
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
          add: (input, signal) =>
            utils.client.club.addComment.mutate(input, { signal }),
        },
        task,
        async (value) => {
          await journal.checkpoint(value);
          task.assertCurrent();
          setRecord({ ...value });
        },
      );
      await clear(current, task);
      return id;
    },
    read,
    discard: clear,
  };
}
