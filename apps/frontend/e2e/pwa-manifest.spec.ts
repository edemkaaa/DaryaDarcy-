import { expect, test } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

test("the page links to a standalone manifest with decodable 192/512 PNG icons", async ({
  page,
  request,
}) => {
  await layoutApi(page);
  await gotoWithSession(page, "/library");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
  const response = await request.get("/manifest.webmanifest");
  expect(response.status()).toBe(200);
  const manifest = await response.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/");
  expect(manifest.scope).toBe("/");
  expect(
    manifest.icons.map((icon: { sizes: string }) => icon.sizes).sort(),
  ).toEqual(["192x192", "512x512"]);
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
    const dimensions = await page.evaluate(async (src: string) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      return `${image.naturalWidth}x${image.naturalHeight}`;
    }, icon.src);
    expect(dimensions).toBe(icon.sizes);
  }
});
