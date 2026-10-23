import { expect, test, type Page } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

const clubMenu = (page: Page) =>
  page.getByRole("navigation", { name: "Разделы клуба", exact: true });
const appMenu = (page: Page) =>
  page.getByRole("navigation", { name: "Разделы", exact: true });

async function memberApi(page: Page, hasAccess: () => boolean) {
  await layoutApi(page, true);
  await page.route("**/api/trpc/**", (route) => {
    const url = new URL(route.request().url());
    const names = decodeURIComponent(url.pathname.split("/api/trpc/")[1]).split(
      ",",
    );
    if (!names.includes("club.subscription")) return route.fallback();
    return route.fulfill({
      json: names.map((name) => ({
        result: {
          data: {
            json:
              name === "club.subscription"
                ? {
                    hasClubAccess: hasAccess(),
                    subscribed: hasAccess(),
                    expiresAt: "2040-11-01T10:00:00Z",
                    cancelAtPeriodEnd: false,
                    cancellationStatus: "none",
                    isOwner: false,
                    monthlyPrice: "790",
                  }
                : name === "club.list"
                  ? { posts: [], nextCursor: null }
                  : name === "feed.userInteractions"
                    ? { likedIds: [], savedIds: [] }
                    : [],
          },
        },
      })),
    });
  });
}

for (const width of [320, 390, 1440]) {
  test(`club navigation has only four club items and restores the app menu on exit (${width}px)`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await layoutApi(page, true);
    await gotoWithSession(page, "/club");
    const menu = clubMenu(page);
    await expect(menu).toBeVisible();
    await expect(appMenu(page)).toHaveCount(0);
    await expect(page.getByRole("navigation")).toHaveCount(1);
    await expect(menu.getByRole("button")).toHaveCount(4);
    const box = (await menu.boundingBox())!;
    expect(box.y + box.height).toBe(844);
    expect(box.height).toBe(width < 359 ? 63 : 66);
    await menu
      .locator("img")
      .evaluateAll((images) =>
        Promise.all(
          images.map((image) => (image as HTMLImageElement).decode()),
        ),
      );
    await page.screenshot({
      path: info.outputPath(`club-only-menu-${width}.png`),
    });
    for (const name of ["Подборки", "Комьюнити", "Эксклюзив", "Лайф"]) {
      const item = menu.getByRole("button", { name, exact: true });
      await expect(item).toBeInViewport();
      await item.click();
      await expect(item).toHaveAttribute("aria-pressed", "true");
    }
    await page.getByRole("link", { name: "На главную", exact: true }).click();
    await expect(appMenu(page)).toBeVisible();
    await expect(appMenu(page).getByRole("link")).toHaveCount(6);
    await expect(clubMenu(page)).toHaveCount(0);
    await appMenu(page)
      .getByRole("link", { name: "Клуб", exact: true })
      .click();
    await expect(menu).toBeVisible();
    await expect(appMenu(page)).toHaveCount(0);
    await expect(
      menu.getByRole("button", { name: "Лайф", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  });
}

for (const authenticated of [false, true]) {
  test(`club navigation keeps the app menu on the subscription landing (${authenticated ? "signed in" : "guest"})`, async ({
    page,
  }) => {
    if (authenticated) await memberApi(page, () => false);
    else await layoutApi(page);
    await gotoWithSession(page, "/club");
    await expect(
      page
        .getByRole("button", {
          name: /^(Оплатить 790 ₽|Открыть тестовую оплату)$/,
        })
        .first(),
    ).toBeVisible();
    await expect(appMenu(page)).toBeVisible();
    await expect(clubMenu(page)).toHaveCount(0);
  });
}

test("club navigation restores the app menu when confirmed club access is lost", async ({
  page,
}) => {
  let access = true;
  await memberApi(page, () => access);
  await gotoWithSession(page, "/club");
  await expect(clubMenu(page)).toBeVisible();
  await expect(appMenu(page)).toHaveCount(0);
  access = false;
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes("club.subscription"),
    ),
    page.evaluate(() => {
      window.dispatchEvent(new Event("offline"));
      window.dispatchEvent(new Event("online"));
    }),
  ]);
  await expect(appMenu(page)).toBeVisible();
  await expect(clubMenu(page)).toHaveCount(0);
});
