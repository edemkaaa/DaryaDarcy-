import { expect, it } from "vitest";
import { expect as browserExpect, type BrowserContext } from "@playwright/test";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { ensureArticles } from "./library-browser-cases";

type Fixture = {
  rows(sql: string, args?: unknown[]): Promise<RowDataPacket[]>;
  connection: Pick<Connection, "query">;
  context: BrowserContext;
  frontend: string;
  base: string;
};

export function registerAdminArticleBrowserCases(fixture: () => Fixture) {
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
