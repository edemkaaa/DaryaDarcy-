import { expect, test, type Locator } from "@playwright/test";
import { editorApi, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";
import type { RichTextBlock } from "../src/domain/content/types";

test.use({ hasTouch: true });

const text = "Фонарь для свечи\nМаршмеллоу\nКружка походная";
const firstUrl = "https://example.test/lantern";
const secondUrl = "https://example.test/marshmallow";

async function select(input: Locator, start: number, end: number) {
  await input.evaluate(
    (node: HTMLTextAreaElement, range) => {
      node.focus();
      node.setSelectionRange(range[0], range[1]);
      node.dispatchEvent(new Event("select", { bubbles: true }));
    },
    [start, end],
  );
}

for (const mode of ["full", "quick"] as const) {
  for (const lostSelection of ["previous", "collapsed"] as const) {
    test(`${mode}: links accumulate when ${lostSelection} DOM selection replaces the toolbar target`, async ({
      page,
    }) => {
      let created: Record<string, unknown> | undefined;
      const alerts: string[] = [];
      page.on("dialog", async (dialog) => {
        alerts.push(dialog.message());
        await dialog.accept();
      });
      await editorApi(page, (name, input) => {
        if (name === "admin.createPost") created = input;
      });
      await gotoWithSession(page, mode === "full" ? "/admin" : "/feed");
      await page
        .getByRole("button", {
          name: "Новый пост",
          exact: true,
        })
        .click();
      const form = page.getByRole("dialog", { name: "Редактор публикации" });
      await expect(
        form.getByText("Проверяем сохранённый черновик…"),
      ).toHaveCount(0);
      const input = form.getByPlaceholder("Текст поста… Enter — новый абзац");
      await input.fill(text);
      await select(input, 0, 16);
      await form.getByRole("button", { name: "Ж", exact: true }).tap();
      await form.getByRole("button", { name: "К", exact: true }).focus();
      await form.getByRole("button", { name: "К", exact: true }).press("Enter");
      const addLink = form.getByRole("button", {
        name: "Добавить ссылку",
        exact: true,
      });
      const linkDialog = page.getByRole("dialog", {
        name: "Ссылка в публикации",
      });
      await addLink.tap();
      await linkDialog.getByPlaceholder("https://...").fill(firstUrl);
      await linkDialog
        .getByRole("button", { name: "Добавить", exact: true })
        .click();
      await form
        .getByRole("button", { name: "Проверить", exact: true })
        .click();
      await expect(form.locator(`a[href='${firstUrl}']`)).toHaveText(
        "Фонарь для свечи",
      );
      await select(input, 17, 27);
      // Model selection changing as focus moves, after the initial toolbar press.
      // This does not emulate native iOS selection handles or its software keyboard.
      await addLink.evaluate((button, replacement) => {
        button.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            cancelable: true,
            pointerType: "touch",
          }),
        );
        const node = button
          .closest("[role='dialog']")!
          .querySelector("textarea")!;
        node.setSelectionRange(0, replacement === "previous" ? 16 : 0);
        for (const type of ["pointerup", "pointerout", "pointerleave"]) {
          button.dispatchEvent(
            new PointerEvent(type, {
              bubbles: type !== "pointerleave",
              pointerType: "touch",
            }),
          );
        }
        button.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true }),
        );
      }, lostSelection);
      await expect(linkDialog).toBeVisible();
      await linkDialog.getByPlaceholder("https://...").fill(secondUrl);
      await linkDialog
        .getByRole("button", { name: "Добавить", exact: true })
        .click();
      await expect(form.locator(`a[href='${firstUrl}']`)).toHaveText(
        "Фонарь для свечи",
      );
      await expect(form.locator(`a[href='${secondUrl}']`)).toHaveText(
        "Маршмеллоу",
      );
      await expect(
        form.locator("[class*='bold'][class*='italic']"),
      ).toContainText("Фонарь для свечи");
      expect(alerts).toEqual([]);
      await form
        .getByRole("button", {
          name: mode === "full" ? "Сохранить" : "Опубликовать",
          exact: true,
        })
        .first()
        .click();
      await expect(form).toHaveCount(0);
      expect(created?.text).toBe(text);
      const blocks = created?.richText as RichTextBlock[];
      expect(
        blocks.flatMap((block) => block.children).filter((child) => child.link),
      ).toEqual([
        { text: "Фонарь для свечи", bold: true, italic: true, link: firstUrl },
        { text: "Маршмеллоу", link: secondUrl },
      ]);
    });
  }

  test(`${mode}: editing keeps existing links and formatting after save and reopening`, async ({
    page,
  }) => {
    const thirdUrl = "https://example.test/second-lantern";
    let post = {
      id: 7,
      text: "Фонарь для свечи\nМаршмеллоу\nФонарь для свечи",
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
            {
              text: "Фонарь для свечи",
              bold: true,
              italic: true,
              link: firstUrl,
            },
          ],
        },
        {
          type: "paragraph",
          children: [{ text: "Маршмеллоу", link: secondUrl }],
        },
        { type: "paragraph", children: [{ text: "Фонарь для свечи" }] },
      ] as RichTextBlock[],
    };
    const updates: Record<string, unknown>[] = [];
    const expectedFormatting = [
      ...post.richText.slice(0, 2),
      {
        type: "paragraph",
        children: [{ text: "Фонарь для свечи", link: thirdUrl }],
      },
    ];
    await editorApi(page, (name, input) => {
      if (name === "admin.posts") return ok([post]);
      if (name === "feed.listPaginated")
        return ok({ posts: [post], nextCursor: null });
      if (name === "admin.updatePost") {
        updates.push(input);
        post = { ...post, richText: input.richText as RichTextBlock[] };
        return ok({ success: true });
      }
    });
    await gotoWithSession(page, mode === "full" ? "/admin" : "/feed");
    const openEdit = async () => {
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
      await expect(
        form.getByText("Проверяем сохранённый черновик…"),
      ).toHaveCount(0);
      return form;
    };
    let form = await openEdit();
    const input = form.getByPlaceholder("Текст поста… Enter — новый абзац");
    await select(input, 28, 44);
    const button = form.getByRole("button", {
      name: "Добавить ссылку",
      exact: true,
    });
    // Keyboard activation must capture the current selection without pointerdown.
    await button.focus();
    await button.press("Space");
    const link = page.getByRole("dialog", { name: "Ссылка в публикации" });
    await link.getByPlaceholder("https://...").fill(thirdUrl);
    await link.getByRole("button", { name: "Добавить", exact: true }).click();
    await form
      .getByRole("button", { name: "Сохранить", exact: true })
      .first()
      .click();
    await expect(form).toHaveCount(0);
    expect(updates).toHaveLength(1);
    expect(updates[0].richText).toEqual(expectedFormatting);
    // Reload forces a fresh mocked server read rather than using local editor state.
    await page.reload({ waitUntil: "domcontentloaded" });
    form = await openEdit();
    await form.getByRole("button", { name: "Проверить", exact: true }).click();
    await expect(form.locator(`a[href='${firstUrl}']`)).toHaveText(
      "Фонарь для свечи",
    );
    await expect(form.locator(`a[href='${secondUrl}']`)).toHaveText(
      "Маршмеллоу",
    );
    await expect(form.locator(`a[href='${thirdUrl}']`)).toHaveText(
      "Фонарь для свечи",
    );
    await expect(
      form.locator("[class*='bold'][class*='italic']"),
    ).toContainText("Фонарь для свечи");
  });
}
