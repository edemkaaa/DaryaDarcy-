"use client";

import { useCallback, useRef, useState } from "react";
import { getDocumentAsync } from "@/shared/browser/file-picker";
import {
  checkOperationAccessError,
  type useSessionOperation,
} from "@/domain/session/use-session-operation";
import type { PostAttachment } from "@/domain/post/save-post";

type ExistingMedia = {
  id: number;
  type: string;
  url: string;
  filename?: string | null;
  mimeType?: string | null;
};
const DOCUMENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};
const AUDIO_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  flac: "audio/flac",
  aif: "audio/aiff",
  aiff: "audio/aiff",
  webm: "audio/webm",
};

/** Both editors keep File objects until the shared save coordinator reads them. */
export function usePostAttachments(
  operation: ReturnType<typeof useSessionOperation>,
  onError: (message: string) => void,
) {
  const [attachments, setAttachments] = useState<PostAttachment[]>([]);
  const removedIds = useRef<number[]>([]);
  const reset = useCallback((media: readonly ExistingMedia[] = []) => {
    removedIds.current = [];
    setAttachments(
      media.flatMap((item): PostAttachment[] =>
        item.type === "audio" || item.type === "document"
          ? [
              {
                id: item.id,
                type: item.type,
                url: item.url,
                name: item.filename || item.url.split("/").at(-1) || "Вложение",
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
      const result = await getDocumentAsync({
        type: type === "audio" ? "audio/*" : Object.values(DOCUMENT_TYPES),
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
        throw new Error("Выберите PDF, DOC, DOCX или TXT.");
      if (
        type === "document" &&
        asset.mimeType &&
        asset.mimeType !== fallbackMime &&
        asset.mimeType !== "application/octet-stream" &&
        !(extension === "docx" && asset.mimeType === "application/zip")
      )
        throw new Error("Формат файла не соответствует расширению документа.");
      const mimeType =
        (type === "document" ? fallbackMime : asset.mimeType || fallbackMime) ??
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
    if (attachment.id) removedIds.current.push(attachment.id);
    setAttachments((previous) => previous.filter((_, i) => i !== index));
  };
  return { attachments, removedIds: removedIds.current, reset, pick, remove };
}
