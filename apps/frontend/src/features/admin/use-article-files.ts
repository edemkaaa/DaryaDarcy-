"use client";
/** Исходные файлы статьи и временные URL принадлежат активному редактору; перед записью выбираются используемые блоками вложения. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/domain/session/session-context";
import {
  articleFileReference,
  type PrivateArticleFile,
} from "@/domain/content/private-article-files";
import type { ArticleBlock } from "@/domain/content/article-blocks";
import { validatePrivateContentFile } from "@/shared/media/private-content-upload";
import { fileForPhotoUpload, pickWebFiles } from "@/shared/media/image-upload";
import type { ScopedOperation } from "@/shared/browser/operation-scope";
import { requirePrivateUpload } from "@/shared/api/capabilities";

const empty: PrivateArticleFile[] = [];
const documentTypes: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
export function useArticleFiles(active: boolean, slot: number | null) {
  // Хранит File и временные URL в области владельца и статьи; durable журнал содержит байты, а не адреса Blob.

  const { user } = useAuth();
  const resources = useMemo(
    () => /* Смена аккаунта, активности или статьи создаёт отдельную таблицу временных адресов. */ ({
      ownerId: user?.id,
      active,
      slot,
      urls: new Map<string, string>(),
    }),
    [user?.id, active, slot],
  );
  const [selection, setSelection] = useState<{
    resources: typeof resources;
    files: PrivateArticleFile[];
  } | null>(null);
  const release = useCallback(() => {
    // Освобождает только Blob URL данной области; исходные File остаются в журнале.

    for (const url of resources.urls.values()) URL.revokeObjectURL(url);
    resources.urls.clear();
  }, [resources]);
  useEffect(() => /* При смене области или закрытии редактора освобождает её Blob URL. */ release, [release]);
  const files =
    active && selection?.resources === resources ? selection.files : empty;
  const add = (
    file: File,
    usage: PrivateArticleFile["usage"],
    task: ScopedOperation,
  ) => {
    // Проверяет действующую операцию и допустимый формат до добавления локальной ссылки с уникальным ключом.

    task.assertCurrent();
    const intent: PrivateArticleFile = {
      key: crypto.randomUUID(),
      usage,
      file,
    };
    validatePrivateContentFile(intent, usage);
    const reference = articleFileReference(intent);
    resources.urls.set(reference, URL.createObjectURL(file));
    setSelection((previous) => ({
      resources,
      files: [
        ...(previous?.resources === resources ? previous.files : []),
        intent,
      ],
    }));
    return reference;
  };
  const preview = (url: string) =>
    /* Разрешает локальную ссылку только через текущую таблицу; неизвестная локальная ссылка не уходит в сетевой запрос. */ resources.urls.get(url) ?? (url.startsWith("local-content:") ? "" : url);
  const restore = useCallback(
    (files: PrivateArticleFile[]) => {
      // Восстанавливает временные адреса из File и связывает серверные квитанции с теми же локальными превью.

      release();
      for (const file of files) {
        validatePrivateContentFile(file, file.usage);
        const url = URL.createObjectURL(file.file);
        resources.urls.set(articleFileReference(file), url);
        if (file.receipt?.url) resources.urls.set(file.receipt.url, url);
      }
      setSelection({ resources, files });
    },
    [release, resources],
  );
  return {
    files,
    preview,
    previewBlocks: (blocks: ArticleBlock[]) =>
      /* Подменяет ссылки только для показа редактора; исходные ссылки блоков остаются пригодны для восстановления. */ blocks.map((block) => ({
        ...block,
        ...(block.url ? { url: preview(block.url) } : {}),
        ...(block.urls ? { urls: block.urls.map(preview) } : {}),
      })),
    photos: async (multiple: boolean, task: ScopedOperation) => {
      // Проверяет capability и подготавливает фото с прозрачностью до включения в блоки статьи.

      await requirePrivateUpload("privateContentUploads", task.signal);
      const sources = await pickWebFiles(
        "image/jpeg,image/png,image/webp",
        multiple,
        { signal: task.signal },
      );
      const prepared: File[] = [];
      for (const source of sources)
        prepared.push(
          await fileForPhotoUpload(source, {
            preserveAlpha: true,
            signal: task.signal,
          }),
        );
      task.assertCurrent();
      return prepared.map((file) => add(file, "articlePhoto", task));
    },
    document: async (task: ScopedOperation) => {
      // Согласует расширение и MIME PDF/DOCX/TXT, затем сохраняет File с нормализованным типом и локальной ссылкой.

      await requirePrivateUpload("privateContentUploads", task.signal);
      const [source] = await pickWebFiles(".pdf,.docx,.txt", false, {
        signal: task.signal,
      });
      if (!source) return null;
      const mimeType =
        documentTypes[source.name.split(".").at(-1)?.toLowerCase() ?? ""];
      if (
        !mimeType ||
        (source.type &&
          source.type !== "application/octet-stream" &&
          source.type !== mimeType)
      )
        throw new Error("Выберите PDF, DOCX или TXT");
      const file = new File([source], source.name, {
        type: mimeType,
        lastModified: source.lastModified,
      });
      return { url: add(file, "articleDocument", task), label: file.name };
    },
    restore,
    prune: (blocks: ArticleBlock[]) => {
      // Освобождает неиспользуемые адреса, сохраняя общий Blob, пока на него ссылается хотя бы один блок.

      const refs = new Set(
        blocks.flatMap((block) => block.urls ?? (block.url ? [block.url] : [])),
      );
      const retained = new Set(
        [...resources.urls]
          .filter(([ref]) => refs.has(ref))
          .map(([, url]) => url),
      );
      for (const [ref, url] of resources.urls)
        if (!refs.has(ref)) {
          if (!retained.has(url)) URL.revokeObjectURL(url);
          resources.urls.delete(ref);
        }
    },
    reset: () => {
      // Освобождает превью при сбросе формы, не выполняя удаление файлов на сервере.

      release();
      setSelection(null);
    },
  };
}
