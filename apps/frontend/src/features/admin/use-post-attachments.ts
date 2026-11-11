"use client";
/** Дополнительные медиа редактора хранятся отдельно от текста и отслеживают удалённые серверные вложения. */

import { useCallback, useRef, useState } from "react";
import { getDocumentAsync } from "@/shared/browser/file-picker";
import {
  checkOperationAccessError,
  type useSessionOperation,
} from "@/domain/session/use-session-operation";
import type { PostAttachment } from "@/domain/post/save-post";
import { isRawMediaFilename } from "@/shared/media/media-label";
import { requirePrivateUpload } from "@/shared/api/capabilities";
import {
  AUDIO_TYPES,
  AUDIO_MIMES,
  AUDIO_FORMAT_MESSAGE,
} from "@shared/audio-formats";

type ExistingMedia = {
  id: number;
  type: string;
  url: string;
  filename?: string | null;
  mimeType?: string | null;
};
const DOCUMENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};

/** Both editors keep File objects until the shared save coordinator reads them. */
export function usePostAttachments(
  operation: ReturnType<typeof useSessionOperation>,
  onError: (message: string) => void,
) {
  const [attachments, setAttachments] = useState<PostAttachment[]>([]);
  const removedIds = useRef<number[]>([]);
  const markRemoved = (id: number) => {
    if (!operation.busy && !removedIds.current.includes(id))
      removedIds.current = [...removedIds.current, id];
  };
  const reset = useCallback((media?: readonly ExistingMedia[] | null) => {
    removedIds.current = [];
    setAttachments(
      (media ?? []).flatMap((item): PostAttachment[] =>
        item.type === "audio" || item.type === "document"
          ? [
              {
                id: item.id,
                type: item.type,
                url: item.url,
                name: !isRawMediaFilename(item.filename)
                  ? item.filename!.trim().split(/[\\/]/).at(-1)!
                  : item.type === "audio"
                    ? "Аудио"
                    : "Документ",
                mimeType: item.mimeType || "",
              },
            ]
          : [],
      ),
    );
  }, []);
  const pick = async (type: PostAttachment["type"]) => {
    const task = operation.begin("attachment");
    if (!task) return;
    try {
      await requirePrivateUpload("privatePostMediaUploads", task.signal);
      const result = await getDocumentAsync({
        type: type === "audio" ? AUDIO_MIMES : Object.values(DOCUMENT_TYPES),
        signal: task.signal,
        createPreviewUrl: false,
      });
      if (result.canceled || !result.assets.length) return;
      task.assertCurrent();
      const asset = result.assets[0];
      const extension = /\.([^.]+)$/.exec(asset.name)?.[1].toLowerCase() ?? "";
      const inferredType = type === "audio" ? AUDIO_TYPES : DOCUMENT_TYPES;
      const fallbackMime = Object.hasOwn(inferredType, extension)
        ? inferredType[extension]
        : undefined;
      if (type === "document" && !fallbackMime)
        throw new Error("Выберите PDF, DOCX или TXT.");
      if (
        type === "document" &&
        asset.mimeType &&
        asset.mimeType !== fallbackMime &&
        asset.mimeType !== "application/octet-stream" &&
        !(extension === "docx" && asset.mimeType === "application/zip")
      )
        throw new Error("Формат файла не соответствует расширению документа.");
      const declared = asset.mimeType?.trim().toLowerCase();
      if (
        type === "audio" &&
        !fallbackMime &&
        !AUDIO_MIMES.includes(declared ?? "")
      )
        throw new Error(AUDIO_FORMAT_MESSAGE);
      const mimeType =
        (type === "document" ? fallbackMime : (fallbackMime ?? declared)) ??
        "application/octet-stream";
      if (type === "audio" && !mimeType?.startsWith("audio/"))
        throw new Error("Выберите аудиофайл поддерживаемого формата.");
      setAttachments((previous) => [
        ...previous,
        { type, file: asset.file, name: asset.name, mimeType },
      ]);
    } catch (error) {
      checkOperationAccessError(error);
      if (task.isCurrent())
        onError(
          error instanceof Error
            ? error.message
            : "Не удалось выбрать вложение",
        );
    } finally {
      task.finish();
    }
  };
  const remove = (index: number) => {
    if (operation.busy) return;
    const attachment = attachments[index];
    if (!attachment) return;
    if (attachment.id) markRemoved(attachment.id);
    setAttachments((previous) => previous.filter((_, i) => i !== index));
  };
  const restore = useCallback((items: PostAttachment[], removed: number[]) => {
    removedIds.current = removed;
    setAttachments(items);
  }, []);
  return {
    attachments,
    removedIds: removedIds.current,
    reset,
    restore,
    pick,
    remove,
    markRemoved,
  };
}
