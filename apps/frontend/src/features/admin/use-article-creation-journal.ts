"use client";
/** React-состояние отражает локальный журнал создания статьи; чтение и восстановление не запускают запись автоматически. */
import { useEffect, useState } from "react";
import {
  ArticleCreationJournal,
  type ArticleCreationRecord,
} from "@/domain/content/article-creation-journal";

/** Own journal loading and its retry state for the editor's mounted account. */
export function useArticleCreationJournal(ownerId: number) {
  // Создаёт журнал для смонтированного аккаунта и отделяет ошибку локального хранилища от отсутствия незавершённой статьи.

  const [journal] = useState(() => new ArticleCreationJournal(ownerId));
  const [creation, setCreation] = useState<ArticleCreationRecord | null>(null);
  const [storageStatus, setStorageStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  useEffect(() => {
    // Загружает сохранённую операцию; запоздалое завершение после размонтирования не меняет состояние формы.

    let alive = true;
    void journal
      .load()
      .then((record) => {
        if (!alive) return;
        setCreation(record);
        setStorageStatus("ready");
        setRecoveryMessage(null);
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setStorageStatus("error");
        setRecoveryMessage(
          error instanceof Error
            ? error.message
            : "Не удалось прочитать операцию статьи",
        );
      });
    return () => {
      alive = false;
    };
  }, [journal, loadAttempt]);
  return {
    journal,
    creation,
    setCreation,
    storageStatus,
    recoveryMessage,
    setRecoveryMessage,
    retryRead: () => /* Повторяет только чтение локального журнала после ошибки, не создавая статью. */ setLoadAttempt((value) => value + 1),
  };
}
