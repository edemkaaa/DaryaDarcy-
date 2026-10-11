"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useAuth } from "@/domain/session/session-context";
import { isPersonalDataOwner } from "@/shared/browser/storage";
import {
  PostRecoveryJournal,
  type PostEditorSnapshot,
  type PostRecoveryRecord,
} from "@/domain/post/recovery-store";
import {
  PostSaveCoordinator,
  type PostSaveSnapshot,
} from "@/domain/post/save-post";

export function usePostRecovery({
  active,
  slot,
  editor,
  coordinator,
  onRestore,
}: {
  active: boolean;
  slot: string;
  editor: PostEditorSnapshot;
  coordinator: RefObject<PostSaveCoordinator>;
  onRestore: (editor: PostEditorSnapshot) => void;
}) {
  const { user, isOwner } = useAuth();
  const ownerId = isOwner ? user?.id : undefined;
  const [status, setStatus] = useState<
    "loading" | "offered" | "ready" | "error"
  >("loading");
  const [error, setError] = useState<string | null>(null);
  const [savedCheckpoint, setSavedCheckpoint] = useState<{
    editor: PostEditorSnapshot;
    ownerId: number;
    slot: string;
    savedAt: number;
  } | null>(null);
  const [record, setRecord] = useState<PostRecoveryRecord | null>(null);
  const [autoRestored, setAutoRestored] = useState(false);
  const [saveState, setSaveState] = useState<PostSaveSnapshot | null>(null);
  const loaded = useRef(false);
  const context = useRef<{
    journal: PostRecoveryJournal;
    alive: boolean;
  } | null>(null);
  const latest = useRef({ editor, onRestore });
  useEffect(() => {
    latest.current = { editor, onRestore };
  }, [editor, onRestore]);
  const acceptStoredRecord = useCallback(
    (stored: PostRecoveryRecord | null) => {
      // Ordinary edits can resume immediately. Unconfirmed server writes need
      // the recovery flow so editing cannot change their original payload.
      if (stored?.save.phase === "idle") {
        coordinator.current.restore(stored.save);
        latest.current.onRestore(stored.editor);
        setSaveState(stored.save);
        setRecord(null);
        setAutoRestored(true);
        setStatus("ready");
        return;
      }
      setRecord(stored);
      setStatus(stored ? "offered" : "ready");
    },
    [coordinator],
  );
  useEffect(() => {
    if (!active || !ownerId) return;
    const current = {
      journal: new PostRecoveryJournal(ownerId, slot),
      alive: true,
    };
    context.current = current;
    loaded.current = false;
    setStatus("loading");
    setError(null);
    setRecord(null);
    setAutoRestored(false);
    setSaveState(null);
    setSavedCheckpoint(null);
    void current.journal
      .load()
      .then((stored) => {
        if (!current.alive) return;
        loaded.current = true;
        acceptStoredRecord(stored);
      })
      .catch((cause: unknown) => {
        if (!current.alive) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Не удалось прочитать черновик",
        );
        setStatus("error");
      });
    return () => {
      current.alive = false;
    };
  }, [active, ownerId, slot, acceptStoredRecord]);

  const checkpoint = useCallback(
    async (
      state?: PostSaveSnapshot,
      pending?: PostEditorSnapshot["pending"],
    ) => {
      const current = context.current;
      if (!current?.alive || !ownerId || !isPersonalDataOwner(ownerId))
        throw new Error("Редактор недоступен до проверки аккаунта");
      const snapshot = state ?? coordinator.current.snapshot();
      const draft = latest.current.editor;
      try {
        await current.journal.write(
          pending ? { ...draft, pending } : draft,
          snapshot,
        );
        if (current.alive) {
          // A completed write acknowledges its captured editor, not a newer
          // version typed while IndexedDB was still committing that write.
          setSavedCheckpoint({
            editor: draft,
            ownerId,
            slot,
            savedAt: Date.now(),
          });
          setSaveState(snapshot);
          setError(null);
        }
      } catch (cause) {
        if (current.alive) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Не удалось сохранить черновик",
          );
          setStatus("error");
        }
        throw cause;
      }
    },
    [coordinator, ownerId, slot],
  );

  useEffect(() => {
    if (!active || status !== "ready") return;
    coordinator.current.setCheckpoint(checkpoint);
    const timer = setTimeout(() => {
      void checkpoint().catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [active, status, editor, checkpoint, coordinator]);

  useEffect(() => {
    if (!active || status !== "ready") return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active, status]);

  const restore = () => {
    if (!record || !ownerId || !isPersonalDataOwner(ownerId)) return;
    coordinator.current.restore(record.save);
    latest.current.onRestore(record.editor);
    setSaveState(record.save);
    setSavedCheckpoint({
      editor: record.editor,
      ownerId,
      slot,
      savedAt: record.updatedAt,
    });
    setRecord(null);
    setStatus("ready");
  };
  const clear = async () => {
    const current = context.current;
    if (!current?.alive) throw new Error("Редактор закрыт");
    current.alive = false;
    try {
      await current.journal.clear();
    } catch (cause) {
      current.alive = true;
      throw cause;
    }
  };
  return {
    status,
    error,
    savedAt:
      active &&
      savedCheckpoint?.editor === editor &&
      savedCheckpoint.ownerId === ownerId &&
      savedCheckpoint.slot === slot
        ? savedCheckpoint.savedAt
        : null,
    record,
    autoRestored,
    saveState,
    blocked:
      status !== "ready" || (saveState !== null && saveState.phase !== "idle"),
    checkpoint,
    restore,
    clear,
    retryStorage: async () => {
      if (!loaded.current) {
        const current = context.current;
        if (!current?.alive) return;
        try {
          const stored = await current.journal.load();
          if (!current.alive) return;
          loaded.current = true;
          setError(null);
          acceptStoredRecord(stored);
        } catch (cause) {
          setError((cause as Error).message);
        }
        return;
      }
      await checkpoint();
      setStatus("ready");
    },
  };
}
