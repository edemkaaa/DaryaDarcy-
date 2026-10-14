import { test, expect } from "@playwright/test";
import { layoutApi, gotoWithSession } from "./layout-fixtures";
import { CLUB_TESTIMONIALS } from "../src/features/club/club-testimonials.content";

for (const width of [390, 1440]) {
  test(`club testimonials are readable text with original sources at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await layoutApi(page);
    const screenshots: string[] = [];
    page.on("request", (request) => {
      if (
        /0c95d509c862|75d234e719e4|80167c1dcc6f|d7c6da7c51eb|01ac0596761e|b0256e249003|77be05fab34c|a1a591be13aa|1a03ee114023/.test(
          request.url(),
        )
      )
        screenshots.push(request.url());
    });
    await gotoWithSession(page, "/club");
    const community = page.getByRole("region", {
      name: "О клубном комьюнити",
      exact: true,
    });
    await expect(community).toHaveCount(1);
    await community.scrollIntoViewIfNeeded();
    await expect(community.locator("blockquote").first()).toContainText(
      "не было ощущения принадлежности к миру единомышленниц",
    );
    await expect(
      community.getByText("Ирина Ячменева", { exact: true }),
    ).toBeVisible();
    await expect(community.locator("img")).toHaveCount(0);
    expect(screenshots).toEqual([]);
    const original = community.getByRole("button", {
      name: "Оригинал отзыва Ирины Ячменевой",
    });
    await page.screenshot({
      path: test.info().outputPath(`community-${width}.png`),
    });
    const viewer = page.getByRole("dialog", { name: "Просмотр фотографий" });
    const pagesBefore = page.context().pages().length;
    await original.click();
    await expect(viewer).toBeVisible();
    const photo = viewer.locator(
      'img[src="/assets/responsive/0c95d509c862-oewXdFleqUUvImKT.w1440.c34d124a0a3d6f02.webp"]',
    );
    await expect(photo).toBeInViewport();
    await expect
      .poll(() => photo.evaluate((img) => (img as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    await expect(viewer.getByText("1 / 3", { exact: true })).toBeVisible();
    expect(page.context().pages().length).toBe(pagesBefore);
    await viewer.getByRole("button", { name: "Закрыть фотографии" }).click();
    await expect(viewer).toHaveCount(0);
    await expect(original).toBeFocused();

    const reviews = page.getByRole("region", {
      name: "Отзывы участниц",
      exact: true,
    });
    await reviews.scrollIntoViewIfNeeded();
    await expect(reviews.locator("blockquote")).toHaveCount(6);
    await expect(reviews.getByText("Полина", { exact: true })).toHaveCount(1);
    await expect(reviews.getByText("Екатерина", { exact: true })).toHaveCount(
      1,
    );
    await expect(reviews.locator("img")).toHaveCount(0);
    await expect(reviews.locator("blockquote").first()).toContainText(
      "Для меня клуб– это возможность побыть наедине с собой",
    );
    await page.screenshot({
      path: test.info().outputPath(`reviews-${width}.png`),
    });
    await reviews
      .getByRole("button", { name: "Оригинал отзыва Полины" })
      .click();
    await expect(viewer).toBeVisible();
    await expect(viewer.getByText("2 / 6", { exact: true })).toBeVisible();
    await expect(
      viewer.locator(`img[src="${CLUB_TESTIMONIALS[1].source}"]`),
    ).toBeInViewport();
    await viewer.getByRole("button", { name: "Закрыть фотографии" }).click();
    await expect(viewer).toHaveCount(0);
    expect(page.context().pages().length).toBe(pagesBefore);
  });
}

test("testimonial navigation works with keyboard and stops at both ends", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await layoutApi(page);
  await gotoWithSession(page, "/club");
  const region = page.getByRole("region", {
    name: "О клубном комьюнити",
    exact: true,
  });
  await expect(region).toHaveCount(1);
  await region.scrollIntoViewIfNeeded();
  const previous = region.getByRole("button", { name: "Предыдущий отзыв" });
  const next = region.getByRole("button", { name: "Следующий отзыв" });
  await expect(previous).toBeDisabled();
  await next.focus();
  await next.press("Enter");
  await expect(previous).toBeEnabled();
  await expect(region.getByRole("status")).toHaveText("2 из 3");
  await next.press("Enter");
  await expect(next).toBeDisabled();
  await expect(region.getByRole("status")).toHaveText("3 из 3");
  await previous.click();
  await previous.click();
  await expect(previous).toBeDisabled();
  await expect(region.getByRole("status")).toHaveText("1 из 3");
});
