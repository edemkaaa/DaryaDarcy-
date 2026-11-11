import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mysql from "mysql2/promise";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { openContentTestDatabase } from "./helpers/content-mysql";
import { savePostEdit } from "../apps/backend/src/content/post-editor";
import { createPostWithVideos } from "../apps/backend/src/content/post-creator";

const first = "https://assets.example.test/first.webm";
const second = "https://assets.example.test/second.mov";
const added = "https://assets.example.test/new%20lesson.webm";
/** Проверяет reconciliation списка видео без пересоздания retained-строк и потери метаданных. */
describe.skipIf(!testDatabaseUrl)(
  "post video identity on disposable MySQL",
  () => {
    let conn: mysql.Connection;
    let pool: mysql.Pool;
    let database: MySql2Database;
    let createdPostId: number | undefined;
    let locked = false;
    /** Удаляет только два фиксированных поста и созданный в suite пост с их media. */
    async function cleanup() {
      const ids = [
        11501,
        11502,
        ...(createdPostId === undefined ? [] : [createdPostId]),
      ];
      await conn.query("DELETE FROM post_media WHERE postId IN (?)", [ids]);
      await conn.query("DELETE FROM posts WHERE id IN (?)", [ids]);
      createdPostId = undefined;
    }
    /** Открывает content-схему и получает именованный lock диапазона видеофикстур до создания собственного пула. */
    beforeAll(async () => {
      conn = await openContentTestDatabase();
      const [locks] = await conn.query<mysql.RowDataPacket[]>(
        "SELECT GET_LOCK('backend_test_video_reconciliation',30) AS acquired",
      );
      locked = locks[0]?.acquired === 1;
      if (!locked) throw new Error("Video fixture lock unavailable");
      pool = mysql.createPool({ uri: testDatabaseUrl!, timezone: "Z" });
      database = drizzle(pool);
    }, 35_000);
    /** Восстанавливает два черновика и видео, аудио, документ с различающимися метаданными. */
    beforeEach(async () => {
      await cleanup();
      await conn.query(`INSERT INTO posts (id,text,photos,tags,status,published,target) VALUES
      (11501,'Original text','[]','[]','draft',FALSE,'feed'),
      (11502,'Other post','[]','[]','draft',FALSE,'feed')`);
      await conn.query(
        `INSERT INTO post_media
      (id,postId,type,url,filename,mimeType,fileSize,duration,sortOrder,createdAt) VALUES
      (11511,11501,'video',?,'Original title.webm','video/webm',123456,72,0,'2026-01-01 00:00:00'),
      (11512,11501,'video',?,'Original title.mov','video/quicktime',654321,94,1,'2026-01-02 00:00:00'),
      (11513,11501,'audio','https://assets.example.test/first.webm','Audio title','audio/mpeg',123,12,2,'2026-01-03 00:00:00'),
      (11514,11501,'document','https://assets.example.test/guide.pdf','Guide.pdf','application/pdf',456,NULL,3,'2026-01-04 00:00:00'),
      (11515,11502,'video',?,'Other title','video/webm',789,80,0,'2026-01-05 00:00:00')`,
        [first, second, first],
      );
    });
    /** Закрывает пул и только при собственном lock очищает фикстуру и освобождает блокировку. */
    afterAll(async () => {
      await pool?.end();
      if (locked) {
        await cleanup();
        await conn.query(
          "SELECT RELEASE_LOCK('backend_test_video_reconciliation')",
        );
      }
      await conn?.end();
    });
    /** Читает все media двух тестовых постов с полными колонками в стабильном порядке ID. */
    async function media() {
      const [rows] = await conn.query<mysql.RowDataPacket[]>(
        "SELECT * FROM post_media WHERE postId IN (11501,11502) ORDER BY id",
      );
      return rows;
    }
    /** Возвращает посты и media вместе для точного сравнения полного отката. */
    async function snapshot() {
      const [posts] = await conn.query<mysql.RowDataPacket[]>(
        "SELECT * FROM posts WHERE id IN (11501,11502) ORDER BY id",
      );
      return { posts, media: await media() };
    }
    /** Неизменный список видео сохраняет все их поля при редактировании только текста поста. */
    it("preserves all video columns on an unchanged list", async () => {
      const before = await media();
      await savePostEdit(database, 11501, { text: "Edited text" }, [
        first,
        second,
      ]);
      expect(await media()).toEqual(before);
      expect((await snapshot()).posts[0].text).toBe("Edited text");
    });
    /** Добавление создаёт одну новую строку с decoded filename и неизвестными MIME/размером/длительностью, сохраняя прежние строки. */
    it("adds only the new video, preserving old IDs and all metadata", async () => {
      const before = await media();
      await savePostEdit(database, 11501, {}, [first, second, added]);
      const after = await media();
      expect(after.slice(0, 5)).toEqual(before);
      expect(after).toHaveLength(6);
      expect(after[5]).toMatchObject({
        postId: 11501,
        type: "video",
        url: added,
        filename: "new lesson.webm",
        mimeType: null,
        fileSize: null,
        duration: null,
        sortOrder: 2,
      });
    });
    /** Удаляется только исключённое видео выбранного поста, остальные виды media и соседний пост сохраняются. */
    it("removes only the excluded video, preserving audio/documents/other posts", async () => {
      const before = await media();
      await savePostEdit(database, 11501, {}, [first]);
      expect(await media()).toEqual(before.filter((row) => row.id !== 11512));
    });
    /** Перестановка меняет только sortOrder retained-видео, сохраняя ID и метаданные. */
    it("reorders without changing IDs or other video columns", async () => {
      const before = await media();
      await savePostEdit(database, 11501, {}, [second, first]);
      expect(await media()).toEqual(
        before.map((row) =>
          row.id === 11511
            ? { ...row, sortOrder: 1 }
            : row.id === 11512
              ? { ...row, sortOrder: 0 }
              : row,
        ),
      );
    });
    /** Отсутствующее поле videos означает сохранить прежний список без изменений. */
    it("leaves all media untouched when videos is omitted", async () => {
      const before = await media();
      await savePostEdit(database, 11501, { text: "Only text" });
      expect(await media()).toEqual(before);
    });
    /** Явный пустой videos удаляет только видео выбранного поста. */
    it("clears only this post's videos on an explicit empty list", async () => {
      const before = await media();
      await savePostEdit(database, 11501, {}, []);
      expect(await media()).toEqual(
        before.filter((row) => row.id !== 11511 && row.id !== 11512),
      );
    });
    /** Одинаковые URL учитываются как отдельные вхождения; сокращение списка убирает лишь лишнюю строку. */
    it("preserves duplicate URL occurrences and removes only the surplus row", async () => {
      await conn.query("UPDATE post_media SET url=? WHERE id=11512", [first]);
      const before = await media();
      await savePostEdit(database, 11501, {}, [first, first]);
      expect(await media()).toEqual(before);
      await savePostEdit(database, 11501, {}, [first]);
      expect(await media()).toEqual(before.filter((row) => row.id !== 11512));
    });
    /** Недопустимое удаление media чужого поста откатывает текст, удаление, перестановку и добавление видео. */
    it("rolls back text, deletion, reorder and new rows when the final attachment save fails", async () => {
      const before = await snapshot();
      await expect(
        savePostEdit(
          database,
          11501,
          { text: "Must roll back" },
          [second, added],
          { removedMediaIds: [11515] },
        ),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(await snapshot()).toEqual(before);
    });
    /** Некорректный percent-encoding нового filename откатывает все изменения поста и вложений. */
    it("rolls back the post when a new video's filename cannot be decoded", async () => {
      const before = await snapshot();
      await expect(
        savePostEdit(database, 11501, { text: "Must roll back" }, [
          second,
          "https://assets.example.test/%broken.mov",
        ]),
      ).rejects.toThrow();
      expect(await snapshot()).toEqual(before);
    });
    /** Создание поста тоже не угадывает MIME, размер или длительность из расширения URL. */
    it("stores unknown MIME for new videos during post creation too", async () => {
      createdPostId = await createPostWithVideos(
        database,
        {
          text: "Created",
          photos: [],
          tags: [],
          status: "draft",
          published: false,
        },
        [added],
      );
      const [rows] = await conn.query<mysql.RowDataPacket[]>(
        "SELECT * FROM post_media WHERE postId=?",
        [createdPostId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        url: added,
        filename: "new lesson.webm",
        mimeType: null,
        fileSize: null,
        duration: null,
      });
    });
  },
);
