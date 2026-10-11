import { expect, it } from "vitest";
import { expect as browserExpect, type BrowserContext } from "@playwright/test";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { hashPassword } from "../../apps/backend/src/_core/password";
import { COOKIE_NAME } from "../../packages/shared/src/const";
import { sdk } from "../../apps/backend/src/_core/sdk";

interface PostInteractionsBrowserFixture {
  rows(sql: string, args?: unknown[]): Promise<RowDataPacket[]>;
  connection: Pick<Connection, "query">;
  context: BrowserContext;
  frontend: string;
  base: string;
  actorId: number;
  memberId: number;
}

export function registerPostInteractionsBrowserCases(
  fixture: () => PostInteractionsBrowserFixture,
) {
  it.each([
    "feed",
    "club",
    "club section",
    "club retry",
    "feed retry",
  ] as const)(
    "C3 paginates the native %s without duplicates or ineligible rows",
    async (target) => {
      const section = target === "club section";
      const retry = target === "club retry" || target === "feed retry";
      const route =
        target === "feed" || target === "feed retry" ? "feed" : "club";
      const errorMessage =
        route === "feed"
          ? "Не удалось загрузить следующие публикации ленты"
          : "Не удалось загрузить следующие публикации клуба";
      const { rows, connection, context, frontend, memberId, base } = fixture();
      const ids = Array.from({ length: 17 }, (_, index) => 94701 + index);
      try {
        await connection.query(`CREATE TABLE IF NOT EXISTS tags (
        id INT AUTO_INCREMENT PRIMARY KEY,slug VARCHAR(64) NOT NULL UNIQUE,
        label VARCHAR(128) NOT NULL,category ENUM('season','topic') NOT NULL DEFAULT 'topic',
        sortOrder INT NOT NULL DEFAULT 0
      ) ENGINE=InnoDB`);
        for (const [index, id] of ids.entries()) {
          await connection.query(
            "INSERT INTO posts (id,text,photos,tags,status,published,target,sortOrder,createdAt,publishedAt) VALUES (?,?,'[]',?, ?,1,?,?,'2026-01-01','2026-01-01')",
            [
              id,
              `C3 pager ${index + 1} fixture`,
              JSON.stringify(
                section
                  ? [
                      index < 12
                        ? "life"
                        : (["letter", "podcast", "эксклюзив"][index - 12] ??
                          "exclusive"),
                    ]
                  : [],
              ),
              index === 16 ? "draft" : "published",
              index === 15 ? (route === "feed" ? "club" : "feed") : route,
              index,
            ],
          );
        }
        const snapshotSql =
          "SELECT id,text,tags,status,published,target FROM posts WHERE id BETWEEN 94701 AND 94717 ORDER BY id";
        const before = await rows(snapshotSql);
        await context.clearCookies();
        if (route === "club") {
          // Local access fixture only; no checkout or provider payment is invoked.
          await connection.query(
            "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'c3-pager-access','paid','0','2030-01-01')",
            [memberId],
          );
          await context.addCookies([
            {
              name: COOKIE_NAME,
              value: await sdk.createSessionToken("binding-browser-member", {
                sessionVersion: 0,
              }),
              url: frontend,
              httpOnly: true,
              sameSite: "Lax",
            },
          ]);
        }
        const access = await rows(
          "SELECT * FROM club_payments WHERE userId=? ORDER BY id",
          [memberId],
        );
        const page = await context.newPage();
        const isPage = (url: string) =>
          url.includes(route === "feed" ? "feed.listPaginated" : "club.list");
        const firstResponse = page.waitForResponse((response) =>
          isPage(response.url()),
        );
        await page.goto(frontend + route);
        const first = await firstResponse;
        expect(first.status()).toBe(200);
        const payload = async (response: typeof first) => {
          const body = await response.json();
          const entries = Array.isArray(body) ? body : [body];
          return entries
            .map((entry) => entry.result?.data?.json)
            .find((data) => Array.isArray(data?.posts)) as {
            posts: { id: number }[];
            nextCursor: number | null;
          };
        };
        const initial = await payload(first);
        expect(initial.posts.map((post) => post.id)).toEqual(ids.slice(0, 12));
        expect(initial.nextCursor).toBe(12);
        if (route === "club") {
          const setup = page.getByRole("dialog", {
            name: "Настройка профиля клуба",
          });
          await browserExpect(setup).toBeVisible();
          await setup
            .getByRole("button", {
              name: "Закрыть настройку профиля",
              exact: true,
            })
            .click();
          await browserExpect(setup).toHaveCount(0);
        }
        await browserExpect(
          page.getByText("C3 pager 1 fixture", { exact: true }),
        ).toBeVisible();
        // Scroll the actual windowed collection to its tail; no synthetic API reads.
        const collection = page.locator("[data-windowed-collection]:visible");
        await browserExpect(collection).toHaveCount(1);
        const isNext = (url: string) =>
          isPage(url) && decodeURIComponent(url).includes('"cursor":12');
        if (retry) {
          let loseReply = true;
          const lostPages: number[][] = [];
          // Read the actual API/SQL, then lose only its return transport.
          await page.route("**/api/trpc/*", async (faultRoute) => {
            const url = new URL(faultRoute.request().url());
            if (!isNext(url.href)) return faultRoute.fallback();
            const response = await faultRoute.fetch({
              url: base + url.pathname + url.search,
              maxRedirects: 0,
            });
            expect(response.status()).toBe(200);
            if (loseReply) {
              const body = await response.json();
              const entries = Array.isArray(body) ? body : [body];
              const data = entries
                .map((entry) => entry.result?.data?.json)
                .find((data) => Array.isArray(data?.posts));
              expect(data.nextCursor).toBeNull();
              lostPages.push(data.posts.map((post: { id: number }) => post.id));
              return faultRoute.abort("failed");
            }
            return faultRoute.fulfill({ response });
          });
          await collection.evaluate((element) => {
            element.scrollTop = element.scrollHeight;
          });
          const error = page.getByRole("alert").filter({
            hasText: errorMessage,
          });
          await browserExpect(error).toBeVisible({ timeout: 15_000 });
          expect(lostPages.length).toBeGreaterThan(0);
          for (const idsOnPage of lostPages)
            expect(idsOnPage).toEqual(ids.slice(12, 15));
          await browserExpect(
            page.getByText("C3 pager 15 fixture", { exact: true }),
          ).toHaveCount(0);
          await collection.evaluate((element) => {
            element.scrollTop = 0;
          });
          await browserExpect(
            page.getByText("C3 pager 1 fixture", { exact: true }),
          ).toBeVisible();
          expect(await rows(snapshotSql)).toEqual(before);
          loseReply = false;
        }
        const [next] = await Promise.all([
          page.waitForResponse((response) => isNext(response.url())),
          retry
            ? page
                .getByRole("alert")
                .filter({
                  hasText: errorMessage,
                })
                .getByRole("button", { name: "Повторить", exact: true })
                .click()
            : section
              ? page
                  .getByRole("button", { name: "Эксклюзив", exact: true })
                  .click()
              : collection.evaluate((element) => {
                  element.scrollTop = element.scrollHeight;
                }),
        ]);
        expect(next.status()).toBe(200);
        const terminal = await payload(next);
        if (retry) {
          await browserExpect(
            page.getByRole("alert").filter({
              hasText: errorMessage,
            }),
          ).toHaveCount(0);
        }
        expect(terminal.posts.map((post) => post.id)).toEqual(
          ids.slice(12, 15),
        );
        expect(terminal.nextCursor).toBeNull();
        const all = [...initial.posts, ...terminal.posts].map(
          (post) => post.id,
        );
        expect(new Set(all).size).toBe(15);
        expect([...all].sort((a, b) => a - b)).toEqual(ids.slice(0, 15));
        await collection.evaluate((element) => {
          element.scrollTop = element.scrollHeight;
        });
        if (route === "feed") {
          await browserExpect(
            page.getByText("Все посты загружены", { exact: true }),
          ).toBeVisible();
        } else {
          await browserExpect(
            page.getByRole("button", { name: "Загрузить ещё", exact: true }),
          ).toHaveCount(0);
        }
        await browserExpect(
          page.getByText("C3 pager 15 fixture", { exact: true }),
        ).toBeVisible();
        if (section) {
          const exclusive = page.getByRole("button", {
            name: "Эксклюзив",
            exact: true,
          });
          await browserExpect(exclusive).toHaveAttribute(
            "aria-pressed",
            "true",
          );
          for (const number of [13, 14, 15]) {
            await browserExpect(
              page.getByText(`C3 pager ${number} fixture`, { exact: true }),
            ).toHaveCount(1);
          }
          for (const number of [16, 17]) {
            await browserExpect(
              page.getByText(`C3 pager ${number} fixture`, { exact: true }),
            ).toHaveCount(0);
          }
          await browserExpect(
            page.getByText("C3 pager 1 fixture", { exact: true }),
          ).toHaveCount(0);
          // An exhausted empty rubric is distinct from an unchecked first page.
          const empty = page.getByRole("button", {
            name: "Подборки",
            exact: true,
          });
          await empty.click();
          await browserExpect(
            page.getByText("Пока нет публикаций в этом разделе", {
              exact: true,
            }),
          ).toBeVisible();
          await browserExpect(
            page.getByText("C3 pager 15 fixture", { exact: true }),
          ).toHaveCount(0);
          await empty.click();
          await browserExpect(empty).toHaveAttribute("aria-pressed", "false");
          await collection.evaluate((element) => {
            element.scrollTop = element.scrollHeight;
          });
          await browserExpect(
            page.getByText("C3 pager 15 fixture", { exact: true }),
          ).toBeVisible();
        }
        expect(await rows(snapshotSql)).toEqual(before);
        expect(
          await rows("SELECT * FROM club_payments WHERE userId=? ORDER BY id", [
            memberId,
          ]),
        ).toEqual(access);
      } finally {
        for (const id of ids)
          await connection.query(
            "DELETE FROM posts WHERE id=? AND text LIKE 'C3 pager % fixture'",
            [id],
          );
        await connection.query(
          "DELETE FROM club_payments WHERE userId=? AND orderId='c3-pager-access'",
          [memberId],
        );
      }
    },
    30_000,
  );

  it("C3 searches the public feed without exposing club or unpublished posts and clears the query", async () => {
    const { rows, connection, context, frontend } = fixture();
    const ids = [94621, 94622, 94623, 94624, 94625];
    // Catches ignored search predicates and search bypassing public-feed gates.
    try {
      await connection.query(`CREATE TABLE IF NOT EXISTS tags (
        id INT AUTO_INCREMENT PRIMARY KEY,slug VARCHAR(64) NOT NULL UNIQUE,
        label VARCHAR(128) NOT NULL,category ENUM('season','topic') NOT NULL DEFAULT 'topic',
        sortOrder INT NOT NULL DEFAULT 0
      ) ENGINE=InnoDB`);
      await connection.query(
        `INSERT INTO posts (id,text,photos,tags,status,published,target) VALUES
        (94621,'C3 needle feed fixture','[]','[]','published',1,'feed'),
        (94622,'C3 needle both fixture','[]','[]','published',1,'both'),
        (94623,'C3 unrelated feed fixture','[]','[]','published',1,'feed'),
        (94624,'C3 needle club fixture','[]','[]','published',1,'club'),
        (94625,'C3 needle draft fixture','[]','[]','draft',1,'feed')`,
      );
      const before = await rows(
        "SELECT id,text,status,published,target FROM posts WHERE id IN (94621,94622,94623,94624,94625) ORDER BY id",
      );
      await context.clearCookies();
      const page = await context.newPage();
      const tagsResponse = page.waitForResponse((response) =>
        response.url().includes("feed.tags"),
      );
      await page.goto(frontend + "feed");
      expect((await tagsResponse).status()).toBe(200);
      const card = (text: string) =>
        page.locator("article").filter({ hasText: text });
      await browserExpect(card("C3 unrelated feed fixture")).toHaveCount(1);
      const search = page.getByPlaceholder("Поиск...", { exact: true });
      const searched = page.waitForResponse(
        (response) =>
          response.url().includes("feed.listPaginated") &&
          response.url().includes("needle"),
      );
      await search.fill("needle");
      expect((await searched).status()).toBe(200);
      await browserExpect(card("C3 needle feed fixture")).toHaveCount(1);
      await browserExpect(card("C3 needle both fixture")).toHaveCount(1);
      await browserExpect(card("C3 unrelated feed fixture")).toHaveCount(0);
      await browserExpect(card("C3 needle club fixture")).toHaveCount(0);
      await browserExpect(card("C3 needle draft fixture")).toHaveCount(0);
      const absent = page.waitForResponse(
        (response) =>
          response.url().includes("feed.listPaginated") &&
          response.url().includes("nonexistent-c3-query"),
      );
      await search.fill("nonexistent-c3-query");
      expect((await absent).status()).toBe(200);
      await browserExpect(page.locator("article")).toHaveCount(0);
      await page
        .getByRole("button", { name: "Очистить поиск", exact: true })
        .click();
      await browserExpect(search).toHaveValue("");
      await browserExpect(card("C3 unrelated feed fixture")).toHaveCount(1);
      await browserExpect(card("C3 needle feed fixture")).toHaveCount(1);
      await browserExpect(card("C3 needle both fixture")).toHaveCount(1);
      await browserExpect(card("C3 needle club fixture")).toHaveCount(0);
      await browserExpect(card("C3 needle draft fixture")).toHaveCount(0);
      expect(
        await rows(
          "SELECT id,text,status,published,target FROM posts WHERE id IN (94621,94622,94623,94624,94625) ORDER BY id",
        ),
      ).toEqual(before);
    } finally {
      for (const postId of ids) {
        await connection.query(
          "DELETE FROM posts WHERE id=? AND text LIKE 'C3 % fixture'",
          [postId],
        );
      }
    }
  }, 30_000);
  it("C3 separates saved feed and club categories and excludes unpublished or expired club content", async () => {
    const { rows, connection, context, frontend, memberId } = fixture();
    const ids = [94611, 94612, 94613, 94614, 94615];
    // Catches category mixing and saved reads bypassing publication/access gates.
    try {
      await connection.query(
        `INSERT INTO posts (id,text,photos,tags,status,published,target) VALUES
        (94611,'C3 saved feed fixture','[]','[]','published',1,'feed'),
        (94612,'C3 saved club fixture','[]','[]','published',1,'club'),
        (94613,'C3 saved both fixture','[]','[]','published',1,'both'),
        (94614,'C3 saved draft fixture','[]','[]','draft',1,'feed'),
        (94615,'C3 saved scheduled fixture','[]','[]','scheduled',1,'club')`,
      );
      for (const postId of ids) {
        await connection.query(
          "INSERT INTO saved_posts (userId,postId) VALUES (?,?)",
          [memberId, postId],
        );
      }
      await connection.query(
        "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'c3-saved-categories-access','paid','0','2030-01-01')",
        [memberId],
      );
      const saved = await rows(
        "SELECT userId,postId FROM saved_posts WHERE userId=? ORDER BY postId",
        [memberId],
      );
      const identity = await rows(
        "SELECT id,email,passwordHash,role,sessionVersion FROM users WHERE id=?",
        [memberId],
      );
      await context.clearCookies();
      await context.addCookies([
        {
          name: COOKIE_NAME,
          value: await sdk.createSessionToken("binding-browser-member", {
            sessionVersion: 0,
          }),
          url: frontend,
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      const page = await context.newPage();
      await page.goto(frontend + "profile");
      const savedIds = async () =>
        page.evaluate(async () => {
          const response = await fetch("/api/trpc/feed.savedPosts");
          const body = await response.json();
          return {
            status: response.status,
            ids: body.result.data.json
              .map((post: { id: number }) => post.id)
              .sort(),
          };
        });
      expect(await savedIds()).toEqual({
        status: 200,
        ids: [94611, 94612, 94613],
      });
      const card = (text: string) =>
        page.getByRole("button").filter({ hasText: text });
      await browserExpect(card("C3 saved feed fixture")).toHaveCount(1);
      await browserExpect(card("C3 saved both fixture")).toHaveCount(1);
      await browserExpect(card("C3 saved club fixture")).toHaveCount(0);
      await browserExpect(card("C3 saved draft fixture")).toHaveCount(0);
      await browserExpect(card("C3 saved scheduled fixture")).toHaveCount(0);
      await page.getByRole("button", { name: "Из клуба", exact: true }).click();
      await browserExpect(card("C3 saved club fixture")).toHaveCount(1);
      await browserExpect(card("C3 saved both fixture")).toHaveCount(1);
      await browserExpect(card("C3 saved feed fixture")).toHaveCount(0);
      await page.reload();
      await browserExpect(card("C3 saved feed fixture")).toHaveCount(1);
      // Only our fixture expires; saved rows remain recoverable after renewal.
      await connection.query(
        "UPDATE club_payments SET expiresAt='2026-01-01' WHERE userId=? AND orderId='c3-saved-categories-access'",
        [memberId],
      );
      expect(await savedIds()).toEqual({ status: 200, ids: [94611, 94613] });
      expect(
        await rows(
          "SELECT userId,postId FROM saved_posts WHERE userId=? ORDER BY postId",
          [memberId],
        ),
      ).toEqual(saved);
      expect(
        await rows(
          "SELECT id,email,passwordHash,role,sessionVersion FROM users WHERE id=?",
          [memberId],
        ),
      ).toEqual(identity);
    } finally {
      for (const postId of ids) {
        await connection.query("DELETE FROM saved_posts WHERE postId=?", [
          postId,
        ]);
        await connection.query(
          "DELETE FROM posts WHERE id=? AND text LIKE 'C3 saved % fixture'",
          [postId],
        );
      }
    }
  }, 30_000);
  it("C3 preserves liked and saved posts across login while isolating the next account", async () => {
    const { rows, connection, context, frontend, actorId, memberId } =
      fixture();
    const postId = 94601;
    const text = "C3 account reactions fixture";
    const password = "Synthetic-C3-login-only-2026!";
    const passwordHash = await hashPassword(password);
    await connection.query(
      "UPDATE users SET email=?,passwordHash=? WHERE id=?",
      ["c3.member@example.test", passwordHash, memberId],
    );
    await connection.query(
      "UPDATE users SET email=?,passwordHash=? WHERE id=?",
      ["c3.admin@example.test", passwordHash, actorId],
    );
    const identitySql =
      "SELECT id,email,passwordHash,role,sessionVersion FROM users WHERE id IN (?,?) ORDER BY id";
    const identity = await rows(identitySql, [actorId, memberId]);
    // Catches forgotten persisted reactions and cached state leaking between users.
    try {
      // The existing profile/logout UI is for club members, not unpaid accounts.
      await connection.query(
        "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'c3-reactions-access','paid','0','2030-01-01')",
        [memberId],
      );
      const access = await rows("SELECT * FROM club_payments WHERE userId=?", [
        memberId,
      ]);
      await connection.query(
        "INSERT INTO posts (id,text,photos,tags,status,published,target) VALUES (?,?,'[]','[]','published',1,'feed')",
        [postId, text],
      );
      await context.clearCookies();
      const page = await context.newPage();
      const signIn = async (email: string, id: number) => {
        await page.goto(frontend + `login?next=/post/${postId}`);
        await page.getByPlaceholder("Email", { exact: true }).fill(email);
        await page.getByPlaceholder("Пароль", { exact: true }).fill(password);
        const [response] = await Promise.all([
          page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === "/api/auth/login",
          ),
          page.getByRole("button", { name: "Войти", exact: true }).click(),
        ]);
        expect(response.status()).toBe(200);
        expect((await response.json()).user).toMatchObject({ id, email });
        await browserExpect(page).toHaveURL(new RegExp(`/post/${postId}$`));
        await browserExpect(
          page.getByText(text, { exact: true }),
        ).toBeVisible();
      };
      const logout = async () => {
        await page.goto(frontend + "profile");
        await page.getByRole("button", { name: "Выйти", exact: true }).click();
        await browserExpect
          .poll(
            async () =>
              (await context.cookies()).filter(
                (cookie) => cookie.name === COOKIE_NAME,
              ).length,
          )
          .toBe(0);
      };
      const like = page.getByRole("button", { name: "Нравится", exact: true });
      const save = page.getByRole("button", {
        name: "Сохранить пост",
        exact: true,
      });
      const assertReactions = async (pressed: boolean) => {
        await browserExpect(like).toBeEnabled();
        await browserExpect(save).toBeEnabled();
        await browserExpect(like).toHaveAttribute(
          "aria-pressed",
          String(pressed),
        );
        await browserExpect(save).toHaveAttribute(
          "aria-pressed",
          String(pressed),
        );
      };
      await signIn("c3.member@example.test", memberId);
      await assertReactions(false);
      await like.click();
      await browserExpect(like).toHaveAttribute("aria-pressed", "true");
      await save.click();
      await assertReactions(true);
      const expected = [{ userId: memberId, postId }];
      const assertSql = async () => {
        expect(
          await rows("SELECT userId,postId FROM likes WHERE postId=?", [
            postId,
          ]),
        ).toEqual(expected);
        expect(
          await rows("SELECT userId,postId FROM saved_posts WHERE postId=?", [
            postId,
          ]),
        ).toEqual(expected);
      };
      await assertSql();
      await page.reload();
      await assertReactions(true);
      await logout();
      await signIn("c3.admin@example.test", actorId);
      await assertReactions(false);
      await page.reload();
      await assertReactions(false);
      await assertSql();
      await logout();
      await signIn("c3.member@example.test", memberId);
      await assertReactions(true);
      await assertSql();
      expect(await rows(identitySql, [actorId, memberId])).toEqual(identity);
      expect(
        await rows("SELECT * FROM club_payments WHERE userId=?", [memberId]),
      ).toEqual(access);
    } finally {
      await connection.query("DELETE FROM likes WHERE postId=?", [postId]);
      await connection.query("DELETE FROM saved_posts WHERE postId=?", [
        postId,
      ]);
      await connection.query("DELETE FROM posts WHERE id=? AND text=?", [
        postId,
        text,
      ]);
    }
  }, 30_000);
}
