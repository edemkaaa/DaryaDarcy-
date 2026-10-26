import { test, expect, type Page } from "@playwright/test";
import { layoutApi, gotoWithSession } from "./layout-fixtures";
import { ok } from "./editor-fixtures";

const photo = "/api/media/content-files/11111111-1111-4111-8111-111111111111";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=",
  "base64",
);
function post(extra: Record<string, unknown> = {}) {
  return {
    id: 1,
    text: "AUDIT_POST",
    photos: [],
    tags: ["podborki"],
    media: [],
    target: "both",
    published: true,
    status: "published",
    sortOrder: 0,
    richText: null,
    createdAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    likeCount: 0,
    commentCount: 0,
    ...extra,
  };
}
async function fixture(
  page: Page,
  options: {
    paid?: boolean;
    admin?: boolean;
    posts?: ReturnType<typeof post>[];
    article?: unknown;
  } = {},
) {
  await page.route("https://**", (r) => r.abort());
  await layoutApi(page, true);
  await page.route("**/api/auth/me", (r) =>
    r.fulfill({
      json: {
        user: {
          id: 101,
          openId: "audit-user",
          name: "Аудит",
          email: "audit@example.test",
          role: options.admin ? "admin" : "user",
          lastSignedIn: new Date().toISOString(),
        },
      },
    }),
  );
  const writes: Record<string, unknown>[] = [];
  const posts = options.posts ?? [post()];
  await page.route("**/api/trpc/**", async (r) => {
    const u = new URL(r.request().url());
    const names = u.pathname.split("/api/trpc/")[1].split(",");
    const input = JSON.parse(
      r.request().postData() ?? u.searchParams.get("input") ?? "{}",
    );
    const result = names.map((name, i) => {
      if (name === "club.subscription")
        return ok({
          hasClubAccess: options.paid !== false,
          subscribed: options.paid !== false,
          expiresAt: options.paid === false ? null : "2040-01-01T00:00:00Z",
          cancelAtPeriodEnd: false,
          cancellationStatus: "none",
          isOwner: false,
          monthlyPrice: "790",
        });
      if (name === "feed.listPaginated" || name === "club.listByCategory")
        return ok({ posts, nextCursor: null });
      if (name === "feed.getById") return ok(posts[0]);
      if (name === "feed.interactionsForPosts")
        return ok({ likedIds: [], savedIds: [1] });
      if (name === "feed.savedPosts") return ok(posts);
      if (name === "articles.getById") return ok(options.article ?? null);
      if (name === "admin.updatePost") {
        writes.push(input[i]?.json ?? input.json ?? {});
        return ok({ success: true });
      }
      return ok([]);
    });
    await r.fulfill({ json: u.searchParams.has("batch") ? result : result[0] });
  });
  await page.route("**/api/media/content-files/**", (r) =>
    r.fulfill({ contentType: "image/png", body: png }),
  );
  await page.route("https://audit.example.test/**", (r) =>
    r.fulfill({ contentType: "image/png", body: png }),
  );
  return writes;
}

