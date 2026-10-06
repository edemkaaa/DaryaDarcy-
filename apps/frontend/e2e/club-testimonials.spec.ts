import { test, expect } from "@playwright/test";
import { layoutApi, gotoWithSession } from "./layout-fixtures";

for (const width of [390, 1440]) {
  test(`club testimonials are readable text with original sources at ${width}px`, async ({
    page,
    request,
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
    const original = community.getByRole("link", {
      name: "Оригинал отзыва Ирины Ячменевой",
    });
    const href = await original.getAttribute("href");
    expect(href).toBe(
      "/assets/responsive/0c95d509c862-oewXdFleqUUvImKT.w1440.c34d124a0a3d6f02.webp",
    );
    expect((await request.get(href!)).status()).toBe(200);
    await page.screenshot({
      path: test.info().outputPath(`community-${width}.png`),
    });

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
    expect(screenshots).toEqual([]);
    await page.screenshot({
      path: test.info().outputPath(`reviews-${width}.png`),
    });
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
