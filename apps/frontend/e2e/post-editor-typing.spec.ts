import { expect, test } from "@playwright/test";
import { editorApi, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

type EditorWork = { observers: number; postDates: number };
type MeasuredWindow = typeof window & { editorWork: EditorWork };

for (const mode of ["full", "quick"] as const) {
  test(`${mode}: native typing avoids rebuilding observers and the admin list, and saves the latest text`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const work = { observers: 0, postDates: 0 };
      (window as MeasuredWindow).editorWork = work;
      const NativeObserver = window.ResizeObserver;
      window.ResizeObserver = class extends NativeObserver {
        constructor(callback: ResizeObserverCallback) {
          super(callback);
          work.observers++;
        }
      };
      const nativeDate = Date.prototype.toLocaleDateString;
      Date.prototype.toLocaleDateString = function (
        locales?: Intl.LocalesArgument,
        options?: Intl.DateTimeFormatOptions,
      ) {
        if (this.getTime() === Date.parse("2026-10-04T10:00:00Z"))
          work.postDates++;
        return nativeDate.call(this, locales, options);
      };
    });
    const first = "https://example.test/first";
    const second = "https://example.test/second";
    const body = Array.from(
      { length: 30 },
      (_, i) => `Paragraph ${i}: ordinary text for a long publication.`,
    );
    const text = "First link and second link\n" + body.join("\n");
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
      richText: [
        {
          type: "paragraph",
          children: [
            { text: "First link", link: first, bold: true },
            { text: " and " },
            { text: "second link", link: second },
          ],
        },
        ...body.map((text) => ({ type: "paragraph", children: [{ text }] })),
      ],
    };
    let update: Record<string, unknown> | undefined;
    const posts = Array.from({ length: 150 }, (_, i) => ({
      ...post,
      id: 7 + i,
    }));
    await editorApi(page, (name, input) => {
      if (name === "admin.posts") return ok(posts);
      if (name === "feed.listPaginated")
        return ok({ posts: [post], nextCursor: null });
      if (name === "admin.updatePost") update = input;
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
    await expect(input).toHaveValue(text);
    await form.getByRole("button", { name: "Дом", exact: true }).click();
    await expect(
      form.getByText("Черновик сохранён на этом устройстве", { exact: true }),
    ).toBeVisible();
    await input.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    await form.evaluate((node) =>
      Promise.all(node.getAnimations().map((a) => a.finished)),
    );
    await input.evaluate((node: HTMLTextAreaElement) => {
      node.focus();
      node.setSelectionRange(0, 0);
      node.dispatchEvent(new Event("select", { bubbles: true }));
    });
    await page.evaluate(() => {
      (window as MeasuredWindow).editorWork.observers = 0;
      (window as MeasuredWindow).editorWork.postDates = 0;
    });
    const prefix = "New entry: ";
    const suffix = " typed quickly 1234567890";
    await input.pressSequentially(prefix);
    await input.press("ControlOrMeta+End");
    await input.pressSequentially(suffix);
    await input.press("Backspace");
    await input.press("Backspace");
    const expected = prefix + text + suffix.slice(0, -2);
    await expect(input).toHaveValue(expected);
    expect(
      await page.evaluate(() => (window as MeasuredWindow).editorWork),
    ).toEqual({ observers: 0, postDates: 0 });
    await expect(form.locator(`[data-editor-link="${first}"]`)).toHaveText(
      "First link",
    );
    await expect(form.locator(`[data-editor-link="${second}"]`)).toHaveText(
      "second link",
    );
    await form.getByRole("button", { name: "Проверить", exact: true }).click();
    await expect(form.locator(`a[href="${first}"]`)).toHaveText("First link");
    await expect(form.locator(`a[href="${second}"]`)).toHaveText("second link");
    await input.pressSequentially("END");
    await form
      .getByRole("button", { name: "Сохранить", exact: true })
      .first()
      .click();
    await expect.poll(() => update?.text).toBe(expected + "END");
    expect(update?.tags).toEqual(["home"]);
    const blocks = update?.richText as {
      children: { text: string; link?: string; bold?: boolean }[];
    }[];
    expect(
      blocks.flatMap((block) => block.children).filter((child) => child.link),
    ).toMatchObject([
      { text: "First link", link: first, bold: true },
      { text: "second link", link: second },
    ]);
  });
}
