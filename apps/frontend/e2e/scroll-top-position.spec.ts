import { expect, test, type Page } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

const scrollArea = (page: Page) =>
  page.locator("main .ui-scroll:not(.ui-scroll-horizontal):visible").first();
const topButton = (page: Page) =>
  page.getByRole("button", { name: "Наверх", exact: true });

test.use({ hasTouch: true });

async function fixtures(page: Page, owner: boolean) {
  await layoutApi(page, true);
  if (owner)
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        json: {
          user: {
            id: 101,
            openId: "owner",
            name: "Admin",
            email: "owner@example.test",
            role: "admin",
            avatarUrl: null,
            lastSignedIn: "2026-10-09T10:00:00Z",
          },
        },
      }),
    );
  await page.route(
    /https:\/\/(s3\.twcstorage\.ru|images\.example\.test|example\.test)\//,
    (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800"><rect width="640" height="800" fill="#e4cfb4"/></svg>',
      }),
  );
  await page.route("**/api/trpc/**", (route) => {
    const url = new URL(route.request().url());
    const names = decodeURIComponent(url.pathname.split("/api/trpc/")[1]).split(
      ",",
    );
    const posts = Array.from({ length: 32 }, (_, index) => ({
      id: index + 1,
      text: `Публикация ${index + 1}. ${"Текст последнего поста.\n".repeat(6)}`,
      photos: [`https://images.example.test/${index}.svg`],
      tags: ["Комьюнити"],
      media: [],
      richText: null,
      likeCount: 0,
      commentCount: 0,
      createdAt: "2026-10-01T12:00:00Z",
      publishedAt: "2026-10-01T12:00:00Z",
    }));
    return route.fulfill({
      json: names.map((name) => ({
        result: {
          data: {
            json:
              name === "club.subscription"
                ? {
                    hasClubAccess: true,
                    subscribed: true,
                    cancelAtPeriodEnd: false,
                    isOwner: owner,
                    expiresAt: owner ? null : "2040-11-01T10:00:00Z",
                    monthlyPrice: "790",
                  }
                : name === "feed.listPaginated" || name === "club.list"
                  ? {
                      posts: posts.map((post) => ({
                        ...post,
                        target: name === "club.list" ? "club" : "feed",
                      })),
                      nextCursor: null,
                    }
                  : name === "feed.userInteractions"
                    ? { likedIds: [], savedIds: [] }
                    : [],
          },
        },
      })),
    });
  });
}

async function ending(page: Page) {
  const scroll = scrollArea(page);
  await expect(
    scroll.locator(".ui-collection-item, .ui-collection-row").first(),
  ).toBeVisible();
  await scroll.evaluate(async (el) => {
    await document.fonts.ready;
    el.scrollTop = el.scrollHeight;
  });
  await expect(topButton(page)).toBeVisible();
  await expect
    .poll(async () => {
      // A windowed collection may refine its estimated height after rendering.
      return scroll.evaluate((el) => {
        const gap = el.scrollHeight - el.clientHeight - el.scrollTop;
        el.scrollTop = el.scrollHeight;
        return Math.abs(gap);
      });
    })
    .toBeLessThan(2);
}

