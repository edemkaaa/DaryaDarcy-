/** Проверяем владение object URL выбранных фото комментария: стабильность, замена и очистка. */
import { afterEach, expect, it, vi } from "vitest";
import {
  syncCommentPhotoPreviews,
  releaseCommentPhotoPreviews,
  type CommentPhotoPreviews,
} from "../apps/frontend/src/features/club/comment-photo-previews";

/** Восстанавливаем URL-spies после каждого сценария. */
afterEach(() => vi.restoreAllMocks());

/** Добавление соседнего файла не пересоздаёт прежнее превью; удаление и общий cleanup освобождают только принадлежащие им URL. */
it("keeps an unchanged selected file's URL when another photo is added or removed", () => {
  let sequence = 0;
  vi.spyOn(URL, "createObjectURL").mockImplementation(
    () => `blob:photo-${++sequence}`,
  );
  const revoked = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const urls: CommentPhotoPreviews = new Map();
  const a = { key: "a", file: new File(["a"], "a.jpg") };
  const b = { key: "b", file: new File(["b"], "b.jpg") };
  syncCommentPhotoPreviews(urls, [a]);
  expect(urls.get("local-comment:a")?.url).toBe("blob:photo-1");
  syncCommentPhotoPreviews(urls, [a, b]);
  expect(urls.get("local-comment:a")?.url).toBe("blob:photo-1");
  expect(urls.get("local-comment:b")?.url).toBe("blob:photo-2");
  expect(revoked).not.toHaveBeenCalled();
  syncCommentPhotoPreviews(urls, [a]);
  expect(revoked.mock.calls).toEqual([["blob:photo-2"]]);
  expect(urls.get("local-comment:a")?.url).toBe("blob:photo-1");
  releaseCommentPhotoPreviews(urls);
  expect(revoked.mock.calls).toEqual([["blob:photo-2"], ["blob:photo-1"]]);
  expect(urls.size).toBe(0);
});

/** Одинаковый ключ с новым File должен заменить байты и освободить старый URL; пустой список завершает scope. */
it("releases the previous bytes on replacement and every URL on scope cleanup", () => {
  let sequence = 0;
  vi.spyOn(URL, "createObjectURL").mockImplementation(
    () => `blob:replacement-${++sequence}`,
  );
  const revoked = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const urls: CommentPhotoPreviews = new Map();
  syncCommentPhotoPreviews(urls, [
    { key: "a", file: new File(["old"], "a.jpg") },
  ]);
  syncCommentPhotoPreviews(urls, [
    { key: "a", file: new File(["new"], "a.jpg") },
  ]);
  expect(urls.get("local-comment:a")?.url).toBe("blob:replacement-2");
  expect(revoked.mock.calls).toEqual([["blob:replacement-1"]]);
  syncCommentPhotoPreviews(urls, []);
  expect(urls.size).toBe(0);
  expect(revoked.mock.calls).toEqual([
    ["blob:replacement-1"],
    ["blob:replacement-2"],
  ]);
});
