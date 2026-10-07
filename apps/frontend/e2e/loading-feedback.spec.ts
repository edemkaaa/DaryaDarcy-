import { test, expect } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

for (const width of [390, 1440]) {
  test(`slow tab code and API use placeholders and preserve the video banner (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await layoutApi(page);
    let finish!: () => void;
    const held = new Promise<void>((resolve) => {
      finish = resolve;
    });
    await page.route("**/api/trpc/**", async (route) => {
      if (
        /videos\.list|feed\.listPaginated/.test(
          decodeURIComponent(route.request().url()),
        )
      )
        await held;
      await route.fallback();
    });
    await page.route("**/_next/static/**/*.js", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fallback();
    });
    try {
      await gotoWithSession(page, "/");
      await page.evaluate(() => {
        Object.assign(window, { maxNavigationSpinners: 0 });
        const sample = () => {
          const visible = [
            ...document.querySelectorAll("main .ui-spinner"),
          ].filter((node) => node.getBoundingClientRect().width > 0);
          const state = window as unknown as { maxNavigationSpinners: number };
          state.maxNavigationSpinners = Math.max(
            state.maxNavigationSpinners,
            visible.length,
          );
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      await page.locator('nav a[href="/videos"]').click();
      await expect(
        page.locator('[data-content-placeholder="video"]:visible'),
      ).toBeVisible();
      await expect(page.locator('[data-loading-screen="/videos"]')).toHaveCount(
        0,
      );
      await page.evaluate(() => document.fonts.ready);
      const heading = page.getByText("ВИДЕО", { exact: true });
      const position = await heading.boundingBox();
      const preview = page.locator('[data-content-placeholder="video"]');
      const cover = preview.locator('[aria-hidden="true"] > div > div').first();
      const rect = (await cover.boundingBox())!;
      expect(rect.width / rect.height).toBeCloseTo(16 / 9, 2);
      await page.locator('nav a[href="/feed"]').click();
      await expect(
        page.locator('[data-content-placeholder="feed"]:visible'),
      ).toBeVisible();
      finish();
      await expect(
        page.locator('[data-content-placeholder="feed"]:visible'),
      ).toHaveCount(0);
      for (const path of [
        "/interactive",
        "/library",
        "/shop",
        "/club",
        "/videos",
      ]) {
        await page.locator(`nav a[href="${path}"]`).click();
        await expect(
          page.locator(`[data-tab-screen="${path}"]:not([hidden])`),
        ).toBeVisible();
      }
      await expect(
        page.locator('[data-content-placeholder="video"]:visible'),
      ).toHaveCount(0);
      expect(await heading.boundingBox()).toEqual(position);
      expect(
        await page.evaluate(
          () =>
            (window as unknown as { maxNavigationSpinners: number })
              .maxNavigationSpinners,
        ),
      ).toBe(0);
      await expect(page.locator('nav[aria-label="Разделы"]')).toBeInViewport();
    } finally {
      finish();
    }
  });
}

test("access checks have one centered indicator and checkout has one small indicator inside its button", async ({
  page,
}) => {
  await layoutApi(page);
  let finishSession!: () => void;
  let finishCheckout!: () => void;
  const session = new Promise<void>((resolve) => {
    finishSession = resolve;
  });
  const checkout = new Promise<void>((resolve) => {
    finishCheckout = resolve;
  });
  await page.route("**/api/auth/me", async (route) => {
    await session;
    await route.fallback();
  });
  await page.route("**/api/trpc/club.createCheckout**", async (route) => {
    await checkout;
    await route.fulfill({ status: 503, json: {} });
  });
  try {
    await page.goto("/club", { waitUntil: "domcontentloaded" });
    const access = page.locator("main .ui-spinner:visible");
    await expect(access).toHaveCount(1);
    await expect(access).toHaveCSS("width", "36px");
    const main = (await page.locator("main").boundingBox())!;
    const spinner = (await access.boundingBox())!;
    expect(spinner.x + spinner.width / 2).toBeCloseTo(
      main.x + main.width / 2,
      0,
    );
    finishSession();
    await expect(access).toHaveCount(0);
    await page
      .getByPlaceholder("Почта для чека и входа")
      .first()
      .fill("guest@example.test");
    const button = page
      .getByPlaceholder("Почта для чека и входа")
      .first()
      .locator("..")
      .getByRole("button")
      .first();
    await button.click();
    await expect(button).toBeDisabled();
    await expect(button.locator(".ui-spinner")).toHaveCSS("width", "20px");
    await expect(button.locator(".ui-spinner")).toHaveCount(1);
    await expect(page.locator("main .ui-loading-indicator")).toHaveCount(0);
    finishCheckout();
    await expect(button).toBeEnabled();
    await expect(page.locator("main .ui-spinner:visible")).toHaveCount(0);
  } finally {
    finishSession();
    finishCheckout();
  }
});
