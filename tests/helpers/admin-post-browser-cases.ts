import { expect, it } from "vitest";
import { expect as browserExpect, type BrowserContext } from "@playwright/test";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { hashPassword } from "../../apps/backend/src/_core/password";
import { COOKIE_NAME } from "../../packages/shared/src/const";
import { publishDueScheduledPosts } from "../../apps/backend/src/db";

interface AdminPostBrowserFixture {
  rows(sql: string, args?: unknown[]): Promise<RowDataPacket[]>;
  connection: Pick<Connection, "query">;
  context: BrowserContext;
  frontend: string;
  actorId: number;
  base: string;
  memberId: number;
}

// Reuse the caller's native API/SQL lifecycle, not an API response double.
export function registerAdminPostBrowserCases(
  fixture: () => AdminPostBrowserFixture,
) {
  it("C2 publishes a due editor schedule once and exposes the committed post in the public feed", async () => {
    const { rows, connection, context, frontend, actorId, base } = fixture();
    const text = "C2 due schedule fixture";
    const stateSql =
      "SELECT id,status,published,DATE_FORMAT(scheduledAt,'%Y-%m-%d %H:%i:%s') scheduledAt,DATE_FORMAT(publishedAt,'%Y-%m-%d %H:%i:%s') publishedAt FROM posts WHERE text=?";
    // Catches missing publication, lost scheduled timestamp and duplicate claims.
    try {
      const page = await context.newPage();
      await page.goto(frontend + "admin");
      await page.getByRole("button", { name: /Новый/ }).click();
      const editor = page.getByRole("dialog", { name: "Редактор публикации" });
      await browserExpect(editor.locator(".ui-scroll")).not.toHaveAttribute(
        "inert",
        "",
      );
      await page
        .getByPlaceholder("Текст поста… Enter — новый абзац")
        .fill(text);
      await editor
        .getByRole("button", { name: "Отложить", exact: true })
        .click();
      await editor
        .locator('input[type="datetime-local"]')
        .fill("2037-01-02T10:15");
      await page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      await browserExpect
        .poll(async () => (await rows(stateSql, [text])).length)
        .toBe(1);
      const [created] = await rows(stateSql, [text]);
      expect(created).toEqual({
        id: expect.any(Number),
        status: "scheduled",
        published: 0,
        scheduledAt: "2037-01-02 07:15:00",
        publishedAt: null,
      });
      const card = page.getByTestId(`admin-post-${created.id}`);
      await browserExpect(card).toContainText("Отложен");
      const publicFeed = async () => {
        const response = await fetch(base + "/api/trpc/feed.list");
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.result.data.json).toEqual(expect.any(Array));
        return body.result.data.json as { id: number; text: string }[];
      };
      expect(
        (await publicFeed()).filter((post) => post.id === created.id),
      ).toEqual([]);
      // Only our synthetic row is made due; no wall-clock or worker/provider mock.
      await connection.query(
        "UPDATE posts SET scheduledAt='2026-01-02 07:15:00' WHERE id=? AND text=? AND source='manual'",
        [created.id, text],
      );
      expect(await publishDueScheduledPosts()).toEqual([
        { id: created.id, text, target: "feed" },
      ]);
      const published = {
        id: created.id,
        status: "published",
        published: 1,
        scheduledAt: "2026-01-02 07:15:00",
        publishedAt: "2026-01-02 07:15:00",
      };
      expect(await rows(stateSql, [text])).toEqual([published]);
      const visible = (await publicFeed()).filter(
        (post) => post.id === created.id,
      );
      expect(visible).toHaveLength(1);
      expect(visible[0]).toMatchObject({ id: created.id, text });
      expect(await publishDueScheduledPosts()).toEqual([]);
      expect(await rows(stateSql, [text])).toEqual([published]);
      await page.reload();
      await browserExpect(card).toContainText("Опубликован");
      await browserExpect(card).toContainText(text);
    } finally {
      await connection.query(
        "DELETE FROM post_creation_requests WHERE actorUserId=? AND postId IN (SELECT id FROM posts WHERE text=? AND source='manual')",
        [actorId, text],
      );
      await connection.query(
        "DELETE FROM posts WHERE text=? AND source='manual'",
        [text],
      );
    }
  }, 30_000);
  it("C2 preserves a future Moscow schedule through create, edit and reload without early publication", async () => {
    const { rows, connection, context, frontend, actorId, base } = fixture();
    const text = "C2 future schedule fixture";
    const stateSql =
      "SELECT id,status,published,DATE_FORMAT(scheduledAt,'%Y-%m-%d %H:%i:%s') scheduledAt,publishedAt FROM posts WHERE text=?";
    // Catches timezone drift, lost schedule edits and accidental early publication.
    try {
      const page = await context.newPage();
      await page.goto(frontend + "admin");
      await page.getByRole("button", { name: /Новый/ }).click();
      const editor = page.getByRole("dialog", { name: "Редактор публикации" });
      await browserExpect(editor.locator(".ui-scroll")).not.toHaveAttribute(
        "inert",
        "",
      );
      await page
        .getByPlaceholder("Текст поста… Enter — новый абзац")
        .fill(text);
      await editor
        .getByRole("button", { name: "Отложить", exact: true })
        .click();
      const date = editor.locator('input[type="datetime-local"]');
      await date.fill("2037-01-02T10:15");
      await page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      await browserExpect
        .poll(async () => (await rows(stateSql, [text])).length)
        .toBe(1);
      const [created] = await rows(stateSql, [text]);
      expect(created).toEqual({
        id: expect.any(Number),
        status: "scheduled",
        published: 0,
        scheduledAt: "2037-01-02 07:15:00",
        publishedAt: null,
      });
      const card = page.getByTestId(`admin-post-${created.id}`);
      await browserExpect(card).toContainText("Отложен");
      const publicFeed = async () => {
        const response = await fetch(base + "/api/trpc/feed.list");
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.result.data.json).toEqual(expect.any(Array));
        return body.result.data.json as { id: number }[];
      };
      expect((await publicFeed()).some((post) => post.id === created.id)).toBe(
        false,
      );
      expect(await publishDueScheduledPosts()).toEqual([]);
      expect(await rows(stateSql, [text])).toEqual([created]);
      await page.reload();
      await card.getByRole("button", { name: "Редактировать пост" }).click();
      await browserExpect(editor.locator(".ui-scroll")).not.toHaveAttribute(
        "inert",
        "",
      );
      await browserExpect(date).toHaveValue("2037-01-02T10:15");
      await date.fill("2037-01-03T11:30");
      await page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      await browserExpect(editor).toHaveCount(0);
      const expected = { ...created, scheduledAt: "2037-01-03 08:30:00" };
      expect(await rows(stateSql, [text])).toEqual([expected]);
      expect(await publishDueScheduledPosts()).toEqual([]);
      expect((await publicFeed()).some((post) => post.id === created.id)).toBe(
        false,
      );
      await page.reload();
      await browserExpect(card).toContainText("Отложен");
      await card.getByRole("button", { name: "Редактировать пост" }).click();
      await browserExpect(editor.locator(".ui-scroll")).not.toHaveAttribute(
        "inert",
        "",
      );
      await browserExpect(date).toHaveValue("2037-01-03T11:30");
      expect(await rows(stateSql, [text])).toEqual([expected]);
    } finally {
      await connection.query(
        "DELETE FROM post_creation_requests WHERE actorUserId=? AND postId IN (SELECT id FROM posts WHERE text=? AND source='manual')",
        [actorId, text],
      );
      await connection.query(
        "DELETE FROM posts WHERE text=? AND source='manual'",
        [text],
      );
    }
  }, 30_000);
  it("C2 opens the editor after password login and removes admin controls after logout and member login", async () => {
    const { rows, connection, context, frontend, actorId, memberId } =
      fixture();
    const password = "Synthetic-C2-login-only-2026!";
    const passwordHash = await hashPassword(password);
    await connection.query(
      "UPDATE users SET email=?,passwordHash=? WHERE id=?",
      ["c2.admin@example.test", passwordHash, actorId],
    );
    await connection.query(
      "UPDATE users SET email=?,passwordHash=? WHERE id=?",
      ["c2.member@example.test", passwordHash, memberId],
    );
    const identitySql =
      "SELECT id,openId,email,phone,passwordHash,role,sessionVersion FROM users WHERE id IN (?,?) ORDER BY id";
    const identity = await rows(identitySql, [actorId, memberId]);
    await context.clearCookies();
    const page = await context.newPage();
    const signIn = async (email: string, id: number, role: string) => {
      await page.goto(frontend + "login?next=/admin");
      await page.getByPlaceholder("Email", { exact: true }).fill(email);
      await page.getByPlaceholder("Пароль", { exact: true }).fill(password);
      const [response] = await Promise.all([
        page.waitForResponse(
          (response) => new URL(response.url()).pathname === "/api/auth/login",
        ),
        page.getByRole("button", { name: "Войти", exact: true }).click(),
      ]);
      expect(response.status()).toBe(200);
      expect((await response.json()).user).toMatchObject({ id, role, email });
      await browserExpect(page).toHaveURL(/\/admin$/);
      const [cookie] = (await context.cookies()).filter(
        (cookie) => cookie.name === COOKIE_NAME,
      );
      expect(cookie).toMatchObject({
        httpOnly: true,
        sameSite: "Lax",
        path: "/",
      });
      expect(
        await page.evaluate(() => localStorage.getItem("app_session_token")),
      ).toBeNull();
    };
    await signIn("c2.admin@example.test", actorId, "admin");
    await page.reload();
    await page.getByRole("button", { name: /Новый/ }).click();
    const editor = page.getByRole("dialog", { name: "Редактор публикации" });
    await browserExpect(editor.locator(".ui-scroll")).not.toHaveAttribute(
      "inert",
      "",
    );
    const field = page.getByPlaceholder("Текст поста… Enter — новый абзац");
    await field.fill("C2 unsent administrator draft");
    await browserExpect(field).toHaveValue("C2 unsent administrator draft");
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Закрыть редактор", exact: true })
      .click();
    await browserExpect(editor).toHaveCount(0);
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
    await page.goto(frontend + "admin");
    await browserExpect(
      page.getByRole("button", { name: "Войти", exact: true }),
    ).toBeVisible();
    await signIn("c2.member@example.test", memberId, "user");
    await browserExpect(
      page.getByRole("button", { name: "Вернуться в профиль", exact: true }),
    ).toBeVisible();
    await browserExpect(
      page.getByRole("button", { name: /Новый/ }),
    ).toHaveCount(0);
    await page.reload();
    await browserExpect(
      page.getByRole("button", { name: /Новый/ }),
    ).toHaveCount(0);
    const denied = await page.evaluate(async () => ({
      read: (await fetch("/api/trpc/admin.posts")).status,
      write: (
        await fetch("/api/trpc/admin.createPost", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            json: { text: "C2 forbidden member draft", photos: [], tags: [] },
          }),
        })
      ).status,
    }));
    expect(denied).toEqual({ read: 403, write: 403 });
    expect(
      await rows(
        "SELECT id FROM posts WHERE text IN ('C2 unsent administrator draft','C2 forbidden member draft')",
      ),
    ).toEqual([]);
    expect(await rows(identitySql, [actorId, memberId])).toEqual(identity);
  }, 30_000);
  it("C2 retries a committed draft after a lost HTTP reply without creating another post", async () => {
    const { rows, connection, context, frontend, actorId, base } = fixture();
    const text = "C2 lost reply draft fixture";
    const keys: string[] = [];
    let loseReply = true;
    try {
      const page = await context.newPage();
      // Fault only the return transport after the real API has committed.
      await page.route("**/api/trpc/admin.createPost*", async (route) => {
        const url = new URL(route.request().url());
        keys.push(route.request().postDataJSON()["0"].json.idempotencyKey);
        const response = await route.fetch({
          url: base + url.pathname + url.search,
          maxRedirects: 0,
        });
        expect(response.status()).toBe(200);
        if (loseReply) {
          loseReply = false;
          return route.abort("failed");
        }
        return route.fulfill({ response });
      });
      await page.goto(frontend + "admin");
      await page.getByRole("button", { name: /Новый/ }).click();
      const editor = page.getByRole("dialog", { name: "Редактор публикации" });
      await browserExpect(editor.locator(".ui-scroll")).not.toHaveAttribute(
        "inert",
        "",
      );
      const field = page.getByPlaceholder("Текст поста… Enter — новый абзац");
      await field.fill(text);
      await editor
        .getByRole("button", { name: "Черновик", exact: true })
        .click();
      const dialogs: string[] = [];
      page.on("dialog", async (dialog) => {
        dialogs.push(dialog.type());
        await dialog.accept();
      });
      const save = page.getByRole("button", { name: "Сохранить", exact: true });
      await save.click();
      await browserExpect.poll(() => dialogs).toEqual(["alert"]);
      await browserExpect(field).toHaveValue(text);
      expect(keys).toHaveLength(1);
      expect(keys[0]).toEqual(expect.any(String));
      expect(keys[0].length).toBeGreaterThan(0);
      const committed = await rows(
        "SELECT id,text,status,published FROM posts WHERE text=?",
        [text],
      );
      expect(committed).toEqual([
        { id: expect.any(Number), text, status: "draft", published: 0 },
      ]);
      const requests = await rows(
        "SELECT requestKey,postId FROM post_creation_requests WHERE actorUserId=? AND postId=?",
        [actorId, committed[0].id],
      );
      expect(requests).toHaveLength(1);
      await browserExpect(save).toBeDisabled();
      const inspect = page.getByRole("button", {
        name: "Проверить сохранение",
        exact: true,
      });
      await browserExpect(inspect).toBeEnabled();
      await inspect.click();
      await browserExpect(field).toHaveCount(0);
      expect(keys).toEqual([keys[0], keys[0]]);
      expect(
        await rows("SELECT id,text,status,published FROM posts WHERE text=?", [
          text,
        ]),
      ).toEqual(committed);
      expect(
        await rows(
          "SELECT requestKey,postId FROM post_creation_requests WHERE actorUserId=? AND postId=?",
          [actorId, committed[0].id],
        ),
      ).toEqual(requests);
      await page.reload();
      await browserExpect(
        page.getByTestId(`admin-post-${committed[0].id}`),
      ).toContainText(text);
      expect(dialogs).toEqual(["alert"]);
    } finally {
      await connection.query(
        "DELETE FROM post_creation_requests WHERE actorUserId=? AND postId IN (SELECT id FROM posts WHERE text=? AND source='manual')",
        [actorId, text],
      );
      await connection.query(
        "DELETE FROM posts WHERE text=? AND source='manual'",
        [text],
      );
    }
  }, 30_000);
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
