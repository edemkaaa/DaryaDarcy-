/** Опциональные Chromium-сценарии восстановления превью и ленивой картинки используют только собственный HTTP fixture. */
import { it, expect } from "vitest";
import { chromium, expect as ui } from "@playwright/test";
import { startPictureRecoveryFixture } from "./helpers/picture-recovery-fixture";

const native = process.env.RUN_PICTURE_BROWSER_TESTS === "1" ? it : it.skip;
native(
  "retries a preview twice before falling back and keeps the recovered response cached",
  async () => {
    const fixture = await startPictureRecoveryFixture();
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.goto(fixture.origin + "/?mode=preview");
      await ui
        .poll(
          () =>
            page
              .locator("img")
              .evaluate((image) => (image as HTMLImageElement).naturalWidth),
          { timeout: 12000 },
        )
        .toBeGreaterThan(0);
      const requests = fixture.requests.filter((path) =>
        path.startsWith("/_next/image"),
      );
      expect(requests).toHaveLength(3);
      expect(new Set(requests).size).toBe(1);
      await ui(page.locator("#status")).toContainText('"polls":0');
      await page.reload();
      await ui
        .poll(() =>
          page
            .locator("img")
            .evaluate((image) => (image as HTMLImageElement).naturalWidth),
        )
        .toBeGreaterThan(0);
      expect(
        fixture.requests.filter((path) => path.startsWith("/_next/image")),
      ).toHaveLength(3);
    } finally {
      await browser.close();
      await fixture.close();
    }
  },
  20000,
);

native(
  "does not poll offscreen lazy images and loads them when shown",
  async () => {
    const fixture = await startPictureRecoveryFixture();
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.goto(fixture.origin + "/?mode=poll");
      await ui(page.locator("#status")).toContainText('"polls":0');
      expect(
        fixture.requests.filter((path) => path.startsWith("/pending.svg")),
      ).toHaveLength(0);
      await page.getByRole("button", { name: "Toggle visible" }).click();
      await ui
        .poll(() =>
          page
            .locator("img")
            .first()
            .evaluate((image) => (image as HTMLImageElement).naturalWidth),
        )
        .toBeGreaterThan(0);
      await ui(page.locator("#status")).toContainText('"polls":0');
    } finally {
      await browser.close();
      await fixture.close();
    }
  },
  15000,
);
