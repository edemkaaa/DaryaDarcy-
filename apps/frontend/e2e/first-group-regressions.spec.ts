import { expect, test, type Page } from "@playwright/test";
import { join } from "node:path";
import { editorApi, failure, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

const post = {
  id: 77,
  text: "Публикация для проверки восстановления",
  photos: [],
  media: [],
  tags: [],
  target: "both",
  status: "published",
  published: true,
  richText: null,
  createdAt: "2026-10-20T10:00:00Z",
  publishedAt: "2026-10-20T10:00:00Z",
  scheduledAt: null,
  likeCount: 0,
  commentCount: 0,
};
const capture = async (page: Page, name: string) => {
  if (process.env.STAGE_ONE_SCREENSHOTS) {
    await expect(
      page.getByText("Сохраняем черновик…", { exact: true }),
    ).toHaveCount(0);
    const date = page.locator('input[type="datetime-local"]').first();
    if (name.startsWith("F02") || name.startsWith("F03")) {
      await date.evaluate((element) =>
        element.scrollIntoView({ block: "center", behavior: "instant" }),
      );
    }
    await page.screenshot({
      path: join(process.env.STAGE_ONE_SCREENSHOTS, `${name}.png`),
      animations: "disabled",
    });
  }
};
async function fixture(page: Page, answer?: Parameters<typeof editorApi>[1]) {
  await editorApi(page, async (name, input, route) => {
    const custom = await answer?.(name, input, route);
    if (custom !== undefined) return custom;
    if (name === "admin.posts") return ok([post]);
    if (name === "admin.postDetail") return ok(post);
    if (name === "feed.listPaginated")
      return ok({ posts: [post], nextCursor: null });
  });
}
async function quickEdit(page: Page) {
  await gotoWithSession(page, "/feed");
  await page
    .getByRole("button", { name: "Действия с постом", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Редактировать пост", exact: true })
    .click();
  await expect(
    page.getByPlaceholder("Текст поста… Enter — новый абзац"),
  ).toHaveValue(post.text);
  await expect(
    page
      .getByRole("button", {
        name: /^(Опубликовать|Запланировать)$/,
        exact: true,
      })
      .first(),
  ).toBeEnabled();
  await expect(
    page.getByText("Черновик сохранён на этом устройстве", { exact: true }),
  ).toBeVisible();
}
for (const screen of ["feed", "admin"]) {
  for (const outcome of [
    "exists",
    "absent",
    "read-error",
    "malformed",
  ] as const) {
    test(`${screen}: deletion recovery ${outcome} never repeats the write`, async ({
      page,
    }) => {
      let writes = 0;
      let checking = false;
      await fixture(page, (name) => {
        if (name === "admin.deletePost") {
          writes++;
          return failure(500);
        }
        if (checking && name === "admin.postDetail") {
          if (outcome === "read-error") return failure(500);
          if (outcome === "malformed")
            return ok({ id: post.id, tags: [2], media: [] });
          return ok(outcome === "absent" ? null : post);
        }
      });
      page.on("dialog", (dialog) => dialog.accept());
      await gotoWithSession(page, `/${screen}`);
      const content = page.getByText(post.text, { exact: true });
      await expect(content).toBeVisible();
      const contentTop = (await content.boundingBox())!.y;
      if (outcome === "exists")
        await capture(page, `F01-${screen}-before-action`);
      if (screen === "feed") {
        await page
          .getByRole("button", { name: "Действия с постом", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Удалить пост", exact: true })
          .click();
      } else {
        await page
          .getByRole("button", { name: "Удалить пост", exact: true })
          .click();
      }
      const retry = page.getByRole("button", {
        name: screen === "feed" ? "Обновить публикации" : "Обновить список",
        exact: true,
      });
      await expect(retry).toBeVisible();
      if (outcome === "exists")
        await capture(page, `F01-${screen}-check-required`);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      const notice = page.locator("main > [data-background-notice]");
      await expect(notice).toBeVisible();
      const card = notice.getByRole("alert");
      const marker = card.locator('[aria-hidden="true"]').first();
      const mainBox = (await page.locator("main").boundingBox())!;
      const cardBox = (await card.boundingBox())!;
      expect(cardBox.x).toBeCloseTo(mainBox.x + 16, 0);
      expect(cardBox.width).toBeCloseTo(mainBox.width - 32, 0);
      const refreshBox = (await retry.boundingBox())!;
      const markerBox = (await marker.boundingBox())!;
      expect(refreshBox.width).toBe(30);
      expect(refreshBox.height).toBe(30);
      expect(markerBox.width).toBe(30);
      expect(refreshBox.y + refreshBox.height / 2).toBeCloseTo(
        markerBox.y + markerBox.height / 2,
        0,
      );
      await expect(retry.locator(".ui-sr-only")).toHaveText(
        screen === "feed" ? "Обновить публикации" : "Обновить список",
      );
      expect((await content.boundingBox())!.y).toBeCloseTo(contentTop, 0);
      await expect(
        notice.getByRole("button", { name: "Закрыть уведомление" }),
      ).toHaveCount(0);
      checking = true;
      await retry.click();
      await expect(
        page.getByText("Проверяем публикации…", { exact: true }),
      ).toHaveCount(0);
      if (outcome === "exists")
        await capture(page, `F01-${screen}-verified-existing-post`);
      if (outcome === "exists") {
        const close = notice.getByRole("button", {
          name: "Закрыть уведомление",
          exact: true,
        });
        await expect(close).toBeVisible();
        const bounds = (await close.boundingBox())!;
        expect(bounds.width).toBe(30);
        expect(bounds.height).toBe(30);
        const leftIcon = (await marker.boundingBox())!;
        expect(bounds.y + bounds.height / 2).toBeCloseTo(
          leftIcon.y + leftIcon.height / 2,
          0,
        );
        await close.focus();
        await close.press("Enter");
        await expect(notice).toHaveCount(0);
      }
      expect(writes).toBe(1);
      if (outcome === "read-error" || outcome === "malformed") {
        await expect(retry).toBeVisible();
      } else {
        await expect(retry).toHaveCount(0);
        if (screen === "feed") {
          await page.keyboard.press("Escape");
          await expect(
            page.getByRole("dialog", {
              name: "Результат действия с публикацией",
            }),
          ).toHaveCount(0);
        }
      }
    });
  }
}
for (const field of ["published", "scheduled"] as const) {
  test(`quick editor protects a change to ${field} date alone`, async ({
    page,
  }) => {
    await fixture(page, (name) =>
      name === "admin.postDetail" && field === "scheduled"
        ? ok({
            ...post,
            status: "scheduled",
            scheduledAt: "2040-10-20T10:00:00Z",
          })
        : undefined,
    );
    await quickEdit(page);
    const input = page.locator('input[type="datetime-local"]').first();
    await input.fill(
      field === "published" ? "2026-09-15T10:00" : "2040-09-15T10:00",
    );
    let confirmations = 0;
    page.on("dialog", async (dialog) => {
      confirmations++;
      await dialog.dismiss();
    });
    await page
      .getByRole("button", { name: "Закрыть редактор", exact: true })
      .click();
    if (confirmations === 0) {
      await expect(input).toHaveCount(0);
      await quickEdit(page);
    }
    await capture(page, `F02-${field}-date-after-cancel-close`);
    expect(confirmations).toBe(1);
    await expect(input).toHaveValue(
      field === "published" ? "2026-09-15T10:00" : "2040-09-15T10:00",
    );
  });
}
for (const editor of ["quick", "full"] as const) {
  test(`${editor} editor does not send a past schedule`, async ({ page }) => {
    let writes = 0;
    await fixture(page, (name) => {
      if (name === "admin.createPost" || name === "admin.updatePost") {
        writes++;
        return failure(400);
      }
    });
    page.on("dialog", (dialog) => dialog.accept());
    if (editor === "quick") await quickEdit(page);
    else {
      await gotoWithSession(page, "/admin");
      await page
        .getByRole("button", { name: "Новый пост", exact: true })
        .click();
      await page
        .getByPlaceholder("Текст поста… Enter — новый абзац")
        .fill(post.text);
    }
    await page.getByRole("button", { name: "Отложить", exact: true }).click();
    await page
      .locator('input[type="datetime-local"]')
      .first()
      .fill("2020-01-01T10:00");
    await page
      .getByRole("button", {
        name: "Сохранить",
        exact: true,
      })
      .first()
      .click();
    await capture(page, `F03-${editor}-past-schedule`);
    expect(writes).toBe(0);
    await expect(
      page.getByText("Выберите дату и время в будущем", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByPlaceholder("Текст поста… Enter — новый абзац"),
    ).toHaveValue(post.text);
    await page
      .locator('input[type="datetime-local"]')
      .first()
      .fill("2040-01-01T10:00");
    await expect(
      page.getByText("Выберите дату и время в будущем", { exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Сохранить", exact: true })
      .first()
      .click();
    await expect.poll(() => writes).toBe(1);
  });
}

/** Открытие без правок и возврат даты к исходной не должны давать ложное предупреждение. */
test("quick editor closes unchanged or reverted dates without confirmation", async ({
  page,
}) => {
  await fixture(page);
  let confirmations = 0;
  page.on("dialog", async (dialog) => {
    confirmations++;
    await dialog.dismiss();
  });
  for (const revert of [false, true]) {
    await quickEdit(page);
    const input = page.locator('input[type="datetime-local"]').first();
    if (revert) {
      const initial = await input.inputValue();
      await input.fill("2026-09-15T10:00");
      await input.fill(initial);
    }
    await page
      .getByRole("button", { name: "Закрыть редактор", exact: true })
      .click();
    await expect(input).toHaveCount(0);
  }
  expect(confirmations).toBe(0);
});
