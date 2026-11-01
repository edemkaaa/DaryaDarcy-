import { expect, test, type Locator, type Page } from "@playwright/test";
import { mp4Fixture } from "../../../tests/helpers/media-fixtures";
import {
  GARDEN_POSTER_URL,
  GARDEN_VIDEO_URL,
} from "../src/features/home/garden-tour-video.content";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

type Mode = "available" | "network" | "http" | "corrupt";
async function fixture(page: Page, mode: Mode = "available") {
  const state = { mode, requests: 0 };
  await layoutApi(page);
  await page.route("**/api/capabilities", (route) =>
    route.fulfill({ json: { privateContentUploads: false } }),
  );
  // Decorations and the real 125 MB video stay outside this browser fixture.
  await page.route("https://**", (route) => route.abort());
  await page.route(GARDEN_VIDEO_URL, (route) => {
    state.requests++;
    if (state.mode === "network") return route.abort("failed");
    if (state.mode === "http")
      return route.fulfill({ status: 503, body: "Unavailable" });
    return route.fulfill({
      contentType: "video/mp4",
      body:
        state.mode === "available" ? mp4Fixture : Buffer.from("Invalid media"),
    });
  });
  await gotoWithSession(page, "/");
  const trigger = page.getByRole("button", {
    name: "Смотреть тур по моему саду",
    exact: true,
  });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click({ trial: true });
  return { state, trigger };
}

const video = (page: Page) => page.locator("video");
const notice = (page: Page) =>
  page.getByRole("alert").filter({ hasText: "Не удалось воспроизвести видео" });
const retry = (page: Page) =>
  page.getByRole("button", { name: "Повторить загрузку видео", exact: true });
const ready = (page: Page) =>
  expect
    .poll(() =>
      video(page).evaluate((node: HTMLVideoElement) => node.readyState),
    )
    .toBeGreaterThanOrEqual(2);
const played = (page: Page) =>
  expect
    .poll(() =>
      video(page).evaluate((node: HTMLVideoElement) => node.played.length),
    )
    .toBeGreaterThan(0);

for (const screen of [
  { width: 320, height: 844, touch: true },
  { width: 1440, height: 900, touch: false },
]) {
  test.describe(`garden video ${screen.width}px`, () => {
    test.use({
      viewport: screen,
      hasTouch: screen.touch,
      isMobile: screen.touch,
    });
    const activate = (button: Locator) =>
      screen.touch ? button.tap() : button.click();

    test("keeps lazy native playback and the poster frame dimensions", async ({
      page,
    }, info) => {
      const { state, trigger } = await fixture(page);
      const frame = trigger.locator("..");
      await frame.screenshot({ path: info.outputPath("garden-poster.png") });
      const before = await frame.boundingBox();
      expect(before).not.toBeNull();
      expect(state.requests).toBe(0);
      await expect(video(page)).toHaveCount(0);
      await activate(trigger);
      await ready(page);
      await played(page);
      await expect(video(page)).toHaveAttribute("src", GARDEN_VIDEO_URL);
      await expect(video(page)).toHaveAttribute("poster", GARDEN_POSTER_URL);
      for (const attribute of ["controls", "playsinline", "autoplay"])
        await expect(video(page)).toHaveAttribute(attribute, "");
      await expect(video(page)).toHaveAttribute("preload", "metadata");
      await expect(video(page)).toHaveCSS("object-fit", "cover");
      await expect.poll(() => video(page).boundingBox()).toEqual(before);
      await expect(notice(page)).toHaveCount(0);
      await expect(retry(page)).toHaveCount(0);
      expect(state.requests).toBeGreaterThan(0);
    });

    for (const mode of ["network", "http", "corrupt"] as const) {
      test(`${mode} failure has an explicit retry and recovers on the same source`, async ({
        page,
      }, info) => {
        const { state, trigger } = await fixture(page, mode);
        await activate(trigger);
        await expect
          .poll(() =>
            video(page).evaluate(
              (node: HTMLVideoElement) => node.error?.code ?? 0,
            ),
          )
          .toBeGreaterThan(0);
        await expect(notice(page)).toBeVisible();
        await expect(retry(page)).toBeVisible();
        const frame = (await video(page).boundingBox())!;
        const button = (await retry(page).boundingBox())!;
        expect(button.x).toBeGreaterThanOrEqual(frame.x);
        expect(button.y).toBeGreaterThanOrEqual(frame.y);
        expect(button.x + button.width).toBeLessThanOrEqual(
          frame.x + frame.width,
        );
        expect(button.y + button.height).toBeLessThanOrEqual(
          frame.y + frame.height,
        );
        if (mode === "network")
          await video(page)
            .locator("..")
            .screenshot({ path: info.outputPath("garden-error.png") });

        const before = state.requests;
        await retry(page).focus();
        await retry(page).press("Enter");
        await expect.poll(() => state.requests).toBeGreaterThan(before);
        await expect(notice(page)).toBeVisible();
        const failedAgain = state.requests;
        state.mode = "available";
        await activate(retry(page));
        await expect.poll(() => state.requests).toBeGreaterThan(failedAgain);
        await ready(page);
        await played(page);
        await expect(notice(page)).toHaveCount(0);
        await expect(video(page)).toHaveAttribute("src", GARDEN_VIDEO_URL);
        expect(
          await video(page).evaluate((node: HTMLVideoElement) => node.error),
        ).toBeNull();
      });
    }

    test("leaving Home or hiding the document pauses playback without restarting it on return", async ({
      page,
    }) => {
      const { trigger } = await fixture(page);
      await activate(trigger);
      await ready(page);
      // Loop only the short fixture so it cannot end before lifecycle checks.
      await video(page).evaluate(async (node: HTMLVideoElement) => {
        node.loop = true;
        await node.play();
      });
      await expect
        .poll(() =>
          video(page).evaluate((node: HTMLVideoElement) => node.paused),
        )
        .toBe(false);
      await page
        .getByRole("navigation", { name: "Разделы" })
        .getByRole("link", { name: "Лента", exact: true })
        .click();
      await expect(page).toHaveURL(/\/feed$/);
      await expect
        .poll(() =>
          video(page).evaluate((node: HTMLVideoElement) => node.paused),
        )
        .toBe(true);
      await page.getByRole("link", { name: "На главную", exact: true }).click();
      await expect(page).toHaveURL("/");
      await expect(video(page)).toBeVisible();
      expect(
        await video(page).evaluate((node: HTMLVideoElement) => node.paused),
      ).toBe(true);

      await video(page).evaluate((node: HTMLVideoElement) => node.play());
      // Emulate the visibility event; this is not a physical OS background test.
      await page.evaluate(() => {
        Object.defineProperty(document, "hidden", {
          configurable: true,
          value: true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await expect
        .poll(() =>
          video(page).evaluate((node: HTMLVideoElement) => node.paused),
        )
        .toBe(true);
      await page.evaluate(() => {
        Object.defineProperty(document, "hidden", {
          configurable: true,
          value: false,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      expect(
        await video(page).evaluate((node: HTMLVideoElement) => node.paused),
      ).toBe(true);
      await expect(notice(page)).toHaveCount(0);
    });
  });
}
