"use client";
import { useState, type RefObject } from "react";
import { editableSnapshot } from "@/domain/content/edit-revision";
import type { PostSaveApi, PostSaveCoordinator } from "@/domain/post/save-post";
import type { PostEditorSnapshot } from "@/domain/post/recovery-store";
import { postDraftSnapshot } from "@/domain/post/draft";
import {
  checkOperationAccessError,
  type useSessionOperation,
} from "@/domain/session/use-session-operation";
import type { usePostRecovery } from "./use-post-recovery";
import { EditComparison } from "./edit-comparison";

export function usePostEditComparison(
  coordinator: RefObject<PostSaveCoordinator>,
  recovery: ReturnType<typeof usePostRecovery>,
  api: PostSaveApi,
  operation: ReturnType<typeof useSessionOperation>,
  editor: PostEditorSnapshot,
) {
  const [server, setServer] = useState<unknown>();
  const [error, setError] = useState<string | null>(null);
  const read = async () => {
    const task = operation.begin("compare-post");
    if (!task) return;
    try {
      setError(null);
      const detail = await coordinator.current.compareUpdate(api, task);
      task.assertCurrent();
      setServer(detail);
    } catch (cause) {
      checkOperationAccessError(cause);
      if (task.isCurrent())
        setError(
          cause instanceof Error
            ? cause.message
            : "Не удалось прочитать публикацию",
        );
    } finally {
      task.finish();
    }
  };
  const accept = async () => {
    if (
      !server ||
      !window.confirm(
        "Продолжить с вашими изменениями относительно показанной серверной версии? Сохранение потребуется нажать отдельно.",
      )
    )
      return;
    const task = operation.begin("accept-post-revision");
    if (!task) return;
    try {
      task.assertCurrent();
      await coordinator.current.acceptComparedRevision(server);
      task.assertCurrent();
      setServer(undefined);
      setError(null);
    } catch (cause) {
      if (task.isCurrent())
        setError(
          cause instanceof Error
            ? cause.message
            : "Не удалось сохранить версию черновика",
        );
    } finally {
      task.finish();
    }
  };
  return recovery.saveState?.phase === "update" ? (
    <EditComparison
      current={{
        ...postDraftSnapshot(editor.draft),
        attachments: editor.attachments.map(({ file: _file, ...item }) => item),
      }}
      server={server ? editableSnapshot(server, "post") : undefined}
      busy={operation.busy}
      error={error}
      onRead={() => void read()}
      onAccept={server ? () => void accept() : undefined}
    />
  ) : null;
}