async function clearance(page: Page, club: boolean, owner: boolean) {
  const geometry = await page.evaluate(
    ({ club, owner }) => {
      const rect = (el: Element) => {
        const r = el.getBoundingClientRect();
        return {
          left: r.left,
          top: r.top,
          right: r.right,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
        };
      };
      const arrow = document.querySelector('button[aria-label="Наверх"]')!;
      const floating = [arrow];
      if (owner)
        floating.push(
          document.querySelector('button[aria-label="Открыть админку"]')!,
          document.querySelector('button[aria-label="Новый пост"]')!,
        );
      const scroll = Array.from(
        document.querySelectorAll<HTMLElement>(
          "main .ui-scroll:not(.ui-scroll-horizontal)",
        ),
      ).find((el) => el.clientHeight > 0)!;
      const cards = Array.from(
        scroll.querySelectorAll(".ui-collection-item, .ui-collection-row"),
      );
      return {
        arrow: rect(arrow),
        menu: rect(
          document.querySelector(
            club ? '[class*="clubTabBar"]' : 'nav[aria-label="Разделы"]',
          )!,
        ),
        last: rect(cards.at(-1)!),
        main: rect(document.querySelector("main")!),
        floating: floating.map(rect),
        reachable: floating.every((el) => {
          const r = el.getBoundingClientRect();
          return [
            [0.5, 0.5],
            [0.2, 0.5],
            [0.8, 0.5],
          ].every(([x, y]) =>
            el.contains(
              document.elementFromPoint(
                r.left + r.width * x,
                r.top + r.height * y,
              ),
            ),
          );
        }),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    },
    { club, owner },
  );
  expect(geometry.menu.top - geometry.arrow.bottom).toBeCloseTo(16, 0);
  expect(geometry.arrow.width).toBe(44);
  expect(geometry.arrow.height).toBe(44);
  expect(geometry.last.bottom).toBeLessThanOrEqual(
    Math.min(...geometry.floating.map((r) => r.top)) - 16,
  );
  expect(geometry.reachable).toBe(true);
  expect(geometry.overflow).toBe(false);
  for (const [index, box] of geometry.floating.entries()) {
    expect(box.top).toBeGreaterThanOrEqual(geometry.main.top);
    expect(box.bottom).toBeLessThanOrEqual(geometry.menu.top - 16);
    expect(box.left).toBeGreaterThanOrEqual(geometry.main.left);
    expect(box.right).toBeLessThanOrEqual(geometry.main.right);
    for (const other of geometry.floating.slice(index + 1))
      expect(
        box.right <= other.left ||
          other.right <= box.left ||
          box.bottom <= other.top ||
          other.bottom <= box.top,
      ).toBe(true);
  }
  return geometry;
}

for (const [width, height] of [
  [320, 400],
  [390, 844],
  [480, 320],
  [1440, 900],
]) {
  for (const view of ["feed", "grid", "club"]) {
    for (const owner of [false, true]) {
      test(`${view} ${owner ? "owner" : "member"} floating actions clear the final content at ${width}x${height}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height });
        await fixtures(page, owner);
        await gotoWithSession(page, view === "club" ? "/club" : "/feed");
        if (view === "grid")
          await page
            .getByRole("button", { name: "Показать сеткой", exact: true })
            .tap();
        await ending(page);
        await clearance(page, view === "club", owner);
        if (width === 390 || height === 320)
          await page.screenshot({
            path: test.info().outputPath("floating-controls.png"),
          });
        await topButton(page).tap();
        await expect
          .poll(() => scrollArea(page).evaluate((el) => el.scrollTop))
          .toBeLessThan(1);
        await expect(topButton(page)).toHaveCount(0);
      });
    }
  }
}

for (const club of [false, true]) {
  test(`${club ? "club" : "feed"} follows menu resizing without covering final actions`, async ({
    page,
  }) => {
    await fixtures(page, true);
    await gotoWithSession(page, club ? "/club" : "/feed");
    await ending(page);
    const before = await clearance(page, club, true);
    await page.addStyleTag({
      content: club
        ? '[class*="clubTabBar"] {padding-bottom: 34px;}'
        : 'nav[aria-label="Разделы"] {height: 96px; padding-bottom: 34px;}',
    });
    await expect
      .poll(async () => {
        const box = (await topButton(page).boundingBox())!;
        return Math.abs(box.y - (before.arrow.top - 20));
      })
      .toBeLessThan(1);
    await ending(page);
    await clearance(page, club, true);
    await page.getByRole("link", { name: "Библиотека", exact: true }).tap();
    await expect(topButton(page)).toHaveCount(0);
  });
}

for (const club of [false, true]) {
  test(`${club ? "club" : "feed"} floating controls clear the returning header in landscape`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 480, height: 320 });
    await fixtures(page, true);
    await gotoWithSession(page, club ? "/club" : "/feed");
    await ending(page);
    await scrollArea(page).evaluate((el) => {
      el.scrollTop -= 24;
    });
    const header = page.getByRole("banner", { name: "Навигация профиля" });
    await expect(header).toHaveAttribute("data-hidden", "false");
    await expect
      .poll(() =>
        header.evaluate((el) => Math.abs(el.getBoundingClientRect().top)),
      )
      .toBeLessThan(1);
    const floating = [
      topButton(page),
      page.getByRole("button", { name: "Открыть админку", exact: true }),
      page.getByRole("button", { name: "Новый пост", exact: true }),
    ];
    const controls = header.locator("a,button");
    for (const control of await controls.all()) {
      const box = (await control.boundingBox())!;
      for (const action of floating) {
        const other = (await action.boundingBox())!;
        expect(
          box.x + box.width <= other.x ||
            other.x + other.width <= box.x ||
            box.y + box.height <= other.y ||
            other.y + other.height <= box.y,
        ).toBe(true);
      }
    }
    await page.getByRole("button", { name: "Новый пост", exact: true }).tap();
    await expect(
      page.getByPlaceholder("Текст поста… Enter — новый абзац"),
    ).toBeVisible();
  });
}
