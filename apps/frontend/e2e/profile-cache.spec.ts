import { expect, test } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";
import { ok } from "./editor-fixtures";

/** Создаём различимые закладки ленты и клуба с общей структурой карточки. */
const savedPost = (id: number, text: string, target: "feed" | "club") => ({
  id,
  text,
  target,
  photos: [],
  media: [],
  tags: [],
  richText: null,
  source: "",
  published: true,
  likeCount: 0,
  commentCount: 0,
  createdAt: "2026-10-01T12:00:00Z",
  publishedAt: "2026-10-01T12:00:00Z",
});

/** После предварительного подтверждения access-scope измеряем ровно запросы профиля: retained-вкладка хранит имя-черновик, выбранный target и scroll, а stale-read не очищает подтверждённые карточки. */
for (const width of [390, 1440]) {
  test(`profile retains its draft, saved tab and scroll; stale bookmarks recheck once (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.clock.install();
    let version = "OLD";
    let reads = 0;
    let pending: Promise<void> | undefined;
    let pendingReads = 0;
    await layoutApi(page, true, (name) =>
      name === "feed.savedPosts"
        ? ok(
            Array.from({ length: 16 }, (_, index) =>
              savedPost(
                index + 1,
                `${version}_SAVED_${index + 1}`,
                index % 2 ? "club" : "feed",
              ),
            ),
          )
        : undefined,
    );
    await page.route("**/api/trpc/**", async (route) => {
      const names = decodeURIComponent(new URL(route.request().url()).pathname)
        .split("/api/trpc/")[1]
        .split(",");
      if (names.includes("feed.savedPostsPage")) {
        reads++;
        if (pending) {
          pendingReads++;
          await pending;
        }
      }
      await route.fallback();
    });
    // Establish session/access before measuring profile-cache requests: the
    // profile uses a new cache scope when club access is first confirmed.
    const subscription = page.waitForResponse((response) =>
      response.url().includes("club.subscription"),
    );
    await gotoWithSession(page, "/library");
    await (await subscription).finished();
    await expect(page.getByPlaceholder("Поиск материалов...")).toBeVisible();
    await page.clock.runFor(100);
    await page
      .getByRole("link", { name: "Открыть профиль", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Открыть публикацию: OLD_SAVED_1",
        exact: true,
      }),
    ).toBeVisible();
    await page.clock.runFor(100);
    expect(reads).toBe(1);
    await page.evaluate(() => document.fonts.ready);
    const profile = page.locator('[data-tab-screen="/profile"]');
    const scroll = (await profile
      .locator(".ui-scroll")
      .first()
      .elementHandle())!;
    await page.getByRole("button", { name: "Участница", exact: true }).click();
    const name = page.getByRole("textbox", {
      name: "Имя профиля",
      exact: true,
    });
    await name.fill("UNSAVED_PROFILE_DRAFT");
    const field = (await name.elementHandle())!;
    await page.getByRole("button", { name: "Из клуба", exact: true }).click();
    await page.clock.runFor(250);
    const top = await scroll.evaluate((node) => {
      node.scrollTop = 300;
      return node.scrollTop;
    });
    await page.locator('nav[aria-label="Разделы"] a[href="/library"]').click();
    await expect(profile).toBeHidden();
    await page
      .getByRole("link", { name: "Открыть профиль", exact: true })
      .click();
    await expect(name).toHaveValue("UNSAVED_PROFILE_DRAFT");
    expect(await field.evaluate((node) => node.isConnected)).toBe(true);
    expect(await scroll.evaluate((node) => node.scrollTop)).toBe(top);
    await expect(
      profile.getByRole("button", {
        name: "Открыть публикацию: OLD_SAVED_2",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      profile.getByRole("button", {
        name: "Открыть публикацию: OLD_SAVED_1",
        exact: true,
      }),
    ).toHaveCount(0);
    await page.clock.runFor(100);
    // Feed and club bookmarks have independent paginated queries.
    expect(reads).toBe(2);

    await page.locator('nav[aria-label="Разделы"] a[href="/library"]').click();
    await page.clock.fastForward(61_000);
    await page.clock.runFor(100);
    expect(reads).toBe(2);
    let release!: () => void;
    pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    try {
      await page
        .getByRole("link", { name: "Открыть профиль", exact: true })
        .click();
      await expect.poll(() => pendingReads).toBe(1);
      await expect(
        profile.getByRole("button", {
          name: "Открыть публикацию: OLD_SAVED_2",
          exact: true,
        }),
      ).toBeVisible();
      await expect(profile.locator("[data-content-placeholder]")).toHaveCount(
        0,
      );
      expect(await scroll.evaluate((node) => node.scrollTop)).toBe(top);
      version = "NEW";
    } finally {
      pending = undefined;
      release();
    }
    await expect(
      profile.getByRole("button", {
        name: "Открыть публикацию: NEW_SAVED_2",
        exact: true,
      }),
    ).toBeVisible();
    expect(reads).toBe(3);
    expect(await field.evaluate((node) => node.isConnected)).toBe(true);
    await expect(name).toHaveValue("UNSAVED_PROFILE_DRAFT");
  });
}

/** Смена личности удаляет скрытый профиль вместе с незаписанным вводом и не переносит account-scoped черновик новому владельцу. */
test("switching accounts clears a hidden profile and its unsaved state", async ({
  page,
}) => {
  let owner = 101;
  await layoutApi(page, true, (name) =>
    name === "feed.savedPosts"
      ? ok([
          savedPost(
            owner,
            owner === 101 ? "FIRST_PRIVATE_BOOKMARK" : "SECOND_BOOKMARK",
            "feed",
          ),
        ])
      : undefined,
  );
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: owner,
          openId: `profile-cache-${owner}`,
          name: `Owner ${owner}`,
          email: `owner-${owner}@example.test`,
          role: "user",
          gender: "female",
          lastSignedIn: "2026-10-01T12:00:00Z",
        },
      },
    }),
  );
  await gotoWithSession(page, "/profile");
  await expect(
    page.getByRole("button", {
      name: "Открыть публикацию: FIRST_PRIVATE_BOOKMARK",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Owner 101", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Имя профиля", exact: true })
    .fill("FIRST_PRIVATE_DRAFT");
  await page.locator('nav[aria-label="Разделы"] a[href="/library"]').click();
  await expect(page.getByPlaceholder("Поиск материалов...")).toBeVisible();
  owner = 202;
  await page.evaluate(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "darcy:session-change",
        newValue: "second-owner",
      }),
    ),
  );
  await expect(page.locator('[data-tab-screen="/profile"]')).toHaveCount(0);
  await expect(page.getByText("FIRST_PRIVATE_BOOKMARK")).toHaveCount(0);
  await page
    .getByRole("link", { name: "Открыть профиль", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Owner 202", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Открыть публикацию: SECOND_BOOKMARK",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Имя профиля", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("darcy:user:202:@darcy_profile_name_draft"),
    ),
  ).toBeNull();
});
