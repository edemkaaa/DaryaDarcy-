import { expect, test } from "@playwright/test";
import { editorApi, failure, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

const saved = (id: number, target = "feed") => ({
  id,
  target,
  text: `SAVED_PAGE_${id}`,
  photos: [],
  media: [],
  tags: [],
  published: true,
  status: "published",
  source: "manual",
  richText: null,
  likeCount: 0,
  commentCount: 0,
  createdAt: "2026-10-01T00:00:00Z",
  publishedAt: null,
});

test("a forbidden reply group immediately hides retained comments of the post", async ({
  page,
}) => {
  await editorApi(page, (name, input) => {
    if (name === "club.listByCategory")
      return ok({
        posts: [
          {
            ...saved(1, "club"),
            tags: ["community"],
            createdAt: new Date().toISOString(),
            commentCount: 2,
          },
        ],
        nextCursor: null,
      });
    if (name === "club.commentsPage")
      return input.parentId
        ? failure(403)
        : ok({
            items: [
              {
                id: 1,
                postId: 1,
                parentId: null,
                userId: 102,
                text: "RETAINED_PRIVATE_COMMENT",
                photos: [],
                authorName: "Member",
                authorAvatarUrl: null,
                createdAt: new Date().toISOString(),
                likeCount: 0,
                likedByMe: false,
                replyCount: 1,
              },
            ],
            nextCursor: null,
            totalCount: 2,
          });
  });
  await gotoWithSession(page, "/club");
  await expect(
    page.getByText("RETAINED_PRIVATE_COMMENT", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Показать ответы (1)", exact: true })
    .click();
  await expect(
    page.getByText("RETAINED_PRIVATE_COMMENT", { exact: true }),
  ).toHaveCount(0);
});

test("saved polling refreshes the visible tail and rebuilds a changed cursor chain", async ({
  page,
}) => {
  await page.clock.install();
  const cursors: unknown[] = [];
  let moved = false;
  await editorApi(page, (name, input) => {
    if (name !== "feed.savedPostsPage") return;
    cursors.push(input.cursor ?? null);
    return ok(
      input.cursor
        ? {
            items: [saved(input.cursor === "fresh" ? 51 : 21)],
            nextCursor: null,
          }
        : {
            items: [saved(moved ? 50 : 1)],
            nextCursor: moved ? "fresh" : "next",
          },
    );
  });
  await gotoWithSession(page, "/profile");
  await page
    .getByRole("button", { name: "Загрузить ещё сохранённые", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Открыть публикацию: SAVED_PAGE_21",
      exact: true,
    }),
  ).toBeVisible();
  await page.clock.fastForward(61_000);
  await expect
    .poll(() => cursors.filter((x) => x === null).length)
    .toBeGreaterThan(1);
  await expect.poll(() => cursors.filter(Boolean)).toEqual(["next", "next"]);
  await expect(
    page.getByRole("button", {
      name: "Открыть публикацию: SAVED_PAGE_21",
      exact: true,
    }),
  ).toBeVisible();
  moved = true;
  await page.clock.fastForward(61_000);
  await expect(
    page.getByRole("button", {
      name: "Открыть публикацию: SAVED_PAGE_50",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Открыть публикацию: SAVED_PAGE_21",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect
    .poll(() => cursors.filter(Boolean))
    .toEqual(["next", "next", "fresh"]);
});

test("a late saved page cannot enter another account cache", async ({
  page,
}) => {
  let owner = 101;
  let requested!: () => void, release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    requested = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await editorApi(page, async (name, input) => {
    if (name !== "feed.savedPostsPage") return;
    if (input.cursor) {
      requested();
      await held;
      return ok({ items: [saved(999)], nextCursor: null });
    }
    return ok({
      items: [saved(owner)],
      nextCursor: owner === 101 ? "held" : null,
    });
  });
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: owner,
          openId: `owner-${owner}`,
          name: `OWNER_${owner}`,
          role: "admin",
          email: "cursor@example.test",
          lastSignedIn: "2026-10-01T00:00:00Z",
        },
      },
    }),
  );
  try {
    await gotoWithSession(page, "/profile");
    await page
      .getByRole("button", { name: "Загрузить ещё сохранённые", exact: true })
      .click();
    await waiting;
    owner = 202;
    await page.evaluate(() =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "darcy:session-change",
          newValue: "owner-202",
        }),
      ),
    );
    await expect(
      page.getByRole("button", {
        name: "Открыть публикацию: SAVED_PAGE_202",
        exact: true,
      }),
    ).toBeVisible();
    release();
    await expect(
      page.getByRole("button", {
        name: "Открыть публикацию: SAVED_PAGE_999",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: "Открыть публикацию: SAVED_PAGE_101",
        exact: true,
      }),
    ).toHaveCount(0);
  } finally {
    release();
  }
});

