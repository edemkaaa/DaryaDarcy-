import { expect, it } from "vitest";
import { chromium, expect as ui, type Browser } from "@playwright/test";
import { startPictureHttpFixture } from "./helpers/picture-http-fixture";

const native = process.env.RUN_PICTURE_BROWSER_TESTS === "1" ? it : it.skip;
for (const mode of ["direct", "srcset", "preview"]) {
  native(
    `manual retry starts an independent request while the old HTTP body is held (${mode})`,
    async () => {
      const fixture = await startPictureHttpFixture();
      let browser: Browser | undefined;
      try {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(`${fixture.origin}/?mode=${mode}`);
        await ui.poll(() => fixture.state().requests.length).toBe(1);
        const retry = page.getByRole("button", {
          name: "Повторить загрузку",
          exact: true,
        });
        await ui(retry).toBeVisible({ timeout: 35000 });
        await ui.poll(() => fixture.state().pending).toBe(0);
        // Never release the first response on the server before pressing retry.
        await retry.click();
        await ui
          .poll(() => fixture.state().requests.length, { timeout: 5000 })
          .toBe(2);
        await ui
          .poll(() =>
            page
              .locator("img")
              .evaluate((img) => (img as HTMLImageElement).naturalWidth),
          )
          .toBeGreaterThan(0);
        await ui(retry).toHaveCount(0);
        expect(fixture.state().requests[1]).toBe(fixture.state().requests[0]);
        await page.reload();
        await ui
          .poll(() =>
            page
              .locator("img")
              .evaluate((img) => (img as HTMLImageElement).naturalWidth),
          )
          .toBeGreaterThan(0);
        expect(fixture.state().requests).toHaveLength(2);
      } finally {
        await browser?.close();
        await fixture.close();
      }
    },
    45000,
  );
}
