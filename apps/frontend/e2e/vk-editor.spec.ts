import { test, expect } from "@playwright/test";
import { editorApi, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

const link =
  "https://vkvideo.ru/video_ext.php?oid=-227034863&id=456239527&hash=99fae216cf20dcdc";
const savedLink = link + "&autoplay=0";
test.setTimeout(60_000);
for (const mode of ["full", "quick"] as const) {
  for (const width of [320, 390, 1440]) {
    test(`${mode} VK add, validation, draft, preview, save and remove at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      const writes: Record<string, unknown>[] = [];
      let current: Record<string, unknown> | null = null;
      let uploads = 0;
      await editorApi(page, (name, input) => {
        if (name === "admin.posts") return ok(current ? [current] : []);
        if (name === "feed.listPaginated")
          return ok({ posts: current ? [current] : [], nextCursor: null });
        if (name.startsWith("admin.upload")) uploads++;
        if (name === "admin.createPost" || name === "admin.updatePost") {
          writes.push(input);
          current = {
            ...current,
            ...input,
            id: 42,
            createdAt: "2026-10-13T10:00:00Z",
            publishedAt: "2026-10-13T10:00:00Z",
            media: ((input.videos as string[]) ?? []).map((url, i) => ({
              id: i + 1,
              type: "video",
              url,
            })),
          };
          return name === "admin.createPost" ? ok(42) : ok({ success: true });
        }
      });
      await page.route("https://vkvideo.ru/**", (route) =>
        route.fulfill({
          contentType: "text/html",
          body: "<html><body>VK player fixture</body></html>",
        }),
      );
      const path = mode === "full" ? "/admin" : "/feed";
      const openNew = async () => {
        await page
          .getByRole("button", {
            name: mode === "full" ? "Новый" : "Новый пост",
            exact: true,
          })
          .click();
        await expect(
          page.getByText("Черновик сохранён на этом устройстве", {
            exact: true,
          }),
        ).toBeVisible();
      };
      const form = page.getByRole("dialog", {
        name: "Редактор публикации",
        exact: true,
      });
      await gotoWithSession(page, path);
      await openNew();
      await form.locator("textarea").first().fill("VK_LINK_ROUNDTRIP");
      await form.getByRole("button", { name: "Добавить ссылку VK" }).click();
      const dialog = page.getByRole("dialog", {
        name: "Добавить видео VK",
        exact: true,
      });
      const field = dialog.getByLabel("Экспортируемая ссылка VK", {
        exact: true,
      });
      await expect(field).toBeFocused();
      await field.fill("https://vk.com/video-227034863_456239527");
      await dialog
        .getByRole("button", { name: "Добавить видео", exact: true })
        .click();
      await expect(dialog.getByRole("alert")).toContainText("video_ext.php");
      const action = dialog.getByRole("button", {
        name: "Добавить видео",
        exact: true,
      });
      const contrast = await action.evaluate((node) => {
        const style = getComputedStyle(node);
        const luminance = (color: string) =>
          color
            .match(/[\d.]+/g)!
            .slice(0, 3)
            .reduce((sum, channel, index) => {
              const value = Number(channel) / 255;
              const linear =
                value <= 0.04045
                  ? value / 12.92
                  : ((value + 0.055) / 1.055) ** 2.4;
              return sum + linear * [0.2126, 0.7152, 0.0722][index];
            }, 0);
        const foreground = luminance(style.color);
        const background = luminance(style.backgroundColor);
        return (
          (Math.max(foreground, background) + 0.05) /
          (Math.min(foreground, background) + 0.05)
        );
      });
      expect(contrast).toBeGreaterThanOrEqual(4.5);
      expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await page.screenshot({
        path: test.info().outputPath(`vk-input-${mode}-${width}.png`),
      });
      expect(
        await dialog.evaluate((node) => node.scrollWidth <= innerWidth),
      ).toBe(true);
      await field.fill(`  ${link}&autoplay=1  `);
      await field.press("Enter");
      await expect(dialog).toHaveCount(0);
      await expect(
        form.getByRole("button", { name: "Добавить ссылку VK" }),
      ).toBeFocused();
      await expect(form.getByText("Видео (1)", { exact: true })).toBeVisible();
      await expect(
        form.getByText("Черновик сохранён на этом устройстве", { exact: true }),
      ).toBeVisible();
      // An added URL follows the same durable draft path as files.
      await page.reload();
      await openNew();
      await expect(form.getByText("Видео (1)", { exact: true })).toBeVisible();
      await form.getByRole("button", { name: "Добавить ссылку VK" }).click();
      await field.fill(link);
      await field.press("Enter");
      await expect(dialog.getByRole("alert")).toHaveText(
        "Это видео уже добавлено.",
      );
      await page.keyboard.press("Escape");
      for (let cycle = 0; cycle < 3; cycle++) {
        await form
          .getByRole("button", { name: "Посмотреть видео VK 1" })
          .click();
        const preview = page.getByRole("dialog", {
          name: "Предпросмотр видео VK",
          exact: true,
        });
        await expect(
          preview.getByTitle("VK Видео", { exact: true }),
        ).toHaveAttribute("src", savedLink);
        const box = await preview.locator("iframe").boundingBox();
        expect(box!.width).toBeLessThanOrEqual(width);
        if (cycle === 0)
          await page.screenshot({
            path: test.info().outputPath(`vk-editor-${mode}-${width}.png`),
          });
        await preview
          .getByRole("button", { name: "Закрыть видео", exact: true })
          .click();
        await expect(page.locator("iframe")).toHaveCount(0);
        await expect(
          form.getByRole("button", { name: "Посмотреть видео VK 1" }),
        ).toBeFocused();
      }
      // Target is the existing server-owned post access boundary.
      await form
        .getByRole("button", {
          name: mode === "full" ? "Клуб" : "Везде",
          exact: true,
        })
        .click();
      await form
        .getByRole("button", {
          name: mode === "full" ? "Сохранить" : "Опубликовать",
          exact: true,
        })
        .first()
        .click();
      await expect(form).toHaveCount(0);
      expect(writes).toHaveLength(1);
      expect(writes[0]).toMatchObject({
        videos: [savedLink],
        target: mode === "full" ? "club" : "both",
      });
      expect(uploads).toBe(0);
      await page.reload();
      if (mode === "quick")
        await page
          .getByRole("button", { name: "Действия с постом", exact: true })
          .click();
      await page
        .getByRole("button", { name: "Редактировать пост", exact: true })
        .first()
        .click();
      await expect(
        form.getByText("Черновик сохранён на этом устройстве", { exact: true }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(form.getByText("Видео (1)", { exact: true })).toBeVisible();
      await form
        .getByRole("button", { name: "Удалить видео 1", exact: true })
        .click();
      await form
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      await expect(form).toHaveCount(0);
      expect(writes).toHaveLength(2);
      expect(writes[1]).toMatchObject({ id: 42, videos: [] });
    });
  }
}
