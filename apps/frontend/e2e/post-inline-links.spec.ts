import { expect, test, type Locator, type Page } from "@playwright/test";
import { editorApi, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";
import type { RichTextBlock } from "../src/domain/content/types";

test.use({ hasTouch: true, isMobile: true });

async function tapLink(page: Page, form: Locator, url: string) {
  await form.evaluate((node) =>
    Promise.all(node.getAnimations().map((animation) => animation.finished)),
  );
  const text = form.locator(`[data-editor-link="${url}"]`);
  await form
    .getByPlaceholder("Текст поста… Enter — новый абзац")
    .scrollIntoViewIfNeeded();
  const point = await text.evaluate((node) => {
    const rect = node.getClientRects()[0];
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  });
  // The highlight is pointer-transparent: the native textarea receives this tap.
  await page.touchscreen.tap(point.x, point.y);
  await expect(
    form.getByRole("group", { name: "Ссылка в тексте" }),
  ).toHaveCount(0);
  await expect(
    form.getByRole("button", { name: "Добавить ссылку", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const input = form.getByPlaceholder("Текст поста… Enter — новый абзац");
  const label = (await text.textContent())!;
  const selection = await input.evaluate((node: HTMLTextAreaElement) => ({
    position: node.selectionStart,
    text: node.value,
  }));
  const start = selection.text.indexOf(label);
  expect(selection.position).toBeGreaterThanOrEqual(start);
  expect(selection.position).toBeLessThanOrEqual(start + label.length);
}

for (const mode of ["full", "quick"] as const) {
  for (const width of [320, 1440]) {
    test.describe(`${mode}: inline link wrapping at ${width}px`, () => {
      test.use({ viewport: { width, height: 900 }, isMobile: width === 320 });
      test("keeps taps aligned after native scrolling, resizing and inserting text", async ({
        page,
      }) => {
        const first = "https://example.test/wrapped";
        const last = "https://example.test/bottom";
        const label =
          "👩‍💻 Ссылка с длинным текстом, который переносится на несколько строк";
        const plain =
          "\n" +
          Array.from(
            { length: 25 },
            (_, i) =>
              `Строка ${i}: текст с пробелами  и табуляцией\t😀 для переноса текста`,
          ).join("\n") +
          "\n";
        const text = label + plain + "Последняя ссылка";
        const post = {
          id: 7,
          text,
          photos: [],
          tags: [],
          media: [],
          target: "feed",
          status: "published",
          published: true,
          sortOrder: 0,
          scheduledAt: null,
          createdAt: "2026-10-04T10:00:00Z",
          publishedAt: "2026-10-04T10:00:00Z",
          likeCount: 0,
          commentCount: 0,
          richText: [
            {
              type: "paragraph",
              children: [
                { text: label, link: first },
                { text: plain },
                { text: "Последняя ссылка", link: last },
              ],
            },
          ],
        };
        await editorApi(page, (name) => {
          if (name === "admin.posts") return ok([post]);
          if (name === "feed.listPaginated")
            return ok({ posts: [post], nextCursor: null });
        });
        await gotoWithSession(page, mode === "full" ? "/admin" : "/feed");
        if (mode === "quick")
          await page
            .getByRole("button", {
              name: "Действия с постом",
              exact: true,
            })
            .first()
            .click();
        await page
          .getByRole("button", { name: "Редактировать пост", exact: true })
          .first()
          .click();
        const form = page.getByRole("dialog", { name: "Редактор публикации" });
        const input = form.getByPlaceholder("Текст поста… Enter — новый абзац");
        await expect(form.locator("[data-editor-link]")).toHaveCount(2);
        await page.evaluate(() => document.fonts.ready);
        const highlighted = input
          .locator("..")
          .locator("[aria-hidden='true'] > div");
        const assertAlignment = async () => {
          // ResizeObserver paints asynchronously after a native viewport resize.
          await expect(async () => {
            const metrics = await input.evaluate(
              (node: HTMLTextAreaElement) => {
                const mirror = node.previousElementSibling!
                  .firstElementChild as HTMLElement;
                const field = getComputedStyle(node);
                const painted = getComputedStyle(mirror);
                return {
                  nativeHeight: node.scrollHeight,
                  paintedHeight: mirror.scrollHeight,
                  nativeWidth: node.clientWidth,
                  paintedWidth: mirror.clientWidth,
                  font: field.font,
                  paintedFont: painted.font,
                  padding: field.padding,
                  paintedPadding: painted.padding,
                };
              },
            );
            expect(metrics.paintedWidth).toBe(metrics.nativeWidth);
            expect(metrics.paintedHeight).toBeCloseTo(metrics.nativeHeight, 0);
            expect(metrics.paintedFont).toBe(metrics.font);
            expect(metrics.paintedPadding).toBe(metrics.padding);
          }).toPass({ timeout: 5_000 });
        };
        await assertAlignment();
        await tapLink(page, form, first);
        await input.evaluate((node: HTMLTextAreaElement) => {
          node.focus();
          node.setSelectionRange(0, 0);
          node.dispatchEvent(new Event("select", { bubbles: true }));
        });
        await page.keyboard.insertText("Новый абзац\n");
        await expect(input).toHaveValue("Новый абзац\n" + text);
        await assertAlignment();
        await input.evaluate((node) => {
          node.scrollTop = node.scrollHeight;
        });
        await expect
          .poll(() => highlighted.evaluate((node) => node.style.transform))
          .not.toBe("translate(0px, 0px)");
        await tapLink(page, form, last);
        await page.setViewportSize({
          width: width === 320 ? 390 : 1000,
          height: 700,
        });
        await input.evaluate((node) => {
          node.scrollTop = 0;
        });
        await assertAlignment();
        await tapLink(page, form, first);
      });
    });
  }
}

for (const mode of ["full", "quick"] as const) {
  test(`${mode}: edits links through selection and deletes them with their text without changing editor height`, async ({
    page,
  }) => {
    const first = "https://example.test/first";
    const second = "https://example.test/second";
    const changed = "https://example.test/changed";
    const text = "Первая ссылка и вторая ссылка\nОбычный текст";
    let post = {
      id: 7,
      text,
      photos: [],
      tags: [],
      media: [],
      target: "feed",
      status: "published",
      published: true,
      sortOrder: 0,
      scheduledAt: null,
      createdAt: "2026-10-04T10:00:00Z",
      publishedAt: "2026-10-04T10:00:00Z",
      likeCount: 0,
      commentCount: 0,
      richText: [
        {
          type: "paragraph",
          children: [
            { text: "Первая ссылка", bold: true, italic: true, link: first },
            { text: " и " },
            { text: "вторая ссылка", link: second },
          ],
        },
        { type: "paragraph", children: [{ text: "Обычный текст" }] },
      ] as RichTextBlock[],
    };
    const updates: Record<string, unknown>[] = [];
    await editorApi(page, (name, input) => {
      if (name === "admin.posts") return ok([post]);
      if (name === "feed.listPaginated")
        return ok({ posts: [post], nextCursor: null });
      if (name === "admin.updatePost") {
        updates.push(input);
        post = {
          ...post,
          text: input.text as string,
          richText: input.richText as RichTextBlock[],
        };
        return ok({ success: true });
      }
    });
    await gotoWithSession(page, mode === "full" ? "/admin" : "/feed");
    const open = async () => {
      if (mode === "quick")
        await page
          .getByRole("button", {
            name: "Действия с постом",
            exact: true,
          })
          .first()
          .click();
      await page
        .getByRole("button", { name: "Редактировать пост", exact: true })
        .first()
        .click();
      const form = page.getByRole("dialog", { name: "Редактор публикации" });
      await expect(
        form.getByText("Проверяем сохранённый черновик…"),
      ).toHaveCount(0);
      return form;
    };
    let form = await open();
    const input = () =>
      form.getByPlaceholder("Текст поста… Enter — новый абзац");
    const select = async (start: number, end: number) =>
      input().evaluate(
        (node: HTMLTextAreaElement, range) => {
          node.focus();
          node.setSelectionRange(range[0], range[1]);
          node.dispatchEvent(new Event("select", { bubbles: true }));
        },
        [start, end],
      );
    const linkButton = () =>
      form.getByRole("button", { name: "Добавить ссылку", exact: true });
    const editor = () => input().locator("..").locator("..");
    await expect(form.locator("[data-editor-link]")).toHaveCount(2);
    await expect(
      form.getByRole("group", { name: "Ссылка в тексте" }),
    ).toHaveCount(0);
    await expect(input()).toHaveValue(text);
    await page.evaluate(() => document.fonts.ready);
    const originalUrl = page.url();
    const initialHeight = (await editor().boundingBox())!.height;
    await tapLink(page, form, first);
    expect((await editor().boundingBox())!.height).toBeCloseTo(
      initialHeight,
      1,
    );
    await expect(
      editor().getByRole("button", { name: "Изменить", exact: true }),
    ).toHaveCount(0);
    await expect(
      editor().getByRole("button", { name: "Удалить", exact: true }),
    ).toHaveCount(0);
    expect(page.url()).toBe(originalUrl);
    await expect(input()).toBeFocused();
    await expect(
      form.getByRole("button", { name: "Добавить ссылку", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await select(0, "Первая".length);
    await linkButton().tap();
    const link = page.getByRole("dialog", { name: "Ссылка в публикации" });
    await expect(link.getByPlaceholder("https://...")).toHaveValue(first);
    await link.getByPlaceholder("https://...").fill(changed);
    await link.getByRole("button", { name: "Отмена", exact: true }).tap();
    await expect(form.locator(`[data-editor-link="${first}"]`)).toHaveCount(1);
    await select(0, "Первая ссылка".length);
    await linkButton().tap();
    await link.getByPlaceholder("https://...").fill(changed);
    await link.getByRole("button", { name: "Сохранить", exact: true }).tap();
    await expect(form.locator(`[data-editor-link="${changed}"]`)).toHaveText(
      "Первая ссылка",
    );
    await expect(form.locator(`[data-editor-link="${second}"]`)).toHaveText(
      "вторая ссылка",
    );
    await input().tap({ position: { x: 10, y: 155 } });
    await expect(
      form.getByRole("group", { name: "Ссылка в тексте" }),
    ).toHaveCount(0);
    await tapLink(page, form, second);
    await select(
      text.indexOf("вторая ссылка"),
      text.indexOf("вторая ссылка") + "вторая ссылка".length,
    );
    await page.keyboard.press("Backspace");
    await expect(form.locator("[data-editor-link]")).toHaveCount(1);
    await expect(input()).toHaveValue(text.replace("вторая ссылка", ""));
    await expect(
      form.getByRole("group", { name: "Ссылка в тексте" }),
    ).toHaveCount(0);
    await form
      .getByRole("button", { name: "Сохранить", exact: true })
      .first()
      .click();
    await expect(form).toHaveCount(0);
    expect(updates).toHaveLength(1);
    expect(updates[0].text).toBe("Первая ссылка и\nОбычный текст");
    expect((updates[0].richText as RichTextBlock[])[0].children).toEqual([
      { text: "Первая ссылка", bold: true, italic: true, link: changed },
      { text: " и " },
    ]);
    await page.reload({ waitUntil: "domcontentloaded" });
    form = await open();
    await expect(form.locator("[data-editor-link]")).toHaveCount(1);
    await expect(form.locator(`[data-editor-link="${changed}"]`)).toHaveText(
      "Первая ссылка",
    );
  });
}

for (const mode of ["full", "quick"] as const) {
  test(`${mode}: deleting a linked duplicate does not transfer its URL and partial deletion keeps the other link`, async ({
    page,
  }) => {
    const first = "https://example.test/deleted";
    const other = "https://example.test/remaining";
    const text = "Ссылка Ссылка и Другая";
    const post = {
      id: 7,
      text,
      photos: [],
      tags: [],
      media: [],
      target: "feed",
      status: "published",
      published: true,
      sortOrder: 0,
      scheduledAt: null,
      createdAt: "2026-10-04T10:00:00Z",
      publishedAt: "2026-10-04T10:00:00Z",
      likeCount: 0,
      commentCount: 0,
      richText: [
        {
          type: "paragraph",
          children: [
            { text: "Ссылка", link: first },
            { text: " Ссылка и " },
            { text: "Другая", link: other },
          ],
        },
      ],
    };
    let updated: Record<string, unknown> | undefined;
    await editorApi(page, (name, input) => {
      if (name === "admin.posts") return ok([post]);
      if (name === "feed.listPaginated")
        return ok({ posts: [post], nextCursor: null });
      if (name === "admin.updatePost") {
        updated = input;
        return ok({ success: true });
      }
    });
    await gotoWithSession(page, mode === "full" ? "/admin" : "/feed");
    if (mode === "quick")
      await page
        .getByRole("button", { name: "Действия с постом", exact: true })
        .first()
        .click();
    await page
      .getByRole("button", { name: "Редактировать пост", exact: true })
      .first()
      .click();
    const form = page.getByRole("dialog", { name: "Редактор публикации" });
    const input = form.getByPlaceholder("Текст поста… Enter — новый абзац");
    await expect(form.locator("[data-editor-link]")).toHaveCount(2);
    await input.evaluate((node: HTMLTextAreaElement) => {
      node.focus();
      node.setSelectionRange(0, 7);
      node.dispatchEvent(new Event("select", { bubbles: true }));
    });
    await page.keyboard.press("Backspace");
    await expect(input).toHaveValue("Ссылка и Другая");
    await expect(form.locator(`[data-editor-link="${first}"]`)).toHaveCount(0);
    await expect(form.locator(`[data-editor-link="${other}"]`)).toHaveText(
      "Другая",
    );
    await input.evaluate((node: HTMLTextAreaElement) => {
      node.setSelectionRange(node.value.length, node.value.length);
      node.dispatchEvent(new Event("select", { bubbles: true }));
    });
    await page.keyboard.press("Backspace");
    await expect(form.locator(`[data-editor-link="${other}"]`)).toHaveText(
      "Друга",
    );
    await form
      .getByRole("button", { name: "Сохранить", exact: true })
      .first()
      .click();
    await expect(form).toHaveCount(0);
    expect(updated?.text).toBe("Ссылка и Друга");
    expect(updated?.richText).toEqual([
      {
        type: "paragraph",
        children: [{ text: "Ссылка и " }, { text: "Друга", link: other }],
      },
    ]);
  });
}
