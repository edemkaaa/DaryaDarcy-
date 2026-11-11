import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { openContentTestDatabase } from "./helpers/content-mysql";
import { deletePost, getDb } from "../apps/backend/src/db";
import { addPostCommentV2, deletePostCommentV2, toggleCommentLike, reportComment, updatePostCommentV2 } from "../apps/backend/src/content/comments";

/** Проверяет атомарность комментариев, ответов, лайков и жалоб при удалении и конкуренции. */
describe.skipIf(!testDatabaseUrl)("atomic comment mutations on disposable MySQL", () => {
  let conn: Connection;
  /** Открывает одноразовую content-схему и направляет прикладной пул только в неё. */
  beforeAll(async () => { conn = await openContentTestDatabase(); vi.stubEnv("DATABASE_URL", testDatabaseUrl!); });
  /** Удаляет только комментарии, реакции и посты собственных диапазонов, включая проверки отсутствующих ID. */
  async function clearFixture() {
    await conn.query("DELETE FROM comment_likes WHERE commentId=9051");
    await conn.query("DELETE FROM comment_likes WHERE commentId=999999 AND userId=787");
    await conn.query("DELETE FROM comment_reports WHERE commentId=9051");
    await conn.query("DELETE FROM post_comments WHERE postId BETWEEN 9050 AND 9059");
    await conn.query("DELETE FROM post_comments WHERE postId=999999 AND userId=786");
    await conn.query("DELETE FROM posts WHERE id BETWEEN 9050 AND 9059");
  }
  /** Восстанавливает два открытых поста, авторский комментарий, лайк и жалобу. */
  beforeEach(async () => {
    await clearFixture();
    await conn.query("INSERT INTO posts (id,text,photos,tags,status,target) VALUES (9050,'discussion',JSON_ARRAY(),JSON_ARRAY('community'),'published','feed'),(9052,'other post',JSON_ARRAY(),JSON_ARRAY('community'),'published','feed')");
    await conn.query("INSERT INTO post_comments (id,postId,userId,text) VALUES (9051,9050,785,'owner comment')");
    await conn.query("INSERT INTO comment_likes (userId,commentId) VALUES (786,9051)");
    await conn.query("INSERT INTO comment_reports (commentId,reporterUserId,reason) VALUES (9051,786,'test report')");
  });
  /** Даже при ошибке очистки закрывает оба соединения и восстанавливает окружение. */
  afterAll(async () => {
    try {
      if (conn) await clearFixture();
    } finally {
      await conn?.end();
      const database = await getDb(); await (database as unknown as { $client: { end(): Promise<void> } })?.$client.end();
      vi.unstubAllEnvs();
    }
  });
  /** Считает записи конкретного комментария в одной из трёх разрешённых таблиц. */
  async function related(table: "post_comments" | "comment_likes" | "comment_reports") {
    const [rows] = await conn.query<RowDataPacket[]>(`SELECT COUNT(*) n FROM ${table} WHERE ${table === "post_comments" ? "id" : "commentId"}=9051`);
    return rows[0].n;
  }
  /** Чужое удаление отклоняется до удаления комментария, лайков и жалоб. */
  it("rejects a foreign deletion before removing any associated likes or reports", async () => {
    await expect(deletePostCommentV2(9051, 786)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await related("post_comments")).toBe(1); expect(await related("comment_likes")).toBe(1); expect(await related("comment_reports")).toBe(1);
  });
  /** Автор удаляет свой комментарий и его реакции; ответы сохраняются с пустым parentId. */
  it("deletes the owner's comment and all associated records, retaining newer replies", async () => {
    const childId = await addPostCommentV2({ postId: 9050, userId: 786, text: "reply", parentId: 9051 });
    await deletePostCommentV2(9051, 785);
    expect(await related("post_comments")).toBe(0); expect(await related("comment_likes")).toBe(0); expect(await related("comment_reports")).toBe(0);
    const [rows] = await conn.query<RowDataPacket[]>("SELECT parentId FROM post_comments WHERE id=?", [childId]);
    expect(rows[0].parentId).toBeNull();
  });
  /** Ответ не создаётся для несуществующего родителя. */
  it("rejects a reply to a missing parent", async () => {
    await expect(addPostCommentV2({ postId: 9050, userId: 786, text: "reply", parentId: 999999 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  /** Нельзя привязать ответ к комментарию другого поста. */
  it("rejects a parent from a different post", async () => {
    await expect(addPostCommentV2({ postId: 9052, userId: 786, text: "reply", parentId: 9051 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  /** Десять конкурентных переключений лайка сериализуются, чередуют состояние и не оставляют дубликаты. */
  it("serializes simultaneous like toggles without duplicate rows", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => toggleCommentLike(787, 9051)));
    expect(results.filter(result => result.liked)).toHaveLength(5);
    const [rows] = await conn.query<RowDataPacket[]>("SELECT COUNT(*) n FROM comment_likes WHERE commentId=9051 AND userId=787");
    expect(rows[0].n).toBe(0);
  });
  /** Лайк отсутствующего комментария даёт NOT_FOUND без осиротевшей строки. */
  it("does not create a like for a deleted/missing comment", async () => {
    await expect(toggleCommentLike(787, 999999)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const [rows] = await conn.query<RowDataPacket[]>("SELECT COUNT(*) n FROM comment_likes WHERE commentId=999999");
    expect(rows[0].n).toBe(0);
  });
  /** Конкуренция удаления и ответа не оставляет parentId, указывающий на отсутствующий комментарий. */
  it("serializes deletion with a reply, leaving no dangling parent", async () => {
    const results = await Promise.allSettled([deletePostCommentV2(9051, 785), addPostCommentV2({ postId: 9050, userId: 786, text: "reply", parentId: 9051 })]);
    expect(results[0].status).toBe("fulfilled");
    const [rows] = await conn.query<RowDataPacket[]>("SELECT COUNT(*) n FROM post_comments c LEFT JOIN post_comments p ON c.parentId=p.id WHERE c.postId=9050 AND c.parentId IS NOT NULL AND p.id IS NULL");
    expect(rows[0].n).toBe(0);
  });
  /** Чужое редактирование и жалоба на отсутствующий комментарий возвращают явный отказ. */
  it("refuses foreign edits and missing reports without claiming success", async () => {
    await expect(updatePostCommentV2(9051, 786, "foreign edit")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(reportComment(999999, 786, "report")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  /** Удаление одновременно с лайком и жалобой не оставляет зависимых строк. */
  it("serializes deletion with likes and reports, leaving no orphan associations", async () => {
    const results = await Promise.allSettled([deletePostCommentV2(9051, 785), toggleCommentLike(787, 9051), reportComment(9051, 787, "test report")]);
    expect(results[0].status).toBe("fulfilled");
    expect(await related("post_comments")).toBe(0); expect(await related("comment_likes")).toBe(0); expect(await related("comment_reports")).toBe(0);
  });
  /** Корневой комментарий не создаётся к отсутствующему посту или черновику. */
  it("does not add a root comment to a missing or hidden post", async () => {
    await expect(addPostCommentV2({ postId: 999999, userId: 786, text: "root" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await conn.query("UPDATE posts SET status='draft' WHERE id=9050");
    await expect(addPostCommentV2({ postId: 9050, userId: 786, text: "root" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  /** Удаление поста коммитит удаление комментариев, лайков и жалоб вместе. */
  it("deletes a post with its comment associations in one transaction", async () => {
    await deletePost(9050);
    expect(await related("post_comments")).toBe(0); expect(await related("comment_likes")).toBe(0); expect(await related("comment_reports")).toBe(0);
  });
  /** Триггер отказа на жалобах откатывает весь каскад и сам пост; finally удаляет триггер. */
  it("rolls back a post deletion if related-record cleanup fails", async () => {
    await conn.query("CREATE TRIGGER backend_test_comment_report_delete BEFORE DELETE ON comment_reports FOR EACH ROW BEGIN IF OLD.commentId=9051 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Test cleanup failure'; END IF; END");
    try {
      await expect(deletePost(9050)).rejects.toThrow();
      expect(await related("post_comments")).toBe(1); expect(await related("comment_likes")).toBe(1); expect(await related("comment_reports")).toBe(1);
      const [rows] = await conn.query<RowDataPacket[]>("SELECT id FROM posts WHERE id=9050"); expect(rows).toHaveLength(1);
    } finally { await conn.query("DROP TRIGGER backend_test_comment_report_delete"); }
  });
  /** Конкурентный корневой комментарий не переживает успешно удалённый пост. */
  it("serializes post deletion with new root comments", async () => {
    const results = await Promise.allSettled([deletePost(9050), addPostCommentV2({ postId: 9050, userId: 786, text: "root" })]);
    expect(results[0].status).toBe("fulfilled");
    const [rows] = await conn.query<RowDataPacket[]>("SELECT id FROM post_comments WHERE postId=9050"); expect(rows).toEqual([]);
  });
});
