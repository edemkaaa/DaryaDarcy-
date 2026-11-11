import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import type { AppRouter } from "../apps/backend/src/routers";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import { getDb } from "../apps/backend/src/db";
import { assertTestDatabase } from "../tooling/scripts/test-database-policy";

const uri = process.env.CLUB_ORDER_DATABASE_URL;
const expectedClub = [98313, 98312, 98311, 98314, 98315, 98310];
const paymentOrder = "owned-club-order-access";

// Real HTTP/JWT and canonical MySQL; no uploads, external effects or app workers.
/** Разделяет пользовательскую хронологию Клуба и ручной порядок админки на настоящем HTTP и мигрированной MySQL. */
describe.skipIf(!uri)(
  "club chronological pages preserve independent admin ordering",
  () => {
    let conn: Connection, app: INestApplication, base: string;
    let admin: ReturnType<typeof createTRPCProxyClient<AppRouter>>;
    let member: ReturnType<typeof createTRPCProxyClient<AppRouter>>;
    let guest: ReturnType<typeof createTRPCProxyClient<AppRouter>>;
    /** Читает контрольное состояние схемы и тестовых строк напрямую через отдельное UTC-соединение. */
    async function rows(query: string, args: unknown[] = []) {
      return (await conn.query<RowDataPacket[]>(query, args))[0];
    }
    /** Создаёт tRPC-клиент выбранного участника, администратора или гостя. */
    function client(token?: string) {
      return createTRPCProxyClient<AppRouter>({
        links: [
          httpLink({
            url: base + "/api/trpc",
            transformer: superjson,
            headers: token ? { authorization: `Bearer ${token}` } : {},
          }),
        ],
      });
    }
    /** Удаляет только диапазон собственных публикаций, вложения и синтетический период доступа. */
    async function clearPosts() {
      await conn.query(
        "DELETE FROM post_media WHERE postId BETWEEN 98310 AND 98321",
      );
      await conn.query("DELETE FROM posts WHERE id BETWEEN 98310 AND 98321");
      await conn.query("DELETE FROM club_payments WHERE orderId=?", [
        paymentOrder,
      ]);
    }
    /** Проверяет тестовый URL и историю миграций, создаёт двух собственных пользователей и локальный API. */
    beforeAll(async () => {
      assertTestDatabase(uri!);
      conn = await mysql.createConnection({ uri: uri!, timezone: "Z" });
      await conn.query("SET time_zone='+00:00'");
      expect(
        Number(
          (await rows("SELECT COUNT(*) n FROM __drizzle_migrations"))[0].n,
        ),
      ).toBe(52);
      expect(
        await rows("SELECT id FROM users WHERE id IN (98301,98302)"),
      ).toHaveLength(0);
      for (const [key, value] of Object.entries({
        DATABASE_URL: uri!,
        JWT_SECRET: "owned-club-order-fixture-session-secret",
        PUBLIC_APP_URL: "https://fixture.example.test",
      }))
        vi.stubEnv(key, value);
      await conn.query(
        "INSERT INTO users(id,openId,role) VALUES(98301,'owned-order-admin','admin'),(98302,'owned-order-member','user')",
      );
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
      admin = client(
        await sdk.createSessionToken("owned-order-admin", {
          sessionVersion: 0,
        }),
      );
      member = client(
        await sdk.createSessionToken("owned-order-member", {
          sessionVersion: 0,
        }),
      );
      guest = client();
    });
    /** Восстанавливает доступ аккаунтов и набор публикаций с расходящимися sortOrder, publishedAt, createdAt и статусами. */
    beforeEach(async () => {
      await clearPosts();
      await conn.query(
        "UPDATE users SET blockedAt=NULL,sessionVersion=0 WHERE id IN (98301,98302)",
      );
      // id, manual/imported rank, publication date, creation date, target, visible, status, tags.
      const data = [
        [
          98310,
          1710604930,
          "2024-03-16 19:02:10",
          "2024-03-16 19:02:10",
          "club",
          1,
          "published",
          ["life", "winter"],
        ],
        [
          98311,
          1779791519,
          "2026-05-26 13:31:59",
          "2026-05-26 13:31:59",
          "club",
          1,
          "published",
          ["life", "winter"],
        ],
        [
          98312,
          0,
          null,
          "2026-06-17 00:00:00",
          "club",
          1,
          "published",
          ["life"],
        ],
        [
          98313,
          0,
          "2026-10-26 00:00:00",
          "2026-01-01 00:00:00",
          "club",
          1,
          "published",
          ["life", "winter"],
        ],
        [
          98314,
          -500,
          "2026-05-26 13:31:59",
          "2026-05-26 13:31:59",
          "club",
          1,
          "published",
          ["life", "winter"],
        ],
        [
          98315,
          0,
          "2026-04-01 00:00:00",
          "2026-10-27 00:00:00",
          "both",
          1,
          "published",
          ["life", "winter"],
        ],
        [
          98316,
          -900,
          "2027-01-01 00:00:00",
          "2027-01-01 00:00:00",
          "club",
          0,
          "scheduled",
          ["life", "winter"],
        ],
        [
          98317,
          -800,
          "2023-01-01 00:00:00",
          "2023-01-01 00:00:00",
          "feed",
          1,
          "published",
          ["life", "winter"],
        ],
        [
          98318,
          -700,
          "2027-01-01 00:00:00",
          "2027-01-01 00:00:00",
          "club",
          0,
          "draft",
          ["life", "winter"],
        ],
        [
          98319,
          -600,
          "2027-01-01 00:00:00",
          "2027-01-01 00:00:00",
          "club",
          1,
          "draft",
          ["life", "winter"],
        ],
      ];
      for (const [
        id,
        sort,
        publishedAt,
        createdAt,
        target,
        published,
        status,
        tags,
      ] of data) {
        await conn.query(
          "INSERT INTO posts(id,text,photos,tags,source,sortOrder,publishedAt,createdAt,target,published,status) VALUES(?,'Owned order fixture',JSON_ARRAY(),?,'audit-order',?,?,?,?,?,?)",
          [
            id,
            JSON.stringify(tags),
            sort,
            publishedAt,
            createdAt,
            target,
            published,
            status,
          ],
        );
      }
      await conn.query(
        "INSERT INTO post_media(id,postId,type,url,filename) VALUES(98311,98311,'document','https://fixture.invalid/owned.txt','owned.txt')",
      );
    });
    /** Закрывает API, удаляет свои публикации и пользователей и возвращает окружение. */
    afterAll(async () => {
      await app?.close();
      if (conn) {
        await clearPosts();
        await conn.query("DELETE FROM users WHERE id IN (98301,98302)");
        await conn.end();
      }
      await (
        (await getDb()) as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });

    /** Обе клубные процедуры сортируют до LIMIT по effective date и стабильному ID, игнорируя импортированные ранги. */
    it.each(["list", "listByCategory"] as const)(
      "orders %s by effective date before LIMIT, ignoring manual/timestamp ranks",
      async (route) => {
        const seen: number[] = [];
        let cursor: number | null = null;
        const cursors: (number | null)[] = [];
        do {
          const page: { posts: { id: number }[]; nextCursor: number | null } =
            await admin.club[route].query({
              limit: 2,
              ...(cursor === null ? {} : { cursor }),
            });
          seen.push(...page.posts.map((post) => post.id));
          cursor = page.nextCursor;
          cursors.push(cursor);
          expect(cursors.length).toBeLessThanOrEqual(3);
        } while (cursor !== null);
        expect(seen).toEqual(expectedClub);
        expect(cursors).toEqual([2, 4, null]);
        expect(new Set(seen).size).toBe(6);
      },
    );

    /** Равные даты упорядочиваются по возрастанию ID через границу страниц и при повторном чтении. */
    it("uses ascending IDs for equal dates across page boundaries and stable reloads", async () => {
      const first = await admin.club.listByCategory.query({ limit: 3 });
      const second = await admin.club.listByCategory.query({
        limit: 3,
        cursor: first.nextCursor!,
      });
      expect(first.posts.map((post) => post.id)).toEqual([98313, 98312, 98311]);
      expect(second.posts.map((post) => post.id)).toEqual([
        98314, 98315, 98310,
      ]);
      expect(second.nextCursor).toBe(null);
      expect(
        (await admin.club.listByCategory.query({ limit: 3 })).posts.map(
          (post) => post.id,
        ),
      ).toEqual([98313, 98312, 98311]);
    });

    /** Рубрика и нормализованный тег сезона фильтруются до хронологической пагинации. */
    it("filters rubric and board aliases before chronological pagination", async () => {
      await conn.query(
        "INSERT INTO posts(id,text,photos,tags,target,published,status,publishedAt) VALUES(98320,'Other category',JSON_ARRAY(),JSON_ARRAY('community','winter'),'club',1,'published','2027-01-01')",
      );
      const first = await admin.club.listByCategory.query({
        category: "life",
        tag: "ЗИМА",
        limit: 2,
      });
      const next = await admin.club.listByCategory.query({
        category: "life",
        tag: "winter",
        limit: 2,
        cursor: first.nextCursor!,
      });
      expect(first.posts.map((post) => post.id)).toEqual([98313, 98311]);
      expect(next.posts.map((post) => post.id)).toEqual([98314, 98315]);
      expect(
        (
          await admin.club.listByCategory.query({
            category: "life",
            tag: "winter",
            limit: 2,
            cursor: next.nextCursor!,
          })
        ).posts.map((post) => post.id),
      ).toEqual([98310]);
    });

    /** Админские списки и представитель дня календаря сохраняют прежний приоритет sortOrder. */
    it("preserves manual admin ordering and the calendar's representative card", async () => {
      const page = await admin.admin.postsPage.query({
        limit: 20,
        target: "club",
        status: "published",
      });
      expect(page.posts.map((post) => post.id)).toEqual([
        98314, 98313, 98312, 98310, 98311,
      ]);
      const all = await admin.admin.posts.query();
      expect(
        all
          .filter(
            (post) => post.target === "club" && post.status === "published",
          )
          .map((post) => post.id),
      ).toEqual([98314, 98313, 98312, 98310, 98311]);
      const calendar = await admin.admin.postCalendar.query({
        days: [{ from: "2026-05-26T00:00:00Z", to: "2026-05-27T00:00:00Z" }],
      });
      expect(calendar.days).toHaveLength(1);
      expect(calendar.days[0].id).toBe(98314);
      expect(calendar.days[0].total).toBe(2);
    });

    /** Публичная Лента сохраняет свой прежний порядок независимо от клубной хронологии. */
    it("preserves the existing feed ordering", async () => {
      expect(
        (await guest.feed.listPaginated.query({ limit: 20 })).posts.map(
          (post) => post.id,
        ),
      ).toEqual([98317, 98315]);
    });

    /** Каждая страница повторно проверяет сессию и актуальный paid-период, включая отзыв между страницами. */
    it("keeps membership and revocation checks on every page", async () => {
      await expect(
        guest.club.listByCategory.query({ limit: 2 }),
      ).rejects.toMatchObject({ data: { httpStatus: 401 } });
      await expect(
        member.club.listByCategory.query({ limit: 2 }),
      ).rejects.toMatchObject({ data: { httpStatus: 403 } });
      await conn.query(
        "INSERT INTO club_payments(userId,orderId,status,expiresAt) VALUES(98302,?,'paid','2037-01-01')",
        [paymentOrder],
      );
      expect(
        (await member.club.listByCategory.query({ limit: 2 })).posts.map(
          (post) => post.id,
        ),
      ).toEqual([98313, 98312]);
      await conn.query(
        "UPDATE club_payments SET expiresAt='2020-01-01' WHERE orderId=?",
        [paymentOrder],
      );
      await expect(
        member.club.listByCategory.query({ limit: 2, cursor: 2 }),
      ).rejects.toMatchObject({ data: { httpStatus: 403 } });
    });

    /** Чтение хронологических страниц не меняет исходные даты, ранги и привязки вложений. */
    it("leaves stored dates, ranks and attachments intact", async () => {
      const before = await rows(
        "SELECT id,sortOrder,publishedAt,createdAt FROM posts WHERE id BETWEEN 98310 AND 98321 ORDER BY id",
      );
      const page = await admin.club.listByCategory.query({ limit: 20 });
      expect(page.posts.map((post) => post.id)).toEqual(expectedClub);
      expect(
        await rows(
          "SELECT id,sortOrder,publishedAt,createdAt FROM posts WHERE id BETWEEN 98310 AND 98321 ORDER BY id",
        ),
      ).toEqual(before);
      expect(
        await rows("SELECT id,postId,url FROM post_media WHERE id=98311"),
      ).toEqual([
        { id: 98311, postId: 98311, url: "https://fixture.invalid/owned.txt" },
      ]);
    });
  },
);
