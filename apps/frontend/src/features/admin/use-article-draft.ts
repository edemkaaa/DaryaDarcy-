"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArticleDraftJournal,
  type ArticleDraftRecord,
  type ArticleDraftSnapshot,
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
  const [journal] = useState(() => new ArticleDraftJournal(ownerId));
  const current = useRef(new Map<number | null, ArticleDraftRecord>());
  const [records, setRecords] = useState<ArticleDraftRecord[]>([]);
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
    errorRef.current =
      cause instanceof Error
        ? cause.message
        : "Не удалось сохранить черновик. Не закрывайте редактор.";
    if (alive.current) setError(errorRef.current);
  }, []);
  useEffect(() => {
    let cancelled = false;
    alive.current = true;
    void journal
      .load()
      .then((value) => {
        if (cancelled || !alive.current) return;
        current.current = new Map(
          value.map((record) => [record.snapshot.editingId, record]),
        );
        setRecords(value);
        setLoaded(true);
      })
      .catch((cause: unknown) => {
        if (!cancelled) report(cause);
      });
    return () => {
      cancelled = true;
      alive.current = false;
    };
  }, [journal, report]);

  const flush = useCallback(async (): Promise<void> => {
    if (running.current) return running.current;
    if (!queue.current) {
      if (errorRef.current) throw new Error(errorRef.current);
      return;
    }
    if (alive.current) setSaving(true);
    const work = async () => {
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
    () => ({
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
    const warn = (event: BeforeUnloadEvent) => {
      if (!queue.current && !running.current && !errorRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const clear = async (discard = false, slot = editingId) => {
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
  const markWriteStarted = async (editConflict?: 409 | 412) => {
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
    reload: async () => {
      const value = await journal.load();
      current.current = new Map(
        value.map((record) => [record.snapshot.editingId, record]),
      );
      if (alive.current) setRecords(value);
    },
    saveSnapshot: async (
      snapshot: ArticleDraftSnapshot,
      files: PrivateArticleFile[],
    ) => {
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
      paused.current = false;
    },
  };
}
