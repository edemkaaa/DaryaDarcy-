import type { PrivateCommentPhoto } from "@/domain/post/private-comment-save";

export type CommentPhotoPreviews = Map<string, { file: File; url: string }>;
export const commentPhotoReference = (file: PrivateCommentPhoto) =>
  `local-comment:${file.key}`;

export function syncCommentPhotoPreviews(
  urls: CommentPhotoPreviews,
  files: PrivateCommentPhoto[],
) {
  const selected = new Map(
    files.map((file) => [commentPhotoReference(file), file.file]),
  );
  for (const [key, preview] of urls) {
    if (selected.get(key) === preview.file) continue;
    URL.revokeObjectURL(preview.url);
    urls.delete(key);
  }
  for (const [key, file] of selected) {
    if (!urls.has(key)) urls.set(key, { file, url: URL.createObjectURL(file) });
  }
}
export function releaseCommentPhotoPreviews(urls: CommentPhotoPreviews) {
  for (const { url } of urls.values()) URL.revokeObjectURL(url);
  urls.clear();
}
