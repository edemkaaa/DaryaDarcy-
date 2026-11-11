"use client";
/** Загрузка публичной обложки и её привязка к статье проходят отдельные подтверждения и журнал восстановления. */
import { useEffect, useState } from "react";
import {
  ArticleCoverJournal,
  requirePublicCoverReceipt,
  type ArticleCoverRecord,
  type ArticleCoverSnapshot,
} from "@/domain/content/article-cover-journal";
import type { PrivateArticleFile } from "@/domain/content/private-article-files";
import {
  checkOperationAccessError,
  useSessionOperation,
} from "@/domain/session/use-session-operation";
import type { ScopedOperation } from "@/shared/browser/operation-scope";
import { getHttpStatus } from "@/shared/api/errors";
import { trpc } from "@/shared/api/trpc";
import { fileToUpload, pickWebFiles } from "@/shared/media/image-upload";

export function useArticleCover(
  ownerId: number,
  operation: ReturnType<typeof useSessionOperation>,
) {
  const utils = trpc.useUtils();
  const [journal] = useState(() => new ArticleCoverJournal(ownerId));
  const [record, setRecord] = useState<ArticleCoverRecord | null>(null);
  const [attachedKey, setAttachedKey] = useState<string | null>(null);
  const [storageStatus, setStorageStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const pending = !!record && attachedKey === record.idempotencyKey;
  useEffect(() => {
    let alive = true;
    void journal
      .load()
      .then((saved) => {
        if (!alive) return;
        setRecord(saved);
        setStorageStatus("ready");
        setMessage(null);
      })
      .catch(() => {
        if (!alive) return;
        setStorageStatus("error");
        setMessage(
          "Не удалось прочитать загрузку баннера. Повторите чтение; новая загрузка пока недоступна.",
        );
      });
    return () => {
      alive = false;
    };
  }, [journal, loadAttempt]);
  const fail = (cause: unknown, task: ScopedOperation, saved: boolean) => {
    checkOperationAccessError(cause);
    if (!task.isCurrent()) return;
    setCanRetry(false);
    setMessage(
      getHttpStatus(cause) === 409
        ? "Конфликт загрузки баннера. Повтор остановлен. Можно проверить результат или отменить эту загрузку и выбрать файл заново."
        : saved
          ? "Загрузка баннера не подтверждена. Файл и черновик статьи сохранены на этом устройстве. Проверьте загрузку перед повтором."
          : "Не удалось подготовить или сохранить файл баннера на устройстве. Загрузка не отправлена. Проверьте хранилище и выберите файл снова.",
    );
  };
  const complete = async (
    saved: ArticleCoverRecord,
    value: unknown,
    task: ScopedOperation,
    commit: (url: string) => void,
  ) => {
    const receipt = requirePublicCoverReceipt(value);
    task.assertCurrent();
    if (receipt.state !== "ready") {
      setCanRetry(true);
      setMessage(
        "Баннер ещё не подтверждён. Можно повторить загрузку исходного файла с прежним ключом.",
      );
      return;
    }
    await journal.clear(saved);
    task.assertCurrent();
    // Uploading a cover never creates or updates an article.
    commit(receipt.url);
    setRecord(null);
    setAttachedKey(null);
    setCanRetry(false);
    setMessage(null);
  };
  const upload = (saved: ArticleCoverRecord, task: ScopedOperation) =>
    utils.client.admin.uploadPublicCover.mutate(
      { ...saved.upload, idempotencyKey: saved.idempotencyKey },
      { signal: task.signal },
    );
  return {
    record,
    pending,
    storageStatus,
    message,
    canRetry,
    retryRead: () => setLoadAttempt((value) => value + 1),
    detach: () => {
      setAttachedKey(null);
      setCanRetry(false);
      setMessage(null);
    },
    attach: (saved: ArticleCoverRecord) => {
      setAttachedKey(saved.idempotencyKey);
      setCanRetry(false);
      setMessage(
        "Восстановлен черновик статьи с незавершённой загрузкой баннера. Сначала проверьте загрузку.",
      );
    },
    start: async (
      snapshot: ArticleCoverSnapshot,
      files: PrivateArticleFile[],
      commit: (url: string) => void,
    ) => {
      if (record || storageStatus !== "ready") return;
      const task = operation.begin("photos");
      if (!task) return;
      let saved = false;
      setMessage(null);
      try {
        const [source] = await pickWebFiles("image/*", false, {
          signal: task.signal,
        });
        if (!source) return;
        const payload = await fileToUpload(source, { signal: task.signal });
        task.assertCurrent();
        const prepared = await journal.prepare(
          snapshot,
          { ...payload, purpose: "publicCover" },
          files,
        );
        // A cancelled editor still exposes its durable operation in the list.
        setRecord(prepared.record);
        task.assertCurrent();
        if (prepared.restored) {
          setMessage(
            "Есть предыдущая загрузка баннера. Вернитесь к списку статей и восстановите её черновик.",
          );
          return;
        }
        saved = true;
        setAttachedKey(prepared.record.idempotencyKey);
        await journal.requireCurrent(prepared.record);
        task.assertCurrent();
        await complete(
          prepared.record,
          await upload(prepared.record, task),
          task,
          commit,
        );
      } catch (cause) {
        fail(cause, task, saved);
      } finally {
        task.finish();
      }
    },
    recover: async (replay: boolean, commit: (url: string) => void) => {
      if (!pending || !record || (replay && !canRetry)) return;
      const task = operation.begin("recover-cover");
      if (!task) return;
      setCanRetry(false);
      try {
        await journal.requireCurrent(record);
        task.assertCurrent();
        const receipt = requirePublicCoverReceipt(
          await utils.client.admin.publicCoverUploadStatus.query(
            { idempotencyKey: record.idempotencyKey },
            { signal: task.signal },
          ),
        );
        task.assertCurrent();
        if (receipt.state === "ready" || !replay) {
          await complete(record, receipt, task, commit);
          return;
        }
        await journal.requireCurrent(record);
        task.assertCurrent();
        await complete(record, await upload(record, task), task, commit);
      } catch (cause) {
        fail(cause, task, true);
      } finally {
        task.finish();
      }
    },
    discard: async () => {
      if (!record || !pending) return;
      const task = operation.begin("discard-cover");
      if (!task) return;
      try {
        await journal.clear(record);
        task.assertCurrent();
        setRecord(null);
        setAttachedKey(null);
        setCanRetry(false);
        setMessage(null);
      } catch (cause) {
        fail(cause, task, true);
      } finally {
        task.finish();
      }
    },
  };
}
