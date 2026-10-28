import { test, expect } from "@playwright/test";
import { flacFixtureBase64 } from "../../../tests/helpers/flac-fixture";
import { layoutApi, gotoWithSession } from "./layout-fixtures";

test("an open club screen rechecks an expired paid period without requiring navigation", async ({
  page,
}) => {
  let reads = 0;
  const expiry = () => ({
    hasClubAccess: reads === 1,
    subscribed: reads === 1,
    expiresAt: reads === 1 ? new Date(Date.now() + 2000).toISOString() : null,
    isOwner: false,
    cancelAtPeriodEnd: false,
    cancellationStatus: "none",
    monthlyPrice: "790",
  });
  await layoutApi(page, true, (name) => {
    if (name === "club.subscription") {
      reads++;
      return { result: { data: { json: expiry() } } };
    }
  });
  await gotoWithSession(page, "/club");
  await expect.poll(() => reads).toBeGreaterThanOrEqual(2);
  await expect(
    page.getByRole("button", { name: /Оплатить 790/ }).first(),
  ).toBeVisible();
});

// Exercises the browser decoder with the exact bytes used by SQL/wire upload tests.
test("the supported FLAC container decodes and plays", async ({ page }) => {
  await layoutApi(page);
  await page.route("**/api/test-audio.flac", (route) =>
    route.fulfill({
      contentType: "audio/flac",
      body: Buffer.from(flacFixtureBase64, "base64"),
    }),
  );
  await page.goto("/login");
  const result = await page.evaluate(async () => {
    const audio = document.createElement("audio");
    audio.src = "/api/test-audio.flac";
    document.body.append(audio);
    const ready = new Promise<void>((resolve, reject) => {
      audio.onloadedmetadata = () => resolve();
      audio.onerror = () => reject(new Error("decode error"));
    });
    await ready;
    await audio.play();
    const duration = audio.duration;
    audio.pause();
    audio.remove();
    return duration;
  });
  expect(result).toBeCloseTo(0.1, 2);
});
