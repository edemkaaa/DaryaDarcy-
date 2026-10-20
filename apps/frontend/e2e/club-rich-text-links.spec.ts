import { expect, test } from "@playwright/test";
import { editorApi, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

for (const article of [false, true]) {
  test(`${article ? "article" : "post"} club card keeps rich-text links independent of its read action`, async ({
    page,
  }) => {
    const firstUrl = "https://example.test/first-material";
    const secondUrl = "https://example.test/second-material";
    const reads: { name: string; input: Record<string, unknown> }[] = [];
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const post = {
      id: 81,
      text: "Жирный текст и курсивный текст. Первая ссылка. Вторая ссылка.",
      photos: [],
      media: [],
      tags: [],
      target: "club",
      source: article ? "article:9" : "manual",
      createdAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
      likeCount: 0,
      commentCount: 0,
      richText: [
        {
          type: "paragraph",
          children: [
            { text: "Жирный текст", bold: true },
            { text: " и " },
            { text: "курсивный текст", italic: true },
            { text: ". " },
            { text: "Первая ссылка", bold: true, link: firstUrl },
            { text: ". " },
            { text: "Вторая ссылка", italic: true, link: secondUrl },
          ],
        },
      ],
    };
    await editorApi(page, (name, input) => {
      if (name === "club.list") return ok({ posts: [post], nextCursor: null });
      if (name === "feed.getById") {
        reads.push({ name, input });
        return ok(post);
      }
      if (name === "articles.getById") {
        reads.push({ name, input });
        return ok({
          id: 9,
          title: "FULL_ARTICLE",
          access: "club",
          coverUrl: null,
          sections: [{ type: "text", text: "FULL_ARTICLE_BODY" }],
          locked: false,
        });
      }
    });
    await page
      .context()
      .route("https://example.test/**", (route) =>
        route.fulfill({
          contentType: "text/html",
          body: "<p>Local link fixture</p>",
        }),
      );
    await gotoWithSession(page, "/club");
    const first = page.getByRole("link", {
      name: "Первая ссылка",
      exact: true,
    });
    const second = page.getByRole("link", {
      name: "Вторая ссылка",
      exact: true,
    });
    await expect(first).toHaveAttribute("href", firstUrl);
    await expect(second).toHaveAttribute("href", secondUrl);
    for (const link of [first, second]) {
      expect(
        await link.evaluate((node) => node.closest("button, [role='button']")),
      ).toBeNull();
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    await expect(page.getByText("Жирный текст", { exact: true })).toHaveCSS(
      "font-weight",
      "700",
    );
    await expect(page.getByText("курсивный текст", { exact: true })).toHaveCSS(
      "font-family",
      /Italic/i,
    );
    await expect(first).toHaveCSS("font-weight", "700");
    await expect(second).toHaveCSS("font-family", /Italic/i);

    for (const keyboard of [false, true]) {
      if (keyboard) {
        await first.focus();
        await expect(first).toBeFocused();
      }
      for (const [index, link] of [first, second].entries()) {
        if (keyboard && index > 0) {
          await first.focus();
          await page.keyboard.press("Tab");
          await expect(second).toBeFocused();
        }
        const popupPromise = page.waitForEvent("popup");
        if (keyboard) await page.keyboard.press("Enter");
        else await link.click();
        const popup = await popupPromise;
        await popup.waitForLoadState("domcontentloaded");
        await expect(popup).toHaveURL(index === 0 ? firstUrl : secondUrl);
        await popup.close();
        await expect(page).toHaveURL(/\/club$/);
        expect(reads).toEqual([]);
      }
    }
    const read = page.getByRole("button", {
      name: article ? "читать →" : "Открыть публикацию",
      exact: true,
    });
    await read.focus();
    await expect(read).toBeFocused();
    await page.screenshot({
      path: test.info().outputPath("club-rich-text-card.png"),
    });
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(
      article ? /\/library\/article\/9$/ : /\/post\/81$/,
    );
    await expect
      .poll(() => reads)
      .toContainEqual({
        name: article ? "articles.getById" : "feed.getById",
        input: { id: article ? 9 : 81 },
      });
    expect(errors).toEqual([]);
  });
}
