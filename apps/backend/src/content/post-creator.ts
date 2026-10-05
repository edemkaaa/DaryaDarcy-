import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  posts,
  type InsertPost,
} from "../../../../packages/database/src/schema";
import { replacePostVideoRows } from "./post-videos";
import {
  savePostAttachments,
  type PostAttachmentChanges,
} from "./post-attachments";

/** Return the new ID only after the post and its initial videos have committed. */
export async function createPostWithVideos(
  database: MySql2Database,
  data: InsertPost,
  videos: string[],
  attachments: PostAttachmentChanges = {},
): Promise<number> {
  return database.transaction(async (tx) => {
    const [result] = await tx.insert(posts).values(data);
    const postId = Number(result.insertId);
    if (videos.length > 0) await replacePostVideoRows(tx, postId, videos);
    await savePostAttachments(tx, postId, attachments);
    return postId;
  });
}
