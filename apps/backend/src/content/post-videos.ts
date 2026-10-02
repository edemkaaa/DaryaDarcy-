import { and, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { postMedia } from "../../../../packages/database/src/schema";

type VideoWriter = Pick<MySql2Database, "delete" | "insert">;

/** Use the caller's transaction when video replacement is part of a post save. */
export async function replacePostVideoRows(
  writer: VideoWriter,
  postId: number,
  urls: string[],
): Promise<void> {
  await writer
    .delete(postMedia)
    .where(and(eq(postMedia.postId, postId), eq(postMedia.type, "video")));
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]?.trim();
    if (!url) continue;
    const filename =
      decodeURIComponent(url.split("/").pop()?.split("?")[0] || "") || null;
    await writer.insert(postMedia).values({
      postId,
      type: "video",
      url,
      filename,
      mimeType: "video/mp4",
      sortOrder: i,
    });
  }
}
