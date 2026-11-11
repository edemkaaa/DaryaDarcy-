"use client";
/** Очередь локальных снимков сохраняет последнюю версию ввода; отправленная операция временно отделяется от редактируемого черновика. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArticleDraftJournal,
  type ArticleDraftRecord,
  type ArticleDraftSnapshot,
  type DamagedArticleDraft,
} from "@/domain/content/article-draft-journal";
import {
  selectArticleFiles,
  type PrivateArticleFile,
} from "@/domain/content/private-article-files";

export function useArticleDraft(
  ownerId: number,
  enabled: boolean,
  snapshot: ArticleDraftSnapshot,
  files: PrivateArticleFile[],
) {
  // Сериализует автосохранение по аккаунту и статье; локальная ревизия предотвращает незаметную замену черновика из другой вкладки.

  const [journal] = useState(() => new ArticleDraftJournal(ownerId));
  const current = useRef(new Map<number | null, ArticleDraftRecord>());
  const [records, setRecords] = useState<ArticleDraftRecord[]>([]);
  const [damaged, setDamaged] = useState<DamagedArticleDraft[]>([]);
  const [readError, setReadError] = useState<string | null>(null);
  const readSequence = useRef(0);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<string | null>(null);
  const alive = useRef(true);
  const paused = useRef(false);
  const queue = useRef<{
    snapshot: ArticleDraftSnapshot;
    files: PrivateArticleFile[];
  } | null>(null);
  const running = useRef<Promise<void> | null>(null);
  const report = useCallback((cause: unknown) => {
    // Сохраняет ошибку и для ожидающего flush, и для видимого предупреждения, не обновляя размонтированный компонент.

    errorRef.current =
      cause instanceof Error
        ? cause.message
        : "Не удалось сохранить черновик. Не закрывайте редактор.";
    if (alive.current) setError(errorRef.current);
  }, []);
  const invalidatePendingReads = useCallback(() => {
    // Меняет поколение чтений, чтобы прежняя инспекция не восстановила уже закрытый снимок.

    readSequence.current++;
  }, []);
  // Номер чтения не даёт более старой инспекции затереть состояние после нового чтения или закрытия редактора.
  const reload = useCallback(async () => {
    // Принимает только последнее завершённое чтение журнала и отдельно показывает повреждённые записи.

    const sequence = ++readSequence.current;
    try {
      const inspection = await journal.inspect();
      if (!alive.current || sequence !== readSequence.current) return;
      current.current = new Map(
        inspection.records.map((record) => [record.snapshot.editingId, record]),
      );
      setRecords(inspection.records);
      setDamaged(inspection.damaged);
      setLoaded(true);
      setReadError(null);
    } catch (cause) {
      if (alive.current && sequence === readSequence.current)
        setReadError(
          cause instanceof Error
            ? cause.message
            : "Не удалось прочитать черновики статей на устройстве.",
        );
      throw cause;
    }
  }, [journal]);
  useEffect(() => {
    // При монтировании читает журнал; при закрытии инвалидирует поздние инспекции без удаления данных.

    alive.current = true;
    void reload().catch(() => {});
    return () => {
      alive.current = false;
      invalidatePendingReads();
    };
  }, [reload, invalidatePendingReads]);

  // Единственный писатель последовательно догоняет последнюю очередь; параллельные flush используют ту же работу.
  const flush = useCallback(async (): Promise<void> => {
    // Разделяет одну выполняющуюся запись между всеми ожидающими и последовательно догоняет самый новый поставленный снимок.

    if (running.current) return running.current;
    if (!queue.current) {
      if (errorRef.current) throw new Error(errorRef.current);
      return;
    }
    if (alive.current) setSaving(true);
    const work = async () => {
      // Сохраняет снимок с ожидаемой локальной ревизией; новый ввод во время записи остаётся в очереди следующей итерации.

      while (queue.current) {
        const next = queue.current;
        const saved = await journal.save(
          next.snapshot,
          next.files,
          current.current.get(next.snapshot.editingId)?.revision ?? null,
        );
        current.current.set(saved.snapshot.editingId, saved);
        if (queue.current === next) queue.current = null;
        errorRef.current = null;
        if (alive.current) {
          setRecords([...current.current.values()]);
          setError(null);
        }
      }
    };
    running.current = work()
      .catch((cause: unknown) => {
        report(cause);
        throw cause;
      })
      .finally(() => {
        running.current = null;
        if (alive.current) setSaving(false);
      });
    return running.current;
  }, [journal, report]);
  const {
    editingId,
    title,
    coverUrl,
    access,
    published,
    sections,
    writeUncertain,
    editBase,
    editConflict,
  } = snapshot;
  const input = useMemo(
    () => /* Фиксирует зависимости формы одним снимком для автосохранения, включая ревизию и неопределённость предыдущей отправки. */ ({
      editingId,
      title,
      coverUrl,
      access,
      published,
      sections,
      writeUncertain,
      editBase,
      editConflict,
    }),
    [
      editingId,
      title,
      coverUrl,
      access,
      published,
      sections,
      writeUncertain,
      editBase,
      editConflict,
    ],
  );
  useEffect(() => {
    // Ставит согласованные поля и только используемые файлы в очередь, если форма активна и журнал успешно прочитан.

    if (!enabled || !loaded || paused.current) return;
    try {
      queue.current = {
        snapshot: input,
        files: selectArticleFiles(input.sections, files),
      };
      void flush().catch(() => {});
    } catch (cause) {
      report(cause);
    }
  }, [enabled, loaded, input, files, flush, report]);
  useEffect(() => {
    // Регистрирует защиту ухода на время несохранённого ввода; при закрытии слушатель снимается.

    const warn = (event: BeforeUnloadEvent) => {
      // Предупреждает уход только при несохранённой очереди, незавершённой записи или ошибке хранения.

      if (!queue.current && !running.current && !errorRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  // Обычная очистка ждёт сохранения ввода; явный discard отдельно отказывается только от локального черновика.
  const clear = async (discard = false, slot = editingId) => {
    // Останавливает автозапись: обычное завершение ждёт flush, явный отказ отбрасывает очередь, но не чужую ревизию.

    paused.current = true;
    try {
      if (discard) {
        queue.current = null;
        await running.current?.catch(() => {});
      } else await flush();
      await journal.clear(slot, current.current.get(slot)?.revision ?? null);
      current.current.delete(slot);
      errorRef.current = null;
      if (alive.current) {
        setRecords([...current.current.values()]);
        setError(null);
      }
    } catch (cause) {
      paused.current = false;
      report(cause);
      throw cause;
    }
  };
  // До отправки update сохраняем неопределённость в черновике, чтобы перезагрузка не разрешила слепой повтор.
  const markWriteStarted = async (editConflict?: 409 | 412) => {
    // До сетевого update сохраняет признак неизвестного исхода и приостанавливает редактируемые записи, запрещая слепой повтор после перезагрузки.

    await flush();
    const value = current.current.get(editingId);
    if (!value)
      throw new Error("Сначала сохраните черновик статьи на устройстве.");
    paused.current = true;
    try {
      const saved = await journal.save(
        { ...value.snapshot, writeUncertain: true, editConflict },
        value.files,
        value.revision,
      );
      current.current.set(editingId, saved);
      if (alive.current) setRecords([...current.current.values()]);
    } catch (cause) {
      paused.current = false;
      report(cause);
      throw cause;
    }
  };
  return {
    reload,
    archiveDamaged: async (key: string) => {
      // Переносит повреждённую локальную запись в архив и перечитывает список вместо её молчаливого удаления.

      await journal.archiveDamaged(key);
      await reload();
    },
    damaged,
    readError,
    isDamaged: (slot: number | null) =>
      /* Проверяет повреждение конкретного слота владельца, чтобы другая статья оставалась доступна. */ damaged.some((entry) => entry.key === `${ownerId}:${slot ?? "new"}`),
    saveSnapshot: async (
      snapshot: ArticleDraftSnapshot,
      files: PrivateArticleFile[],
    ) => {
      // Ждёт текущего писателя и сохраняет явный снимок с локальной ревизией перед заменой рабочей базы.

      await running.current;
      const saved = await journal.save(
        snapshot,
        files,
        current.current.get(snapshot.editingId)?.revision ?? null,
      );
      current.current.set(snapshot.editingId, saved);
      queue.current = null;
      if (alive.current) setRecords([...current.current.values()]);
    },
    record:
      records.find((record) => record.snapshot.editingId === editingId) ?? null,
    records,
    loaded,
    saving,
    error,
    flush,
    clear,
    markWriteStarted,
    resume: () => {
      // Возобновляет постановку изменяемого черновика после разрешения неопределённой операции.

      paused.current = false;
    },
  };
}