test("comment roots and nested replies load independently and keep the server total", async ({
  page,
}) => {
  const reads: Record<string, unknown>[] = [];
  const comment = (
    id: number,
    parentId: number | null = null,
    replyCount = 0,
  ) => ({
    id,
    postId: 1,
    parentId,
    replyCount,
    userId: 102,
    text: `COMMENT_PAGE_${id}`,
    photos: [],
    authorName: `Author ${id}`,
    authorAvatarUrl: null,
    createdAt: "2026-10-23T12:00:00Z",
    likeCount: 0,
    likedByMe: false,
  });
  await editorApi(page, (name, input) => {
    if (name === "club.listByCategory")
      return ok({
        posts: [
          {
            ...saved(1, "club"),
            tags: ["community"],
            createdAt: new Date().toISOString(),
            commentCount: 47,
          },
        ],
        nextCursor: null,
      });
    if (name === "club.comments") return failure(404);
    if (name !== "club.commentsPage") return;
    reads.push(input);
    const items =
      input.parentId === 101
        ? [comment(201, 101)]
        : input.parentId === 1
          ? input.cursor
            ? [comment(121, 1)]
            : Array.from({ length: 20 }, (_, i) =>
                comment(101 + i, 1, i === 0 ? 1 : 0),
              )
          : input.cursor
            ? Array.from({ length: 5 }, (_, i) => comment(21 + i))
            : Array.from({ length: 20 }, (_, i) =>
                comment(1 + i, null, i === 0 ? 21 : 0),
              );
    return ok({
      items,
      nextCursor: !input.cursor && input.parentId !== 101 ? "group-next" : null,
      totalCount: 47,
    });
  });
  await gotoWithSession(page, "/club");
  await expect(page.getByText("COMMENT_PAGE_1", { exact: true })).toBeVisible();
  await expect(
    page.getByText("47 комментариев", { exact: true }),
  ).toBeVisible();
  expect(reads.every((x) => !x.parentId && !x.cursor && x.limit === 20)).toBe(
    true,
  );
  await page
    .getByRole("button", { name: "Показать ответы (21)", exact: true })
    .click();
  await expect(
    page.getByText("COMMENT_PAGE_101", { exact: true }),
  ).toBeVisible();
  expect(reads.some((x) => x.parentId === 101)).toBe(false);
  await page
    .getByRole("button", { name: "Показать ответы (1)", exact: true })
    .click();
  await expect(
    page.getByText("COMMENT_PAGE_201", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ещё ответы (1)", exact: true })
    .click();
  await expect(
    page.getByText("COMMENT_PAGE_121", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ещё комментарии", exact: true })
    .click();
  await expect(
    page.getByText("COMMENT_PAGE_25", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("47 комментариев", { exact: true })).toHaveCount(
    1,
  );
});

test("members do not load for payments, and lost moderation replies inspect the exact page-two account", async ({
  page,
}) => {
  const reads: Record<string, unknown>[] = [];
  let blocked = false,
    writes = 0;
  const member = (id: number) => ({
    id,
    name: `MEMBER_${id}`,
    email: `m${id}@example.test`,
    contactPhone: null,
    role: "user",
    createdAt: "2026-10-01T00:00:00Z",
    blockedAt: id === 21 && blocked ? "2026-10-23T00:00:00Z" : null,
    blockedReason: id === 21 && blocked ? "Причина блокировки" : null,
    clubExpiresAt: null,
  });
  await editorApi(page, (name, input) => {
    if (name === "admin.members") {
      reads.push({ legacy: true });
      return failure(404);
    }
    if (name === "admin.membersPage") {
      reads.push(input);
      return ok(
        input.userId
          ? { items: [member(Number(input.userId))], nextCursor: null }
          : input.cursor
            ? { items: [member(21)], nextCursor: null }
            : {
                items: Array.from({ length: 20 }, (_, i) => member(i + 1)),
                nextCursor: "members-next",
              },
      );
    }
    if (name === "moderation.blockUser") {
      writes++;
      blocked = true;
      return failure(500);
    }
  });
  await gotoWithSession(page, "/admin");
  await page.getByRole("button", { name: "Оплаты", exact: true }).click();
  await expect(page.getByText("Оплат пока нет", { exact: true })).toBeVisible();
  expect(reads).toEqual([]);
  await page.getByRole("button", { name: "Участницы", exact: true }).click();
  await expect(page.getByText("MEMBER_1", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Загрузить ещё участниц", exact: true })
    .click();
  const row = page.getByText("MEMBER_21", { exact: true }).locator("..");
  await expect(row).toBeVisible();
  page.on("dialog", (dialog) => dialog.accept("Причина блокировки"));
  await row.getByRole("button", { name: "Заблокировать", exact: true }).click();
  await expect(
    page.getByText(/Результат действия.*не подтверждён/).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Обновить список", exact: true })
    .click();
  await expect
    .poll(() =>
      reads.some((x) => x.userId === 21 && x.limit === 1 && !x.cursor),
    )
    .toBe(true);
  await expect(row.getByText("Заблокирована", { exact: true })).toBeVisible();
  expect(writes).toBe(1);
});

test("saved tabs request only their own pages, deduplicate overlap and retry the same cursor", async ({
  page,
}) => {
  const reads: Record<string, unknown>[] = [];
  let failing = true;
  await editorApi(page, (name, input) => {
    if (name === "feed.savedPosts") return failure(404);
    if (name !== "feed.savedPostsPage") return;
    reads.push(input);
    if (input.target === "club")
      return ok({ items: [saved(31, "club")], nextCursor: null });
    if (input.cursor)
      return failing
        ? failure(400)
        : ok({ items: [saved(20), saved(21)], nextCursor: null });
    return ok({
      items: Array.from({ length: 20 }, (_, i) => saved(i + 1)),
      nextCursor: "saved-next",
    });
  });
  await gotoWithSession(page, "/profile");
  await expect(
    page.getByRole("button", {
      name: "Открыть публикацию: SAVED_PAGE_1",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    reads.every((x) => x.target === "feed" && !x.cursor && x.limit === 20),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Загрузить ещё сохранённые", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Повторить загрузку сохранённых",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Открыть публикацию: SAVED_PAGE_1",
      exact: true,
    }),
  ).toHaveCount(1);
  failing = false;
  await page
    .getByRole("button", {
      name: "Повторить загрузку сохранённых",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Открыть публикацию: SAVED_PAGE_21",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Открыть публикацию: SAVED_PAGE_20",
      exact: true,
    }),
  ).toHaveCount(1);
  expect(reads.filter((x) => x.cursor).map((x) => x.cursor)).toEqual([
    "saved-next",
    "saved-next",
  ]);
  await page.getByRole("button", { name: "Из клуба", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Открыть публикацию: SAVED_PAGE_31",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Открыть публикацию: SAVED_PAGE_21",
      exact: true,
    }),
  ).toHaveCount(0);
});
