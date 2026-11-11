import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { openListPageFixture } from "./helpers/list-page-fixture";
import * as mediaRepository from "../apps/backend/src/content/post-media-repository";

/** Проверяет единый read snapshot карточки и вложений, чтобы следующая закрытая версия не попала в прежний открытый ответ. */
describe.skipIf(!testDatabaseUrl)(
  "post and media share one HTTP read snapshot",
  () => {
    let fixture: Awaited<ReturnType<typeof openListPageFixture>>;
    const base = 946000;
    let postId: number;
    const originalUrl = "https://fixture.invalid/public-before.mp4";
    const privateUrl = "https://fixture.invalid/club-after.mp4";
    /** Создаёт отдельную HTTP/JWT page-фикстуру. */
    beforeAll(async () => {
      fixture = await openListPageFixture("post-read-snapshot", base);
    });
    /** Восстанавливает both-пост, подписку, сохранение и исходный видеофайл. */
    beforeEach(async () => {
      await fixture.reset();
      postId = await fixture.post(0, "both");
      await fixture.grant();
      await fixture.conn.query(
        "INSERT INTO saved_posts(userId,postId) VALUES(?,?)",
        [base, postId],
      );
      await fixture.conn.query(
        "INSERT INTO post_media(postId,type,url,filename) VALUES(?,'video',?,'before.mp4')",
        [postId, originalUrl],
      );
    });
    /** Восстанавливает перехваченный attachPostMedia после каждого сценария. */
    afterEach(() => vi.restoreAllMocks());
    /** Закрывает API и удаляет собственные данные фикстуры. */
    afterAll(async () => {
      await fixture?.close();
    });

    /** Между чтениями коммитит закрытую ревизию и требует старую согласованную пару в текущем ответе и новые права в следующем. */
    it.each([
      { path: "feed.list", input: {}, actor: null, shape: "list" },
      {
        path: "feed.listPaginated",
        input: { limit: 2 },
        actor: null,
        shape: "page",
      },
      {
        path: "feed.getById",
        input: { id: base + 100 },
        actor: null,
        shape: "detail",
      },
      { path: "feed.savedPosts", input: {}, actor: 0, shape: "list" },
      { path: "club.list", input: { limit: 2 }, actor: 0, shape: "page" },
      {
        path: "club.listByCategory",
        input: { limit: 2 },
        actor: 0,
        shape: "page",
      },
    ])(
      "does not attach the next private revision to the previous card in $path",
      async ({ path, input, actor, shape }) => {
        const original = mediaRepository.attachPostMedia;
        // Пауза только на границе двух чтений. Сам HTTP, JWT, SELECT и конкурентная
        // транзакция редактора настоящие; внешние файлы не запрашиваются.
        vi.spyOn(mediaRepository, "attachPostMedia").mockImplementationOnce(
          async (database, rows) => {
            await fixture.conn.beginTransaction();
            try {
              await fixture.conn.query(
                "UPDATE posts SET target='club',text='Private next revision' WHERE id=?",
                [postId],
              );
              await fixture.conn.query(
                "UPDATE post_media SET url=?,filename='private-after.mp4' WHERE postId=?",
                [privateUrl, postId],
              );
              await fixture.conn.commit();
            } catch (error) {
              await fixture.conn.rollback();
              throw error;
            }
            return original(database, rows);
          },
        );
        const result = await fixture.read(path, input, actor);
        expect(result.status).toBe(200);
        const payload = result.data as unknown;
        const rows = (
          shape === "list"
            ? payload
            : shape === "page"
              ? (payload as { posts: unknown[] }).posts
              : [payload]
        ) as Array<{
          id: number;
          text: string;
          target: string;
          media: { url: string; filename: string }[];
        }>;
        const post = rows.find((row) => row.id === postId);
        expect(post).toMatchObject({
          text: "Post 0",
          target: "both",
          media: [{ url: originalUrl, filename: "before.mp4" }],
        });
        expect(JSON.stringify(payload)).not.toContain(privateUrl);
        // Следующий запрос уже видит новые права и новую версию, а не вечный кеш.
        expect(
          (await fixture.read("feed.getById", { id: postId }, null)).data,
        ).toBeNull();
        const current = await fixture.read("feed.getById", { id: postId }, 0);
        expect(current.status).toBe(200);
        expect(current.data).toMatchObject({
          text: "Private next revision",
          target: "club",
          media: [{ url: privateUrl }],
        });
      },
    );
  },
);
