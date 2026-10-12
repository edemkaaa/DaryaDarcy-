import { expect, it } from "vitest";
import { expect as browserExpect, type BrowserContext } from "@playwright/test";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { ensureArticles } from "./library-browser-cases";
import { hashPassword } from "../../apps/backend/src/_core/password";

type Fixture = {
  rows(sql: string, args?: unknown[]): Promise<RowDataPacket[]>;
  connection: Pick<Connection, "query">;
  context: BrowserContext;
  frontend: string;
  base: string;
  memberId: number;
};

export function registerAdminArticleBrowserCases(fixture: () => Fixture) {
  it.each(["navigation", "account"] as const)(
    "C2 fences pending article cancellation reads across %s changes",
    async (transition) => {
      const { rows, connection, context, frontend, base, memberId } = fixture();
      const title = `C2 pending reconciliation ${transition} fixture`;
      const newTitle = title + " unsent new editor";
      await ensureArticles(connection);
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let handler: Promise<void> | undefined;
      let readReady = false;
      let writes = 0;
      try {
        const page = await context.newPage();
        const alerts: string[] = [];
        page.on("dialog", async (dialog) => {
          alerts.push(dialog.message());
          await dialog.accept();
        });
        await page.route("**/api/trpc/admin.createArticle*", async (route) => {
          writes++;
          const url = new URL(route.request().url());
          const response = await route.fetch({
            url: base + url.pathname + url.search,
            maxRedirects: 0,
          });
          expect(response.status()).toBe(200);
          await route.abort("failed");
        });
        await page.goto(frontend + "admin");
        await page.getByRole("button", { name: "Статьи", exact: true }).click();
        await page
          .getByRole("button", { name: "Написать статью", exact: true })
          .click();
        const field = page.getByPlaceholder("Что посмотреть осенью...");
        await field.fill(title);
        await page
          .getByRole("button", { name: "Статус: опубликована", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Сохранить черновик", exact: true })
          .click();
        await browserExpect.poll(() => alerts.length).toBe(1);
        expect(alerts[0]).toContain("Результат сохранения не подтверждён");
        const sql =
          "SELECT id,title,access,published FROM articles WHERE title IN (?,?) ORDER BY id";
        const committed = await rows(sql, [title, newTitle]);
        expect(committed).toHaveLength(1);
        expect(committed[0]).toMatchObject({
          title,
          access: "club",
          published: 0,
        });
        await page.route("**/api/trpc/admin.articles*", (route) => {
          const hold = !handler;
          const pending = (async () => {
            const url = new URL(route.request().url());
            const response = await route.fetch({
              url: base + url.pathname + url.search,
              maxRedirects: 0,
            });
            expect(response.status()).toBe(200);
            if (hold) {
              const payload = await response.json();
              const returned = (
                Array.isArray(payload) ? payload : [payload]
              ).flatMap((item) => item.result.data.json);
              expect(returned).toEqual(
                expect.arrayContaining([
                  expect.objectContaining({ id: committed[0].id, title }),
                ]),
              );
              readReady = true;
              await gate;
            }
            await route.fulfill({ response });
          })();
          if (!handler) handler = pending;
          return pending;
        });
        await page.getByRole("button", { name: "Отмена", exact: true }).click();
        await browserExpect.poll(() => readReady).toBe(true);
        await browserExpect(field).toHaveValue(title);
        if (transition === "navigation") {
          // Switching views unmounts the old editor without a document reload.
          await page
            .getByRole("button", { name: "Посты", exact: true })
            .click();
          await browserExpect(field).toHaveCount(0);
          await page
            .getByRole("button", { name: "Статьи", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Написать статью", exact: true })
            .click();
          await field.fill(newTitle);
        } else {
          const password = "Synthetic-C2-reconciliation-only-2026!";
          await connection.query(
            "UPDATE users SET email=?,passwordHash=? WHERE id=?",
            [
              "c2.reconciliation.member@example.test",
              await hashPassword(password),
              memberId,
            ],
          );
          const other = await context.newPage();
          await other.goto(frontend + "profile");
          await other
            .getByRole("button", { name: "Выйти", exact: true })
            .click();
          await browserExpect(
            page.getByRole("button", { name: "Войти", exact: true }),
          ).toBeVisible();
          await other.goto(frontend + "login?next=/admin");
          await other
            .getByPlaceholder("Email", { exact: true })
            .fill("c2.reconciliation.member@example.test");
          await other
            .getByPlaceholder("Пароль", { exact: true })
            .fill(password);
          await other
            .getByRole("button", { name: "Войти", exact: true })
            .click();
          await browserExpect(
            other.getByRole("button", {
              name: "Вернуться в профиль",
              exact: true,
            }),
          ).toBeVisible();
          await page.bringToFront();
          // Logout redirects this tab to login; it must stay fenced there,
          // not be forced back into admin by the later list callback.
          await browserExpect(page).toHaveURL(/\/login(?:\?|$)/);
          expect(
            await page.evaluate(async () =>
              (await fetch("/api/auth/me")).json(),
            ),
          ).toMatchObject({ user: { id: memberId, role: "user" } });
        }
        release();
        await handler;
        await page.unroute("**/api/trpc/admin.articles*");
        // Let the returned read and React's resulting callbacks settle before
        // checking that they did not reset the replacement editor/session.
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve()),
              ),
            ),
        );
        if (transition === "navigation") {
          await browserExpect(field).toHaveValue(newTitle);
          await browserExpect(
            page.getByRole("button", { name: "Опубликовать", exact: true }),
          ).toBeEnabled();
          await page
            .getByRole("button", { name: "Отмена", exact: true })
            .click();
          await browserExpect(field).toHaveCount(0);
          await browserExpect(
            page.getByText(title, { exact: true }),
          ).toHaveCount(1);
        } else {
          await browserExpect(field).toHaveCount(0);
          await browserExpect(
            page.getByText(title, { exact: true }),
          ).toHaveCount(0);
          await browserExpect(
            page.getByRole("button", { name: "Статьи", exact: true }),
          ).toHaveCount(0);
          expect(
            await page.evaluate(
              async () => (await fetch("/api/trpc/admin.articles")).status,
            ),
          ).toBe(403);
        }
        expect(alerts).toHaveLength(1);
        expect(writes).toBe(1);
        expect(await rows(sql, [title, newTitle])).toEqual(committed);
      } finally {
        release();
        await handler;
        for (const row of await rows(
          "SELECT id FROM articles WHERE title IN (?,?)",
          [title, newTitle],
        )) {
          await connection.query("DELETE FROM posts WHERE source=?", [
            `article:${row.id}`,
          ]);
          await connection.query("DELETE FROM articles WHERE id=?", [row.id]);
        }
      }
    },
    30_000,
  );
  it.each(["create", "update"] as const)(
    "C2 retains an article after a committed %s reply is lost and blocks repeated writes",
    async (mode) => {
      const { rows, connection, context, frontend, base } = fixture();
      const title = `C2 lost article ${mode} fixture`;
      const originalTitle = title + " original";
      await ensureArticles(connection);
      try {
        if (mode === "update")
          await connection.query(
            "INSERT INTO articles (title,access,published,sections) VALUES (?,'club',FALSE,JSON_ARRAY(JSON_OBJECT('type','text','text','Original body')))",
            [originalTitle],
          );
        const original =
          mode === "update"
            ? (
                await rows("SELECT id FROM articles WHERE title=?", [
                  originalTitle,
                ])
              )[0]
            : null;
        const page = await context.newPage();
        let writes = 0;
        await page.route(`**/api/trpc/admin.${mode}Article*`, async (route) => {
          writes++;
          const url = new URL(route.request().url());
          const response = await route.fetch({
            url: base + url.pathname + url.search,
            maxRedirects: 0,
          });
          expect(response.status()).toBe(200);
          return route.abort("failed");
        });
        await page.goto(frontend + "admin");
        await page.getByRole("button", { name: "Статьи", exact: true }).click();
        if (mode === "create")
          await page
            .getByRole("button", { name: "Написать статью", exact: true })
            .click();
        else
          await page
            .getByText(originalTitle, { exact: true })
            .locator("..")
            .getByRole("button", { name: "Править", exact: true })
            .click();
        const field = page.getByPlaceholder("Что посмотреть осенью...");
        await field.fill(title);
        if (mode === "create")
          await page
            .getByRole("button", { name: "Статус: опубликована", exact: true })
            .click();
        const alerts: string[] = [];
        page.on("dialog", async (dialog) => {
          alerts.push(dialog.message());
          await dialog.accept();
        });
        const save = page.getByRole("button", {
          name: mode === "create" ? "Сохранить черновик" : "Сохранить",
          exact: true,
        });
        await save.click();
        await browserExpect.poll(() => alerts.length).toBe(1);
        expect(alerts[0]).toContain("Результат сохранения не подтверждён");
        await browserExpect(field).toHaveValue(title);
        const sql =
          "SELECT id,title,access,published,sections FROM articles WHERE title IN (?,?) ORDER BY id";
        const committed = await rows(sql, [title, originalTitle]);
        expect(committed).toHaveLength(1);
        expect(committed[0]).toMatchObject({
          id: original?.id ?? expect.any(Number),
          title,
          access: "club",
          published: 0,
        });
        if (mode === "update")
          expect(committed[0].sections).toEqual([
            { type: "text", text: "Original body" },
          ]);
        await save.click();
        await browserExpect.poll(() => alerts.length).toBe(2);
        expect(alerts[1]).toContain("Результат сохранения не подтверждён");
        expect(writes).toBe(1);
        expect(await rows(sql, [title, originalTitle])).toEqual(committed);
        const canonical = await context.newPage();
        await canonical.goto(frontend + "admin");
        await canonical
          .getByRole("button", { name: "Статьи", exact: true })
          .click();
        await browserExpect(
          canonical.getByText(title, { exact: true }),
        ).toHaveCount(1);
        await browserExpect(
          canonical.getByText(originalTitle, { exact: true }),
        ).toHaveCount(0);
        expect(await rows(sql, [title, originalTitle])).toEqual(committed);
        expect(writes).toBe(1);
        // A failed reconciliation cannot discard the unknown write state.
        let readFault: "network" | "invalid-identity" | "none" = "network";
        await page.route("**/api/trpc/admin.articles*", async (route) => {
          if (readFault === "network") return route.abort("failed");
          const url = new URL(route.request().url());
          const response = await route.fetch({
            url: base + url.pathname + url.search,
            maxRedirects: 0,
          });
          expect(response.status()).toBe(200);
          if (readFault === "invalid-identity") {
            // Corrupt only the native return payload after the real SQL read.
            // HTTP200 alone must not authorize discarding an unknown write.
            const payload = await response.json();
            let corrupted = 0;
            for (const item of Array.isArray(payload) ? payload : [payload])
              for (const article of item.result.data.json) {
                expect(article.id).toBeGreaterThan(0);
                article.id = 0;
                corrupted++;
              }
            expect(corrupted).toBeGreaterThan(0);
            return route.fulfill({ response, json: payload });
          }
          return route.fulfill({ response });
        });
        await page.getByRole("button", { name: "Отмена", exact: true }).click();
        await browserExpect.poll(() => alerts.length).toBe(3);
        expect(alerts[2]).toContain("Редактор остаётся открытым");
        await browserExpect(field).toHaveValue(title);
        await save.click();
        await browserExpect.poll(() => alerts.length).toBe(4);
        expect(alerts[3]).toContain("Результат сохранения не подтверждён");
        expect(writes).toBe(1);
        readFault = "invalid-identity";
        await page.getByRole("button", { name: "Отмена", exact: true }).click();
        await browserExpect.poll(() => alerts.length).toBe(5);
        expect(alerts[4]).toContain("Редактор остаётся открытым");
        await browserExpect(field).toHaveValue(title);
        await save.click();
        await browserExpect.poll(() => alerts.length).toBe(6);
        expect(alerts[5]).toContain("Результат сохранения не подтверждён");
        expect(writes).toBe(1);
        expect(await rows(sql, [title, originalTitle])).toEqual(committed);
        readFault = "none";
        await page.getByRole("button", { name: "Отмена", exact: true }).click();
        await browserExpect(field).toHaveCount(0);
        await browserExpect(page.getByText(title, { exact: true })).toHaveCount(
          1,
        );
        await browserExpect(
          page.getByText(originalTitle, { exact: true }),
        ).toHaveCount(0);
        expect(await rows(sql, [title, originalTitle])).toEqual(committed);
        expect(writes).toBe(1);
      } finally {
        for (const row of await rows(
          "SELECT id FROM articles WHERE title IN (?,?)",
          [title, originalTitle],
        )) {
          await connection.query("DELETE FROM posts WHERE source=?", [
            `article:${row.id}`,
          ]);
          await connection.query("DELETE FROM articles WHERE id=?", [row.id]);
        }
      }
    },
    30_000,
  );
  it("C2 retains the article editor while the committed create acknowledgement is pending", async () => {
    const { rows, connection, context, frontend, base } = fixture();
    const title = "C2 pending article acknowledgement fixture";
    await ensureArticles(connection);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let handler: Promise<void> | undefined;
    try {
      const page = await context.newPage();
      await page.route("**/api/trpc/admin.createArticle*", (route) => {
        handler = (async () => {
          const url = new URL(route.request().url());
          const response = await route.fetch({
            url: base + url.pathname + url.search,
            maxRedirects: 0,
          });
          expect(response.status()).toBe(200);
          await gate;
          await route.fulfill({ response });
        })();
        return handler;
      });
      await page.goto(frontend + "admin");
      await page.getByRole("button", { name: "Статьи", exact: true }).click();
      await page
        .getByRole("button", { name: "Написать статью", exact: true })
        .click();
      const field = page.getByPlaceholder("Что посмотреть осенью...");
      await field.fill(title);
      await page
        .getByRole("button", { name: "Статус: опубликована", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Сохранить черновик", exact: true })
        .click();
      await browserExpect
        .poll(() => rows("SELECT id FROM articles WHERE title=?", [title]))
        .toHaveLength(1);
      await browserExpect(
        page.getByRole("button", { name: "Отмена", exact: true }),
      ).toBeDisabled();
      await browserExpect(field).toHaveValue(title);
      release();
      await handler;
      await browserExpect(field).toHaveCount(0);
      expect(
        await rows("SELECT title,published FROM articles WHERE title=?", [
          title,
        ]),
      ).toEqual([{ title, published: 0 }]);
    } finally {
      release();
      await handler;
      for (const row of await rows("SELECT id FROM articles WHERE title=?", [
        title,
      ])) {
        await connection.query("DELETE FROM posts WHERE source=?", [
          `article:${row.id}`,
        ]);
        await connection.query("DELETE FROM articles WHERE id=?", [row.id]);
      }
    }
  }, 30_000);
  it("C2 creates a draft article, cancels edits, publishes the same ID and confirms deletion", async () => {
    const { rows, connection, context, frontend, base } = fixture();
    const title = "C2 article editor lifecycle fixture";
    const edited = title + " edited";
    const body = "C2 article canonical body";
    await ensureArticles(connection);
    try {
      const page = await context.newPage();
      const openList = async () => {
        await page.goto(frontend + "admin");
        await page.getByRole("button", { name: "Статьи", exact: true }).click();
      };
      await openList();
      await page
        .getByRole("button", { name: "Написать статью", exact: true })
        .click();
      const titleField = page.getByPlaceholder("Что посмотреть осенью...");
      await titleField.fill(title);
      await page
        .getByPlaceholder(
          "Абзац. Пустая строка — новый абзац. Ссылка: [название](https://...)",
        )
        .fill(body);
      await page
        .getByRole("button", { name: "Статус: опубликована", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Сохранить черновик", exact: true })
        .click();
      const sql =
        "SELECT id,title,access,published,sections FROM articles WHERE title IN (?,?) ORDER BY id";
      await browserExpect
        .poll(() => rows(sql, [title, edited]))
        .toHaveLength(1);
      const [created] = await rows(sql, [title, edited]);
      expect(created).toEqual({
        id: expect.any(Number),
        title,
        access: "club",
        published: 0,
        sections: [{ type: "text", text: body }],
      });
      const card = (name: string) =>
        page.getByText(name, { exact: true }).locator("..");
      await browserExpect(card(title)).toContainText("черновик");
      await openList();
      await card(title)
        .getByRole("button", { name: "Править", exact: true })
        .click();
      await titleField.fill(edited);
      await page.getByRole("button", { name: "Отмена", exact: true }).click();
      expect(await rows(sql, [title, edited])).toEqual([created]);
      await card(title)
        .getByRole("button", { name: "Править", exact: true })
        .click();
      await titleField.fill(edited);
      await page
        .getByRole("button", { name: "Статус: черновик", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Клуб + библиотека", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      // The edited title is already rendered inside the live editor. Wait for
      // acknowledged form closure before selecting the canonical list card.
      await browserExpect(titleField).toHaveCount(0);
      await browserExpect(card(edited)).toBeVisible();
      const published = {
        ...created,
        title: edited,
        access: "public",
        published: 1,
      };
      expect(await rows(sql, [title, edited])).toEqual([published]);
      const teaserSql =
        "SELECT id,target,status,published FROM posts WHERE source=?";
      const teaser = await rows(teaserSql, [`article:${created.id}`]);
      expect(teaser).toEqual([
        {
          id: expect.any(Number),
          target: "club",
          status: "published",
          published: 1,
        },
      ]);
      const response = await fetch(
        base +
          `/api/trpc/articles.getById?input=${encodeURIComponent(JSON.stringify({ json: { id: created.id } }))}`,
      );
      expect(response.status).toBe(200);
      expect((await response.json()).result.data.json).toMatchObject({
        id: created.id,
        title: edited,
        locked: false,
        sections: [{ type: "text", text: body }],
      });
      await openList();
      page.once("dialog", (dialog) => dialog.dismiss());
      await card(edited)
        .getByRole("button", { name: "Удалить", exact: true })
        .click();
      expect(await rows(sql, [title, edited])).toEqual([published]);
      expect(await rows(teaserSql, [`article:${created.id}`])).toEqual(teaser);
      page.once("dialog", (dialog) => dialog.accept());
      await card(edited)
        .getByRole("button", { name: "Удалить", exact: true })
        .click();
      await browserExpect(card(edited)).toHaveCount(0);
      expect(await rows(sql, [title, edited])).toEqual([]);
      expect(await rows(teaserSql, [`article:${created.id}`])).toEqual([]);
      await openList();
      await browserExpect(card(edited)).toHaveCount(0);
    } finally {
      const owned = await rows("SELECT id FROM articles WHERE title IN (?,?)", [
        title,
        edited,
      ]);
      for (const row of owned) {
        await connection.query("DELETE FROM posts WHERE source=?", [
          `article:${row.id}`,
        ]);
        await connection.query("DELETE FROM articles WHERE id=?", [row.id]);
      }
    }
  }, 30_000);
}
