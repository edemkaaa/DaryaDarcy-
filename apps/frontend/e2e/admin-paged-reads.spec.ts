import { expect, test } from "@playwright/test";
import { editorApi, failure, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

const fullPost = (id: number) => ({
  id,
  text: `FULL_EDIT_BODY_${id}`,
  photos: [],
  media: [],
  tags: [],
  richText: null,
  published: false,
  status: "draft",
  target: "club",
  source: "manual",
  instagramId: null,
  sortOrder: 0,
  scheduledAt: null,
  publishedAt: null,
  createdAt: "2026-10-10T10:00:00Z",
  updatedAt: "2026-10-10T10:00:00Z",
});
const card = (id: number) => ({
  id,
  text: `CARD_${id}`,
  photos: [],
  tags: [],
  tagCount: 0,
  hasVideo: false,
  published: false,
  status: "draft",
  target: "club",
  scheduledAt: null,
  publishedAt: null,
  createdAt: "2026-10-10T10:00:00Z",
});
const counts = { total: 742, published: 700, scheduled: 20, draft: 22 };
test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) =>
    ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname)
      ? route.fallback()
      : route.abort(),
  );
});

test("admin loads pages only for posts and bounded calendar data for its own period", async ({
  page,
}) => {
  const reads: { name: string; input: Record<string, unknown> }[] = [];
  await page.clock.setFixedTime(new Date("2026-10-10T12:00:00Z"));
  await editorApi(page, (name, input) => {
    if (name.startsWith("admin.")) reads.push({ name, input });
    if (name === "admin.posts") return ok([fullPost(1)]);
    if (name === "admin.postCounts") return ok(counts);
    if (name === "admin.postsPage")
      return ok({
        posts: Array.from({ length: 20 }, (_, i) => card(i + 1)),
        nextCursor: 20,
      });
    if (name === "admin.postCalendar") return ok({ days: [], upcoming: [] });
  });
  await gotoWithSession(page, "/admin");
  await expect(page.getByTestId("admin-post-1")).toContainText("CARD_1");
  await page.screenshot({
    path: test.info().outputPath("admin-paged-posts.png"),
  });
  expect(reads.filter((r) => r.name === "admin.posts")).toHaveLength(0);
  await page.getByRole("button", { name: "Статьи", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Написать статью", exact: true }),
  ).toBeVisible();
  const pageReads = reads.filter((r) => r.name === "admin.postsPage").length;
  await page.getByRole("button", { name: "Календарь", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Следующий месяц" }),
  ).toBeVisible();
  await expect
    .poll(() => reads.filter((r) => r.name === "admin.postCalendar").length)
    .toBe(1);
  await page.getByRole("button", { name: "Следующий месяц" }).click();
  await expect
    .poll(() => reads.filter((r) => r.name === "admin.postCalendar").length)
    .toBe(2);
  await page.screenshot({
    path: test.info().outputPath("admin-bounded-calendar.png"),
  });
  const requests = reads.filter((r) => r.name === "admin.postCalendar");
  expect((requests[0].input.days as unknown[]).length).toBe(61);
  expect((requests[1].input.days as unknown[]).length).toBe(61);
  expect(reads.filter((r) => r.name === "admin.postsPage")).toHaveLength(
    pageReads,
  );
  expect(reads.filter((r) => r.name === "admin.posts")).toHaveLength(0);
});

test("editing fetches the full draft and discards a late read after switching sections", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let pending = false;
  await editorApi(page, async (name) => {
    if (name === "admin.posts") return ok([fullPost(1)]);
    if (name === "admin.postCounts") return ok(counts);
    if (name === "admin.postsPage")
      return ok({ posts: [card(1)], nextCursor: null });
    if (name === "admin.postDetail") {
      pending = true;
      await held;
      return ok(fullPost(1));
    }
  });
  await gotoWithSession(page, "/admin");
  await page.getByRole("button", { name: "Редактировать пост" }).click();
  try {
    await expect.poll(() => pending).toBe(true);
    await page.getByRole("button", { name: "Статьи", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Написать статью", exact: true }),
    ).toBeVisible();
    release();
    await page.getByRole("button", { name: "Посты", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "Редактор публикации" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Редактировать пост" }).click();
    await expect(
      page.getByPlaceholder("Текст поста… Enter — новый абзац"),
    ).toHaveValue("FULL_EDIT_BODY_1");
  } finally {
    release();
  }
});

test("a failed next page retries without losing cards or repeating an ID", async ({
  page,
}) => {
  let unavailable = true;
  await editorApi(page, (name, input) => {
    if (name === "admin.posts") return ok([fullPost(1)]);
    if (name === "admin.postCounts") return ok(counts);
    if (name === "admin.postsPage") {
      if (input.cursor === 20)
        return unavailable
          ? failure(503)
          : ok({ posts: [card(20), card(21)], nextCursor: null });
      return ok({
        posts: Array.from({ length: 20 }, (_, i) => card(i + 1)),
        nextCursor: 20,
      });
    }
  });
  await gotoWithSession(page, "/admin");
  await expect(page.getByTestId("admin-post-1")).toContainText("CARD_1");
  await page.getByTestId("admin-post-20").scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("button", { name: "Повторить загрузку" }),
  ).toBeVisible();
  await expect(page.getByTestId("admin-post-1")).toHaveCount(1);
  unavailable = false;
  await page.getByRole("button", { name: "Повторить загрузку" }).click();
  await expect(page.getByTestId("admin-post-21")).toContainText("CARD_21");
  await expect(page.getByTestId("admin-post-20")).toHaveCount(1);
});

test("unknown deletion checks the exact post rather than an incomplete page", async ({
  page,
}) => {
  let listMoved = false,
    deleted = false,
    writes = 0,
    inspections = 0;
  await editorApi(page, (name) => {
    if (name === "admin.postsPage")
      return ok({ posts: listMoved ? [] : [card(1)], nextCursor: null });
    if (name === "admin.postCounts") return ok(counts);
    if (name === "admin.deletePost") {
      writes++;
      listMoved = true;
      return failure(503);
    }
    if (name === "admin.postDetail") {
      inspections++;
      return ok(deleted ? null : fullPost(1));
    }
  });
  page.on("dialog", (dialog) => dialog.accept());
  await gotoWithSession(page, "/admin");
  await page.getByRole("button", { name: "Удалить пост" }).click();
  const inspect = page.getByRole("button", {
    name: "Обновить список",
    exact: true,
  });
  await expect(inspect).toBeVisible();
  await inspect.click();
  await expect.poll(() => inspections).toBe(1);
  await expect(
    page.getByRole("button", { name: "Новый", exact: true }),
  ).toBeDisabled();
  deleted = true;
  await inspect.click();
  await expect(
    page.getByRole("button", { name: "Новый", exact: true }),
  ).toBeEnabled();
  await expect(page.getByTestId("admin-post-1")).toHaveCount(0);
  expect(writes).toBe(1);
});

test("failed counters show no fake zero and can be retried independently", async ({
  page,
}) => {
  let unavailable = true;
  await editorApi(page, (name) => {
    if (name === "admin.postsPage") return ok({ posts: [], nextCursor: null });
    if (name === "admin.postCounts")
      return unavailable ? failure(503) : ok(counts);
  });
  await gotoWithSession(page, "/admin");
  await expect(
    page.getByRole("button", { name: "Повторить счётчики" }),
  ).toBeVisible();
  unavailable = false;
  await page.getByRole("button", { name: "Повторить счётчики" }).click();
  await expect(page.getByText("742", { exact: true })).toBeVisible();
});

test("a late private detail is discarded when the account changes", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = false;
  await editorApi(page, async (name) => {
    if (name === "admin.postsPage")
      return ok({ posts: [card(1)], nextCursor: null });
    if (name === "admin.postCounts") return ok(counts);
    if (name === "admin.postDetail") {
      started = true;
      await held;
      return ok(fullPost(1));
    }
  });
  await gotoWithSession(page, "/admin");
  await page.getByRole("button", { name: "Редактировать пост" }).click();
  try {
    await expect.poll(() => started).toBe(true);
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        json: {
          user: {
            id: 202,
            openId: "other-user",
            name: "Other",
            email: "other@example.test",
            role: "user",
            lastSignedIn: "2026-10-10T10:00:00Z",
          },
        },
      }),
    );
    const checked = page.waitForResponse((response) =>
      response.url().endsWith("/api/auth/me"),
    );
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await checked;
    await expect(
      page.getByText("Недостаточно прав для управления приложением"),
    ).toBeVisible();
    release();
    await expect(
      page.getByRole("dialog", { name: "Редактор публикации" }),
    ).toHaveCount(0);
    await expect(
      page.getByText("FULL_EDIT_BODY_1", { exact: true }),
    ).toHaveCount(0);
  } finally {
    release();
  }
});

