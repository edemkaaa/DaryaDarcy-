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
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [record, setRecord] = useState<PostRecoveryRecord | null>(null);
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
    setSaveState(null);
    setSavedAt(null);
    void current.journal
      .load()
      .then((stored) => {
        if (!current.alive) return;
        loaded.current = true;
        setRecord(stored);
        setStatus(stored ? "offered" : "ready");
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
  }, [active, ownerId, slot]);

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
          setSavedAt(Date.now());
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
    [coordinator, ownerId],
  );

  useEffect(() => {
    if (!active || status !== "ready") return;
    coordinator.current.setCheckpoint(checkpoint);
    setSavedAt(null);
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
    setSavedAt(record.updatedAt);
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
    savedAt,
    record,
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
          setRecord(stored);
          setError(null);
          setStatus(stored ? "offered" : "ready");
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
