import { test, expect } from "@playwright/test";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { layoutApi, gotoWithSession } from "./layout-fixtures";

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

test("all imported originals and public derivatives have intact bytes and immutable caching", async ({
  request,
}) => {
  test.setTimeout(60_000);
  const frontend = process.cwd();
  const catalog = await readFile(
    resolve(frontend, "src/shared/ui/static-image-catalog.ts"),
    "utf8",
  );
  const sourcePaths = Array.from(
    catalog.matchAll(/import image\d+ from "([^"]+)";/g),
    (match) => resolve(frontend, "src/shared/ui", match[1]),
  );
  expect(sourcePaths.length).toBeGreaterThan(250);
  const mediaDir = resolve(frontend, ".next/static/media");
  const emitted = new Map<string, string>();
  for (const name of await readdir(mediaDir)) {
    if (!/\.(png|jpe?g|webp|avif)$/i.test(name)) continue;
    emitted.set(sha256(await readFile(resolve(mediaDir, name))), name);
  }
  const checked = new Set<string>();
  for (const source of sourcePaths) {
    const bytes = await readFile(source);
    const hash = sha256(bytes);
    const name = emitted.get(hash);
    expect(name, `No identical emitted image for ${source}`).toBeDefined();
    if (checked.has(hash)) continue;
    checked.add(hash);
    const response = await request.get(`/_next/static/media/${name}`);
    expect(response.status(), name).toBe(200);
    expect(response.headers()["cache-control"], name).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(sha256(await response.body()), name).toBe(hash);
  }
  const manifest = JSON.parse(await readFile(resolve(frontend, "image-variants.json"), "utf8")) as {
    images: { full: string; zoomable: boolean; fullSha256: string; variants: { uri: string; sha256: string }[] }[];
  };
  const publicFiles = new Map<string, string>();
  for (const entry of manifest.images) {
    for (const variant of entry.variants) {
      if (variant.uri.startsWith("/assets/responsive/")) publicFiles.set(variant.uri, variant.sha256);
    }
    if (entry.zoomable && entry.full.startsWith("/assets/responsive/")) publicFiles.set(entry.full, entry.fullSha256);
  }
  for (const [uri, hash] of publicFiles) {
    const response = await request.get(uri);
    expect(response.status(), uri).toBe(200);
    expect(response.headers()["cache-control"], uri).toBe("public, max-age=31536000, immutable");
    expect(sha256(await response.body()), uri).toBe(hash);
  }
});