test("canonical uploaded photo stays visible in feed and detail", async ({
  page,
}) => {
  await fixture(page, { posts: [post({ photos: [photo] })] });
  await gotoWithSession(page, "/feed");
  await expect(page.getByText("AUDIT_POST", { exact: true })).toBeVisible();
  await expect(
    page.locator('img[src*="/api/media/content-files/"]'),
  ).toHaveCount(1);
  await gotoWithSession(page, "/post/1");
  await expect(
    page.locator('img[src*="/api/media/content-files/"]'),
  ).toHaveCount(1);
});
test("unpaid member can log out while public bookmarks remain available", async ({
  page,
}) => {
  await fixture(page, { paid: false });
  await gotoWithSession(page, "/profile");
  await expect(
    page.getByRole("button", {
      name: "Открыть публикацию: AUDIT_POST",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Выйти", exact: true }),
  ).toBeVisible();
  await page.route("**/api/auth/logout", (r) =>
    r.fulfill({ json: { success: true } }),
  );
  await page.route("**/api/auth/me", (r) =>
    r.fulfill({ json: { user: null } }),
  );
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Войти →", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("AUDIT_POST", { exact: true })).toHaveCount(0);
});
test("newly published old draft permits comments in detail and club", async ({
  page,
}) => {
  await fixture(page, {
    posts: [post({ tags: ["community"], createdAt: "2026-01-01T00:00:00Z" })],
  });
  await gotoWithSession(page, "/post/1");
  await expect(page.getByText("AUDIT_POST", { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("Написать комментарий...")).toBeVisible();
  await gotoWithSession(page, "/club");
  await page.getByRole("button", { name: "Комьюнити", exact: true }).click();
  await expect(page.getByPlaceholder("Написать комментарий...")).toBeVisible();
});
test("article viewer opens the clicked cover and body photo", async ({
  page,
}) => {
  const cover = "https://audit.example.test/cover.png",
    body = "https://audit.example.test/body.png";
  await fixture(page, {
    article: {
      id: 42,
      title: "AUDIT_ARTICLE",
      access: "public",
      locked: false,
      coverUrl: cover,
      sections: [{ type: "photo", url: body }],
    },
  });
  await gotoWithSession(page, "/library/article/42");
  await page
    .getByRole("button", { name: "Открыть обложку статьи", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator('img[src*="cover.png"]')).toHaveCount(1);
  await expect(dialog.getByText("1 / 2", { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Предыдущее фото", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole("button", { name: "Закрыть фотографии", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Открыть изображение статьи", exact: true })
    .click();
  await expect(dialog.getByText("2 / 2", { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Следующее фото", exact: true }),
  ).toBeDisabled();
});
test("article teaser grid links to the full article", async ({ page }) => {
  await fixture(page, {
    posts: [
      post({
        source: "article:42",
        photos: ["https://audit.example.test/cover.png"],
      }),
    ],
  });
  await gotoWithSession(page, "/feed");
  await page
    .getByRole("button", { name: "Показать сеткой", exact: true })
    .click();
  await expect(page.locator('a[href="/post/1"]')).toHaveCount(0);
  await expect(page.locator('a[href="/library/article/42"]')).toHaveCount(1);
  await page.locator('a[href="/library/article/42"]').click();
  await expect(page).toHaveURL(/\/library\/article\/42$/);
});
test("club editor preserves both audience and saves an explicit club restriction", async ({
  page,
}) => {
  const writes = await fixture(page, { admin: true });
  await gotoWithSession(page, "/club");
  await page
    .getByRole("button", { name: "Действия с постом", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Редактировать пост", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Редактор публикации" });
  await expect(
    dialog.getByText("Черновик сохранён на этом устройстве", { exact: true }),
  ).toBeVisible();
  const club = dialog.getByRole("button", { name: "Клуб", exact: true }),
    both = dialog.getByRole("button", { name: "Везде", exact: true });
  const colors = await Promise.all([
    club.evaluate((e) => getComputedStyle(e).backgroundColor),
    both.evaluate((e) => getComputedStyle(e).backgroundColor),
  ]);

  expect(colors[0]).not.toBe(colors[1]);
  await club.click();
  expect(await club.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(
    colors[1],
  );
  await dialog
    .getByPlaceholder("Текст поста… Enter — новый абзац")
    .fill("AUDIT_CHANGED");
  await expect(
    dialog.getByText("Черновик сохранён на этом устройстве", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toMatchObject({ id: 1, text: "AUDIT_CHANGED" });
  expect(writes[0]).toHaveProperty("target", "club");
});

for (const status of ["checking", "error"] as const) {
  test(`member can log out while subscription is ${status}`, async ({
    page,
  }) => {
    await fixture(page);
    await page.route("**/api/trpc/**", async (r) => {
      const u = new URL(r.request().url());
      const names = u.pathname.split("/api/trpc/")[1].split(",");
      if (!names.includes("club.subscription")) return r.fallback();
      if (status === "checking") return; // Intentionally leave this request unanswered.
      await r.fulfill({
        status: 503,
        json: names.map((name) =>
          name === "club.subscription"
            ? {
                error: {
                  json: {
                    message: "Unavailable",
                    code: -32603,
                    data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 503 },
                  },
                },
              }
            : ok([]),
        ),
      });
    });
    await gotoWithSession(page, "/profile");
    if (status === "error")
      await expect(
        page.getByText("Не удалось проверить подписку. Попробуйте ещё раз.", {
          exact: true,
        }),
      ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Выйти", exact: true }),
    ).toBeVisible();
  });
}

test("saved article teaser opens the full article", async ({ page }) => {
  await fixture(page, {
    posts: [post({ source: "article:42" })],
    article: {
      id: 42,
      title: "FULL_ARTICLE",
      access: "public",
      locked: false,
      sections: [],
    },
  });
  await gotoWithSession(page, "/profile");
  await page.getByText("AUDIT_POST", { exact: true }).first().click();
  await expect(page).toHaveURL(/\/library\/article\/42$/);
  await expect(page.getByText("FULL_ARTICLE", { exact: true })).toBeVisible();
});
