/** Проверяем переход публикации в опубликованное состояние и связанные с ним правила записи. */
import { eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { posts, type Post } from "../../../../packages/database/src/schema";
import { assertContentWriteActor, type ContentWriteActor } from "./content-write-actor";

export type PostPublication = Pick<Post, "id" | "text" | "target">;

/** Return an announcement only for this call's committed visibility transition. */
/** Блокируем текущий пост после исполнителя и публикуем лишь при реальном изменении видимости; один победивший вызов получает данные уведомления, повтор не дублирует его. */
export async function confirmPostPublication(
  database: MySql2Database,
  postId: number,
  actor?: ContentWriteActor,
): Promise<PostPublication | undefined> {
  return database.transaction(async (tx) => {
    await assertContentWriteActor(tx,actor);
    const [post] = await tx
      .select({
        id: posts.id,
        text: posts.text,
        target: posts.target,
        status: posts.status,
        published: posts.published,
      })
      .from(posts)
      .where(eq(posts.id, postId))
      .for("update");
    if (!post)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Публикация не найдена",
      });
    if (post.status === "published" && post.published) return undefined;

    await tx
      .update(posts)
      .set({
        status: "published",
        published: true,
        // Manual confirmation means now, even before the scheduled date.
        publishedAt: sql`COALESCE(${posts.publishedAt}, UTC_TIMESTAMP())`,
      })
      .where(eq(posts.id, postId));

    return { id: post.id, text: post.text, target: post.target };
  });
}
