import { expect, test, type Page } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";
import { CLUB_MUSIC_URL } from "../src/shared/styles/tab-assets";

test.setTimeout(45_000);
const message = "Музыка не загрузилась. Нажмите ещё раз, чтобы повторить.";
type MusicWindow = Window & {
  musicAudio?: HTMLAudioElement;
  musicSpinnerSeen?: boolean;
};

function silentWav() {
  const samples = 8000 * 20;
  const wav = Buffer.alloc(44 + samples, 128);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + samples, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(8000, 28);
  wav.writeUInt16LE(1, 32);
  wav.writeUInt16LE(8, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples, 40);
  return wav;
}

async function setup(page: Page, width: number) {
  await page.setViewportSize({ width, height: 844 });
  await layoutApi(page, true);
  // Observe the actual browser Audio; do not replace play/pause or media events.
  await page.addInitScript(() => {
    const OriginalAudio = window.Audio;
    window.Audio = new Proxy(OriginalAudio, {
      construct(Target, [source]) {
        const audio = new Target(source);
        if (typeof source === "string" && source.includes("darcys-autumn.mp3"))
          (window as MusicWindow).musicAudio = audio;
        return audio;
      },
    });
  });
  await page.route("https://s3.twcstorage.ru/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="240"><rect width="480" height="240" fill="tan"/></svg>',
    }),
  );
}

const media = async (page: Page) =>
  page.evaluate(() => {
    const audio = (window as MusicWindow).musicAudio!;
    return {
      paused: audio.paused,
      time: audio.currentTime,
      ready: audio.readyState,
    };
  });

for (const width of [320, 390, 1440]) {
  test(`slow music can be cancelled and a fast restart keeps the original icon at ${width}px`, async ({
    page,
  }, testInfo) => {
    await setup(page, width);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(CLUB_MUSIC_URL, async (route) => {
      await gate;
      await route.fulfill({ contentType: "audio/wav", body: silentWav() });
    });
    try {
      await gotoWithSession(page, "/club");
      await page.evaluate(() => document.fonts.ready);
      const button = page.getByRole("button", {
        name: "Включить музыку",
        exact: true,
      });
      const before = (await button.boundingBox())!;
      expect(before.width).toBe(34);
      expect(before.height).toBe(34);
      await button.click();
      const cancel = page.getByRole("button", {
        name: "Отменить загрузку музыки",
        exact: true,
      });
      await expect(cancel).toHaveAttribute("aria-busy", "true");
      await expect(cancel.locator(".ui-spinner")).toBeVisible();
      expect(await cancel.boundingBox()).toEqual(before);
      await page.screenshot({
        path: testInfo.outputPath(`music-loading-${width}.png`),
      });
      // Cancellation remains available while loading, including keyboard use.
      await cancel.focus();
      await cancel.press("Enter");
      await expect(button).toHaveAttribute("aria-busy", "false");
      await expect(button.locator(".ui-spinner")).toHaveCount(0);
      release();
      await expect
        .poll(async () => (await media(page)).ready)
        .toBeGreaterThanOrEqual(2);
      expect((await media(page)).paused).toBe(true);
      await expect(
        page.getByRole("alert").filter({ hasText: message }),
      ).toHaveCount(0);
      await page.evaluate(() => {
        const w = window as MusicWindow;
        w.musicSpinnerSeen = false;
        const observer = new MutationObserver(() => {
          if (
            document.querySelector('button[aria-label*="музыки"] .ui-spinner')
          )
            w.musicSpinnerSeen = true;
        });
        observer.observe(
          document.querySelector('header[aria-label="Навигация профиля"]')!,
          { childList: true, subtree: true },
        );
      });
      await button.click();
      const stop = page.getByRole("button", {
        name: "Выключить музыку",
        exact: true,
      });
      await expect(stop).toHaveAttribute("aria-pressed", "true");
      await expect
        .poll(async () => (await media(page)).time)
        .toBeGreaterThan(0.1);
      await expect(stop.locator(".ui-spinner")).toHaveCount(0);
      expect(
        await page.evaluate(() => (window as MusicWindow).musicSpinnerSeen),
      ).toBe(false);
      await page.screenshot({
        path: testInfo.outputPath(`music-playing-${width}.png`),
      });
      await stop.click();
      await expect(button).toHaveAttribute("aria-pressed", "false");
      expect((await media(page)).paused).toBe(true);
    } finally {
      release();
      await page.unrouteAll({ behavior: "wait" });
    }
  });

  test(`music errors are visible and retry reloads the failed source at ${width}px`, async ({
    page,
  }, testInfo) => {
    await setup(page, width);
    let broken = true;
    let requests = 0;
    await page.route(CLUB_MUSIC_URL, (route) => {
      requests++;
      return route.fulfill({
        contentType: broken ? "audio/mpeg" : "audio/wav",
        body: broken ? Buffer.from("broken mp3") : silentWav(),
      });
    });
    await gotoWithSession(page, "/club");
    await page.evaluate(() => document.fonts.ready);
    await page
      .getByRole("button", { name: "Включить музыку", exact: true })
      .click();
    const retry = page.getByRole("button", {
      name: "Повторить загрузку музыки",
      exact: true,
    });
    const notice = page.getByRole("alert").filter({ hasText: message });
    await expect(notice).toBeVisible();
    await expect(retry).toHaveAttribute("aria-pressed", "false");
    await expect(retry).toHaveAccessibleDescription(message);
    const box = (await notice.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    const buttonBox = (await retry.boundingBox())!;
    expect(box.y).toBeGreaterThan(buttonBox.y + buttonBox.height);
    await page.screenshot({
      path: testInfo.outputPath(`music-error-${width}.png`),
    });
    const failedRequests = requests;
    broken = false;
    await retry.focus();
    await retry.press("Enter");
    await expect.poll(() => requests).toBeGreaterThan(failedRequests);
    await expect(
      page.getByRole("button", { name: "Выключить музыку", exact: true }),
    ).toBeVisible();
    await expect(notice).toHaveCount(0);
    await expect
      .poll(async () => (await media(page)).time)
      .toBeGreaterThan(0.1);
    await page
      .getByRole("button", { name: "Выключить музыку", exact: true })
      .click();
  });
}

test("music loading respects reduced motion and a stalled start becomes an error", async ({
  page,
}) => {
  await setup(page, 320);
  await page.emulateMedia({ reducedMotion: "reduce" });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(CLUB_MUSIC_URL, async (route) => {
    await gate;
    await route.fulfill({ contentType: "audio/wav", body: silentWav() });
  });
  try {
    await gotoWithSession(page, "/club");
    await page.evaluate(() => document.fonts.ready);
    await page.clock.install();
    await page
      .getByRole("button", { name: "Включить музыку", exact: true })
      .click();
    await page.clock.fastForward(601);
    const cancel = page.getByRole("button", {
      name: "Отменить загрузку музыки",
      exact: true,
    });
    await expect(cancel.locator(".ui-spinner")).toBeVisible();
    expect(
      await cancel
        .locator(".ui-spinner")
        .evaluate((node) => getComputedStyle(node).animationName),
    ).toBe("none");
    await page.clock.fastForward(15_000);
    await expect(
      page.getByRole("alert").filter({ hasText: message }),
    ).toBeVisible();
    const retry = page.getByRole("button", {
      name: "Повторить загрузку музыки",
      exact: true,
    });
    await expect(retry).toHaveAttribute("aria-busy", "false");
    await expect(retry.locator(".ui-spinner")).toHaveCount(0);
    expect((await media(page)).paused).toBe(true);
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
  }
});
