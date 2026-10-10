import { expect, it } from "vitest";
import { expect as browserExpect, type BrowserContext } from "@playwright/test";
import type { Connection, RowDataPacket } from "mysql2/promise";

interface AdminPostBrowserFixture {
  rows(sql: string, args?: unknown[]): Promise<RowDataPacket[]>;
  connection: Pick<Connection, "query">;
  context: BrowserContext;
  frontend: string;
  actorId: number;
}

// Reuse the caller's native API/SQL lifecycle, not an API response double.
export function registerAdminPostBrowserCases(
  fixture: () => AdminPostBrowserFixture,
) {
  it("C2 persists a draft through browser create, edit, reload and confirmed deletion", async () => {
    const { rows, connection, context, frontend, actorId } = fixture();
    const text = "C2 native browser draft fixture";
    const edited = text + " — edited";
    let id: number | undefined;
    // Catches accidental publication, lost edits, duplicate writes and deletion on cancel.
    try {
      const page = await context.newPage();
      await page.goto(frontend + "admin");
      await page.getByRole("button", { name: /Новый/ }).click();
      const field = page.getByPlaceholder("Текст поста… Enter — новый абзац");
      // Visibility precedes asynchronous draft recovery; wait for editable state.
      const editor = page.getByRole("dialog", { name: "Редактор публикации" });
      await browserExpect(editor.locator(".ui-scroll")).not.toHaveAttribute(
        "inert",
        "",
      );
      await field.fill(text);
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Черновик", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      await browserExpect
        .poll(
          async () =>
            (await rows("SELECT id FROM posts WHERE text=?", [text])).length,
        )
        .toBe(1);
      const [created] = await rows(
        "SELECT id,text,status,published,target FROM posts WHERE text=?",
        [text],
      );
      id = created.id;
      expect(created).toEqual({
        id: expect.any(Number),
        text,
        status: "draft",
        published: 0,
        target: "feed",
      });
      const card = page.getByTestId(`admin-post-${id}`);
      await browserExpect(card).toContainText(text);
      await browserExpect(card).toContainText("Черновик");
      await page.reload();
      await browserExpect(card).toContainText(text);
      await card.getByRole("button", { name: "Редактировать пост" }).click();
      await browserExpect(editor.locator(".ui-scroll")).not.toHaveAttribute(
        "inert",
        "",
      );
      await field.fill(edited);
      await browserExpect(field).toHaveValue(edited);
      await page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      await browserExpect(card).toContainText(edited);
      const [saved] = await rows(
        "SELECT id,text,status,published,target FROM posts WHERE id=?",
        [id],
      );
      expect(saved).toEqual({ ...created, text: edited });
      expect(
        await rows("SELECT id FROM posts WHERE text IN (?,?)", [text, edited]),
      ).toEqual([{ id }]);
      await page.reload();
      await browserExpect(card).toContainText(edited);
      page.once("dialog", (dialog) => dialog.dismiss());
      await card.getByRole("button", { name: "Удалить пост" }).click();
      expect(
        await rows(
          "SELECT id,text,status,published,target FROM posts WHERE id=?",
          [id],
        ),
      ).toEqual([saved]);
      await browserExpect(card).toBeVisible();
      page.once("dialog", (dialog) => dialog.accept());
      await card.getByRole("button", { name: "Удалить пост" }).click();
      await browserExpect(card).toHaveCount(0);
      expect(await rows("SELECT id FROM posts WHERE id=?", [id])).toEqual([]);
      await page.reload();
      await browserExpect(
        page.getByRole("button", { name: /Новый/ }),
      ).toBeVisible();
      await browserExpect(card).toHaveCount(0);
    } finally {
      await connection.query(
        "DELETE FROM post_creation_requests WHERE actorUserId=? AND (postId=? OR postId IN (SELECT id FROM posts WHERE text IN (?,?) AND source='manual'))",
        [actorId, id ?? -1, text, edited],
      );
      // Exact synthetic marker also covers a created row before its ID was read.
      await connection.query(
        "DELETE FROM posts WHERE text IN (?,?) AND source='manual'",
        [text, edited],
      );
    }
  }, 30_000);
}