for (const width of [390, 1440]) {
  test(`club illustrations use smaller local previews at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await layoutApi(page);
    const requested: string[] = [];
    page.on("request", (request) => requested.push(request.url()));
    await page.route("https://s3.twcstorage.ru/**", (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"/>',
      }),
    );
    await gotoWithSession(page, "/club");
    // Decode actual previews, including alpha artwork and a resized screenshot.
    for (const [name, previewWidth] of [
      ["0479fc01d16a-MSbIPSMMSqmZweYd", width === 390 ? 320 : 480],
      // The narrower selections carousel occupies 40vw (capped at 192px).
      ["250423a7ec62-uyAaCmBzfqhlMwpt", width === 390 ? 160 : 320],
    ] as const) {
      const illustration = page.locator(`img[src*="${name}"]`);
      await expect(illustration).toHaveCount(1);
      await illustration.scrollIntoViewIfNeeded();
      await expect(illustration).toBeInViewport();
      await expect
        .poll(() => illustration.evaluate((img) => {
          const image = img as HTMLImageElement;
          return image.complete && image.naturalWidth > 0
            ? Number(new URL(image.currentSrc).searchParams.get("w")) : 0;
        }))
        .toBe(previewWidth);
      await illustration.evaluate((img) => (img as HTMLImageElement).decode());
      await expect(illustration).toHaveAttribute("loading", "lazy");
      const source = await illustration.getAttribute("src");
      expect(source).toMatch(/^\/_next\/image\?/);
      await expect(illustration).toHaveAttribute("srcset", /320w/);
      const currentSrc = await illustration.evaluate((img) => (img as HTMLImageElement).currentSrc);
      const response = await page.request.get(currentSrc, { headers: { Accept: "image/webp" } });
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toBe("image/webp");
      expect(response.headers()["vary"]).toContain("Accept");
      expect(Number(response.headers()["cache-control"].match(/max-age=(\d+)/)?.[1])).toBeGreaterThanOrEqual(3600);
      expect(requested.some((uri) => uri.startsWith("https://s3.twcstorage.ru/") && uri.includes(name))).toBe(false);
      await illustration.screenshot({ path: test.info().outputPath(`${name}-${width}.png`) });
    }
    await page.screenshot({ path: test.info().outputPath(`club-previews-${width}.png`) });
  });
}

for (const [path, button, dialog] of [
  ["/shop/book-1", "Открыть фото товара 1", "Просмотр фотографии товара"],
  ["/library/about-me", "Открыть фото 1", "Просмотр фотографий"],
  ["/library/patterns", "Открыть выкройку: Остролист", "Остролист"],
] as const) {
  test(`static detail images open full resolution WebP on ${path}`, async ({ page }) => {
    await layoutApi(page, true);
    const externalRequests: string[] = [];
    const fullRequests: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.includes(".full.")) fullRequests.push(request.url());
      if (request.url().startsWith("https://s3.twcstorage.ru/") && /\.(?:jpe?g|png|webp)(?:\?|$)/i.test(request.url())) {
        externalRequests.push(request.url());
      }
    });
    await gotoWithSession(page, path);
    const action = page.getByRole("button", { name: button, exact: true });
    await action.scrollIntoViewIfNeeded();
    const preview = action.locator("img");
    // Already compressed originals may be cheaper than every resized option.
    await expect(preview).toHaveAttribute("srcset", / \d+w/);
    await expect.poll(() => preview.evaluate((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0)).toBe(true);
    const previewSrc = await preview.evaluate((img) => (img as HTMLImageElement).currentSrc);
    expect(new URL(previewSrc).pathname).not.toContain(".full.");
    expect(fullRequests).toEqual([]);
    await action.click();
    const viewer = page.getByRole("dialog", { name: dialog, exact: true });
    const original = viewer.locator("img").first();
    await expect(original).not.toHaveAttribute("srcset");
    await expect(original).toHaveAttribute("src", /\.full\./);
    await expect.poll(() => original.evaluate((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0)).toBe(true);
    await original.evaluate((img) => (img as HTMLImageElement).decode());
    const originalSrc = await original.evaluate((img) => (img as HTMLImageElement).currentSrc);
    expect(fullRequests).toContain(originalSrc);
    const manifest = JSON.parse(await readFile(resolve(process.cwd(), "image-variants.json"), "utf8")) as {
      images: { full: string; fullSha256: string; variants: { uri: string }[] }[];
    };
    const entry = manifest.images.find((entry) => entry.variants.some((variant) => variant.uri === new URL(previewSrc).pathname));
    expect(entry).toBeDefined();
    const response = await page.request.get(originalSrc);
    expect(response.status()).toBe(200);
    expect(sha256(await response.body())).toBe(entry!.fullSha256);
    expect(new URL(originalSrc).pathname).toMatch(/\.webp$/);
    expect(response.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(await original.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThanOrEqual(await preview.evaluate((img) => (img as HTMLImageElement).naturalWidth));
    expect(externalRequests).toEqual([]);
    await viewer.screenshot({ path: test.info().outputPath("original-detail.png") });
  });
}

test.describe("dense displays", () => {
  test.use({ deviceScaleFactor: 3 });
  for (const width of [390, 1440]) {
    test(`club artwork remains sharp on a 3x screen at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await layoutApi(page);
      await gotoWithSession(page, "/club");
      const image = page.locator('img[src*="0479fc01d16a-MSbIPSMMSqmZweYd"]');
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((img) => {
        const image = img as HTMLImageElement;
        return image.complete && image.naturalWidth > 0
          ? Number(new URL(image.currentSrc).searchParams.get("w")) : 0;
      })).toBe(width === 390 ? 960 : 1440);
      await image.evaluate((img) => (img as HTMLImageElement).decode());
      await image.screenshot({ path: test.info().outputPath("artwork-3x.png") });
    });
  }
});
