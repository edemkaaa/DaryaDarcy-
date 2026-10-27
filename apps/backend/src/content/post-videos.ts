import { and, asc, eq, inArray } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { postMedia } from "../../../../packages/database/src/schema";
import { TRPCError } from "@trpc/server";
import { privateMediaUrl } from "./private-attachment-association";

type VideoWriter = Pick<
  MySql2Database,
  "select" | "delete" | "insert" | "update"
>;

/** Caller owns the transaction and the parent post's write lock. */
export async function replacePostVideoRows(
  writer: VideoWriter,
  postId: number,
  urls: string[],
  posters: ReadonlyMap<string, string> = new Map(),
): Promise<void> {
  const existing = await writer
    .select({
      id: postMedia.id,
      url: postMedia.url,
      sortOrder: postMedia.sortOrder,
      posterUrl: postMedia.posterUrl,
    })
    .from(postMedia)
    .where(and(eq(postMedia.postId, postId), eq(postMedia.type, "video")))
    .orderBy(asc(postMedia.sortOrder), asc(postMedia.id));
  // Historical duplicates are separate attachments. Match occurrences in stable
  // display order, never by basename (signed query strings are significant).
  type ExistingVideo = (typeof existing)[number];
  const byUrl = new Map<string, { rows: ExistingVideo[]; next: number }>();
  for (const video of existing) {
    const bucket = byUrl.get(video.url) ?? { rows: [], next: 0 };
    bucket.rows.push(video);
    byUrl.set(video.url, bucket);
  }
  const retained = new Set<number>();
  const changes: {
    url: string;
    sortOrder: number;
    video?: ExistingVideo;
    filename: string | null;
  }[] = [];
  for (let sortOrder = 0; sortOrder < urls.length; sortOrder++) {
    const url = urls[sortOrder]?.trim();
    if (!url) continue;
    const bucket = byUrl.get(url);
    const video = bucket?.rows[bucket.next++];
    let decoded = url;
    try {
      decoded = decodeURIComponent(url);
    } catch {
      /* Existing filename validation below still applies. */
    }
    if (
      !video &&
      /(?:\/api\/media\/post-attachments(?:\/|$)|(?:^|\/)content\/private-v1(?:\/|$))/.test(
        decoded,
      )
    )
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Закрытое видео требует загруженного assetId",
      });
    if (video) retained.add(video.id);
    // Decode only new filenames, before mutating rows; retained metadata is
    // authoritative, including filenames that cannot be derived from the URL.
    const filename = video
      ? null
      : decodeURIComponent(url.split("/").pop()?.split("?")[0] || "") || null;
    changes.push({ url, sortOrder, video, filename });
  }
  const removedIds = existing
    // Private videos are removed only by the explicit, receipt-checked path.
    .filter(
      (video) =>
        !retained.has(video.id) && video.url !== privateMediaUrl(video.id),
    )
    .map((video) => video.id);
  if (removedIds.length)
    await writer
      .delete(postMedia)
      .where(
        and(
          eq(postMedia.postId, postId),
          eq(postMedia.type, "video"),
          inArray(postMedia.id, removedIds),
        ),
      );
  for (const { url, sortOrder, video, filename } of changes) {
    const posterUrl = posters.get(url);
    if (video) {
      const update = {
        ...(video.sortOrder !== sortOrder ? { sortOrder } : {}),
        ...(!video.posterUrl && posterUrl ? { posterUrl } : {}),
      };
      if (Object.keys(update).length)
        await writer
          .update(postMedia)
          .set(update)
          .where(
            and(
              eq(postMedia.postId, postId),
              eq(postMedia.type, "video"),
              eq(postMedia.id, video.id),
            ),
          );
    } else {
      // A URL (even one ending in .mp4) does not prove the media's MIME type.
      await writer.insert(postMedia).values({
        postId,
        type: "video",
        url,
        ...(posterUrl ? { posterUrl } : {}),
        filename,
        mimeType: null,
        sortOrder,
      });
    }
  }
}
