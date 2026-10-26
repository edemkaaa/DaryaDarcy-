import { expect, test, type Locator, type Page } from "@playwright/test";
import { editorApi } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

// Geometry models only: desktop Chromium cannot open the native iPhone keyboard.
async function keyboard(page: Page, height: number, offsetTop: number) {
  await page.evaluate(
    ({ height, offsetTop }) => {
      const viewport = window.visualViewport!;
      const resized = viewport.height !== height;
      Object.defineProperties(viewport, {
        height: { configurable: true, value: height },
        offsetTop: { configurable: true, value: offsetTop },
      });
      if (resized) viewport.dispatchEvent(new Event("resize"));
      viewport.dispatchEvent(new Event("scroll"));
    },
    { height, offsetTop },
  );
}

async function visibleInKeyboardViewport(control: Locator) {
  await expect
    .poll(() =>
      control.evaluate((node) => {
        const box = node.getBoundingClientRect();
        const area = node.closest(".ui-scroll")!.getBoundingClientRect();
        const viewport = window.visualViewport!;
        return (
          box.top >= Math.max(area.top, viewport.offsetTop) &&
          box.bottom <=
            Math.min(area.bottom, viewport.offsetTop + viewport.height)
        );
      }),
    )
    .toBe(true);
}

for (const mode of ["full", "quick"] as const) {
  for (const width of [320, 390]) {
    test.describe(`${mode} keyboard at ${width}px`, () => {
      test.use({
        viewport: { width, height: 844 },
        hasTouch: true,
        isMobile: true,
      });
      test("keeps the editor and formatting controls above the keyboard without losing selection", async ({
        page,
      }, testInfo) => {
        let saved: Record<string, unknown> | undefined;
        await editorApi(page, (name, input) => {
          if (name === "admin.createPost") saved = input;
        });
        await gotoWithSession(page, mode === "full" ? "/admin" : "/feed");
        await page
          .getByRole("button", { name: "Новый пост", exact: true })
          .click();
        const form = page.getByRole("dialog", { name: "Редактор публикации" });
        await expect(
          form.getByText("Проверяем сохранённый черновик…"),
        ).toHaveCount(0);
        const field = form.getByPlaceholder("Текст поста… Enter — новый абзац");
        const text = (
          "На прогулку:\n" + "Куртка и свитер\n".repeat(20)
        ).trimEnd();
        await field.fill(text);
        await field.evaluate((node: HTMLTextAreaElement) => {
          node.focus();
          node.setSelectionRange(0, 12);
          node.dispatchEvent(new Event("select", { bubbles: true }));
        });
        for (const [height, top] of [
          [430, 180],
          [360, 240],
          [360, 120],
          [360, 0],
        ]) {
          await keyboard(page, height, top);
          await expect
            .poll(async () => {
              const box = (await form.boundingBox())!;
              return {
                top: Math.round(box.y),
                bottom: Math.round(box.y + box.height),
              };
            })
            .toEqual({ top, bottom: top + height });
          for (const name of ["Ж", "К", "Добавить ссылку"]) {
            await visibleInKeyboardViewport(
              form.getByRole("button", { name, exact: true }),
            );
          }
          await expect(field).toBeFocused();
          expect(
            await field.evaluate((node) => {
              const box = node.getBoundingClientRect();
              const area = node.closest(".ui-scroll")!.getBoundingClientRect();
              return (
                Math.min(box.bottom, area.bottom) - Math.max(box.top, area.top)
              );
            }),
          ).toBeGreaterThan(70);
          expect(
            await field.evaluate((node: HTMLTextAreaElement) => [
              node.selectionStart,
              node.selectionEnd,
            ]),
          ).toEqual([0, 12]);
        }
        await form.getByRole("button", { name: "Ж", exact: true }).tap();
        await form.getByRole("button", { name: "К", exact: true }).tap();
        await expect(field).toHaveValue(text);
        await form.screenshot({
          path: testInfo.outputPath("keyboard-editor.png"),
        });
        await keyboard(page, 844, 0);
        await expect
          .poll(async () => (await form.boundingBox())!.height)
          .toBe(844);
        await form
          .getByRole("button", {
            name: mode === "full" ? "Сохранить" : "Опубликовать",
            exact: true,
          })
          .first()
          .click();
        await expect(form).toHaveCount(0);
        expect(saved?.text).toBe(text);
        expect(saved?.richText).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              children: [{ text: "На прогулку:", bold: true, italic: true }],
            }),
          ]),
        );
      });
    });
  }
}
