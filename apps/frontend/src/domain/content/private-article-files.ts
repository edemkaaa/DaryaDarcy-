/** Локальные ссылки связывают блоки статьи с исходными файлами; перед сохранением выбираем только используемые вложения. */
import type { ArticleBlock } from "./article-blocks";
import {
  validatePrivateContentFile,
  requirePrivateContentReceipt,
  type PrivateContentFile,
} from "@/shared/media/private-content-upload";
export type PrivateArticleFile = PrivateContentFile<
  "articlePhoto" | "articleDocument"
> & { usage: "articlePhoto" | "articleDocument" };
export const articleFileReference = (file: PrivateArticleFile) =>
  `local-content:${file.key}`;
function mapArticleFiles(
  blocks: ArticleBlock[],
  resolve: (url: string, usage: PrivateArticleFile["usage"]) => string,
): ArticleBlock[] {
  return blocks.map((block) => {
    if (block.type === "carousel")
      return {
        ...block,
        ...(block.urls
          ? { urls: block.urls.map((url) => resolve(url, "articlePhoto")) }
          : {}),
      };
    if (
      block.url !== undefined &&
      ["photo", "png", "link"].includes(block.type)
    )
      return {
        ...block,
        url: resolve(
          block.url,
          block.type === "link" ? "articleDocument" : "articlePhoto",
        ),
      };
    return { ...block };
  });
}
export function selectArticleFiles(
  blocks: ArticleBlock[],
  files: PrivateArticleFile[],
): PrivateArticleFile[] {
  const unique = new Map<string, PrivateArticleFile>(),
    selected = new Set<PrivateArticleFile>();
  for (const file of files) {
    validatePrivateContentFile(file, file.usage);
    if (unique.has(file.key))
      throw new Error("Повторный ключ файла в черновике");
    unique.set(file.key, file);
  }
  mapArticleFiles(blocks, (url, usage) => {
    if (!url.startsWith("local-content:")) return url;
    const file = unique.get(url.slice("local-content:".length));
    if (!file || file.usage !== usage)
      throw new Error(
        "Исходный файл отсутствует или не соответствует блоку статьи",
      );
    selected.add(file);
    return url;
  });
  return [...selected];
}
export function resolveArticleFiles(
  blocks: ArticleBlock[],
  files: PrivateArticleFile[],
): ArticleBlock[] {
  selectArticleFiles(blocks, files);
  return mapArticleFiles(blocks, (url, usage) => {
    if (!url.startsWith("local-content:")) return url;
    const file = files.find((file) => articleFileReference(file) === url)!;
    const receipt =
      file.receipt &&
      requirePrivateContentReceipt(file.receipt, file.file, usage);
    if (receipt?.state !== "ready" || !receipt.url)
      throw new Error("Загрузка файла ещё не подтверждена");
    return receipt.url;
  });
}

/** Keep original File objects editable when a resolved write is moved back to a draft. */
export function restoreArticleFileReferences(
  blocks: ArticleBlock[],
  files: PrivateArticleFile[],
): ArticleBlock[] {
  return mapArticleFiles(blocks, (url, usage) => {
    const file = files.find(
      (item) =>
        item.usage === usage &&
        item.receipt?.state === "ready" &&
        item.receipt.url === url,
    );
    return file ? articleFileReference(file) : url;
  });
}
