import { and, eq, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { TRPCError } from "@trpc/server";
import { postMedia } from "../../../../packages/database/src/schema";
import { sanitizePlainPostText } from "../../../../packages/shared/src/post-text-sanitize";

/** Validate the final body inside the caller's post-write transaction, after media changes. */
export async function assertPostHasBody(
  writer: Pick<MySql2Database, "select">,
  postId: number,
  text: string,
  photos: string[],
): Promise<void> {
  if (sanitizePlainPostText(text) || photos.some((url) => url.trim())) return;
  const [media] = await writer
    .select({ id: postMedia.id })
    .from(postMedia)
    .where(
      and(
        eq(postMedia.postId, postId),
        sql`LENGTH(TRIM(${postMedia.url})) > 0`,
      ),
    )
    .limit(1);
  if (!media)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Добавьте текст, фото, видео, аудио или документ",
    });
}
