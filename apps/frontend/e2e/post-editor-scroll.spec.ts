import { expect, test, type Locator, type Page } from "@playwright/test";
import { editorApi, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

async function scrollWithGesture(page: Page, form: Locator, touch: boolean) {
  const scroll = form.locator(".ui-scroll").first();
  const close = form.getByRole("button", {
    name: "Закрыть редактор",
    exact: true,
  });
  // The quick editor slides in; wait for its controls to settle before aiming a gesture.
  await close.click({ trial: true });
  const headerPosition = await close.boundingBox();
  await scroll.evaluate((node) => {
    node.scrollTop = 0;
  });
  const box = (await scroll.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + Math.min(400, box.height - 30);
  if (touch) {
    const session = await page.context().newCDPSession(page);
    try {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y }],
      });
      for (let step = 1; step <= 12; step++) {
        await session.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x, y: y - step * 20 }],
        });
        await page.waitForTimeout(20);
      }
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    } finally {
      await session.detach();
    }
  } else {
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, 400);
  }
  await expect
    .poll(() => scroll.evaluate((node) => node.scrollTop))
    .toBeGreaterThan(50);
  // Icon fonts may finish loading during the gesture and change button width.
  // The header must keep its position independently of that font swap.
  const after = (await close.boundingBox())!;
  expect({ x: after.x, y: after.y }).toEqual({
    x: headerPosition!.x,
    y: headerPosition!.y,
  });
}

for (const mode of ["full", "quick"] as const) {
  for (const touch of [false, true]) {
    test.describe(`${mode}: ${touch ? "touch" : "wheel"} scroll`, () => {
      test.use({
        viewport: touch
          ? { width: 390, height: 844 }
          : { width: 1440, height: 900 },
        hasTouch: touch,
        isMobile: touch,
      });
      test("allows immediate input and scroll after automatic draft recovery while a pending save stays protected", async ({
        page,
      }) => {
        let releaseSave: (() => void) | undefined;
        const writes: Record<string, unknown>[] = [];
        await editorApi(page, async (name, input) => {
          if (name === "admin.createPost") {
            writes.push(input);
            await new Promise<void>((resolve) => {
              releaseSave = resolve;
            });
            return ok(42);
          }
        });
        await gotoWithSession(page, mode === "full" ? "/admin" : "/feed");
        const open = async () => {
          await page
            .getByRole("button", {
              name: "Новый пост",
              exact: true,
            })
            .click();
          const form = page.getByRole("dialog", {
            name: "Редактор публикации",
          });
          await expect(
            form.getByText("Проверяем сохранённый черновик…"),
          ).toHaveCount(0);
          return form;
        };
        let form = await open();
        await scrollWithGesture(page, form, touch);
        const field = () =>
          form.getByPlaceholder("Текст поста… Enter — новый абзац");
        if (touch) await field().tap();
        else await field().click();
        await expect(field()).toBeFocused();
        await page.keyboard.insertText("PRESERVED_SCROLL_DRAFT");
        await expect(
          form.getByText("Черновик сохранён на этом устройстве", {
            exact: true,
          }),
        ).toBeVisible();
        await page.reload({ waitUntil: "domcontentloaded" });
        form = await open();
        const restore = form.getByRole("button", {
          name: "Восстановить черновик",
          exact: true,
        });
        await expect(restore).toHaveCount(0);
        await expect(field()).toHaveValue("PRESERVED_SCROLL_DRAFT");
        expect(
          await field().evaluate((node) => Boolean(node.closest("[inert]"))),
        ).toBe(false);
        const assertLocked = async () => {
          expect(
            await field().evaluate((node) => Boolean(node.closest("[inert]"))),
          ).toBe(true);
          expect(
            await field().evaluate((node) => {
              node.focus();
              return document.activeElement === node;
            }),
          ).toBe(false);
        };
        await scrollWithGesture(page, form, touch);
        expect(writes).toEqual([]);
        if (touch) await field().tap();
        else await field().click();
        await expect(field()).toBeFocused();
        await field().evaluate((node: HTMLTextAreaElement) => {
          node.setSelectionRange(node.value.length, node.value.length);
        });
        await page.keyboard.insertText("_EDITED");
        await expect(field()).toHaveValue("PRESERVED_SCROLL_DRAFT_EDITED");
        await scrollWithGesture(page, form, touch);
        await form
          .getByRole("button", {
            name: mode === "full" ? "Сохранить" : "Опубликовать",
            exact: true,
          })
          .first()
          .click();
        await expect.poll(() => writes.length).toBe(1);
        try {
          await assertLocked();
          await scrollWithGesture(page, form, touch);
          expect(writes[0].text).toBe("PRESERVED_SCROLL_DRAFT_EDITED");
        } finally {
          releaseSave?.();
        }
        await expect(form).toHaveCount(0);
      });
    });
  }
}