test("a quick editor save invalidates retained admin pages and counters", async ({
  page,
}) => {
  let saved = false;
  await page.clock.setFixedTime(new Date("2026-10-19T12:00:00Z"));
  await editorApi(page, (name) => {
    if (name === "admin.postsPage")
      return ok({
        posts: saved ? [card(42), card(1)] : [card(1)],
        nextCursor: null,
      });
    if (name === "admin.postCounts")
      return ok({
        total: saved ? 2 : 1,
        published: 0,
        scheduled: 0,
        draft: saved ? 2 : 1,
      });
    if (name === "feed.listPaginated")
      return ok({ posts: [], nextCursor: null });
    if (name === "admin.createPost") {
      saved = true;
      return ok(42);
    }
  });
  await gotoWithSession(page, "/admin");
  await expect(page.getByTestId("admin-post-1")).toBeVisible();
  await page.getByRole("link", { name: "Лента", exact: true }).click();
  await page.getByRole("button", { name: "Новый пост", exact: true }).click();
  const form = page.getByRole("dialog");
  await form
    .getByPlaceholder("Текст поста… Enter — новый абзац")
    .fill("New quick draft");
  await form.getByLabel("Опубликовать", { exact: true }).click();
  await expect(form).toHaveCount(0);
  await page.goBack();
  await expect(page.getByTestId("admin-post-42")).toBeVisible();
});
