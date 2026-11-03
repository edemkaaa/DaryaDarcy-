import { expect, test, type Page } from "@playwright/test";
import { editorApi, failure, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

const post = () => ({
  id: 77,
  text: "QUICK_ACTION_POST",
  photos: [],
  media: [],
  tags: [] as string[],
  target: "both",
  status: "published",
  published: true,
  richText: null,
  createdAt: "2026-10-20T10:00:00Z",
  publishedAt: "2026-10-20T10:00:00Z",
  scheduledAt: null,
  likeCount: 0,
  commentCount: 0,
});

function requests(page: Page) {
  const calls: { name: string; input: Record<string, unknown> }[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith("/api/trpc/")) return;
    const inputs = JSON.parse(
      request.postData() ?? url.searchParams.get("input") ?? "{}",
    );
    url.pathname
      .slice("/api/trpc/".length)
      .split(",")
      .forEach((name, index) => {
        calls.push({ name, input: inputs[index]?.json ?? {} });
      });
  });
  return calls;
}

async function menu(page: Page, action: string) {
  await page
    .getByRole("button", { name: "Действия с постом", exact: true })
    .click();
  await page.getByRole("button", { name: action, exact: true }).click();
}

for (const screen of ["feed", "club"] as const) {
  for (const lost of [false, true]) {
    test(`${screen}: quick tags and deletion ${lost ? "recover lost write responses" : "confirm normally"} without the archive`, async ({
      page,
    }) => {
      const current = post();
      let exists = true;
      const calls = requests(page);
      await editorApi(page, async (name, input, route) => {
        if (name === "club.subscription")
          return ok({
            hasClubAccess: true,
            subscribed: true,
            expiresAt: "2030-01-01T00:00:00Z",
            cancelAtPeriodEnd: false,
            cancellationStatus: "none",
            isOwner: true,
            monthlyPrice: "790",
          });
        if (
          [
            "feed.listPaginated",
            "club.listByCategory",
            "admin.postsPage",
          ].includes(name)
        )
          return ok({
            posts: exists
              ? [{ ...current, tagCount: current.tags.length, hasVideo: false }]
              : [],
            nextCursor: null,
          });
        if (name === "admin.postCounts")
          return ok({
            total: Number(exists),
            published: Number(exists),
            scheduled: 0,
            draft: 0,
          });
        if (name === "admin.postDetail") return ok(exists ? current : null);
        if (name === "admin.updatePost") {
          // Recovery must read server state, including canonical tags absent in the draft.
          current.tags = lost ? ["spring", "winter"] : (input.tags as string[]);
          if (lost) await route.abort("failed");
          return ok({ success: true });
        }
        if (name === "admin.deletePost") {
          exists = false;
          if (lost) await route.abort("failed");
          return ok(null);
        }
      });
      page.on("dialog", (dialog) => dialog.accept());
      // Prime the admin cache; returning must show refreshed cards and counters.
      await gotoWithSession(page, "/admin");
      await expect(page.getByTestId("admin-post-77")).toBeVisible();
      const countsBefore = calls.filter(
        (call) => call.name === "admin.postCounts",
      ).length;
      await page
        .getByRole("navigation", { name: "Разделы" })
        .getByRole("link", {
          name: screen === "feed" ? "Лента" : "Клуб",
          exact: true,
        })
        .click();
      await expect(page.getByText(current.text, { exact: true })).toBeVisible();
      await menu(page, "Выбрать хештеги");
      const tags = page.getByRole("dialog", { name: "Теги публикации" });
      await tags.getByRole("button", { name: "Весна", exact: true }).click();
      await tags
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      if (lost) {
        await expect(tags.getByRole("alert")).toContainText("не подтверждён");
        await expect(
          tags.getByRole("button", { name: "Сохранить", exact: true }),
        ).toBeDisabled();
        await tags
          .getByRole("button", { name: "Обновить публикации", exact: true })
          .click();
        // A fresh read updates the card but must preserve the unsaved local draft.
        expect(current.tags).toEqual(["spring", "winter"]);
        await expect(
          page.getByText(screen === "feed" ? "#Зима" : "зима", {
            exact: true,
          }),
        ).toBeVisible();
        expect(
          await page.evaluate(() => {
            const draft = localStorage.getItem("darcy:tag-draft:101:77");
            return draft ? JSON.parse(draft).tags : null;
          }),
        ).toEqual(["spring"]);
        await expect(
          tags.getByText("Выбрано: 1", { exact: true }),
        ).toBeVisible();
        await expect(
          tags.getByRole("button", { name: "Сохранить", exact: true }),
        ).toBeEnabled();
        await tags
          .getByRole("button", { name: "Закрыть редактор тегов" })
          .click();
        await page
          .getByRole("dialog", { name: "Результат действия с публикацией" })
          .getByRole("button", { name: "Закрыть", exact: true })
          .click();
      } else {
        await expect(tags).toHaveCount(0);
        await menu(page, "Выбрать хештеги");
        await expect(
          tags.getByText("Выбрано: 1", { exact: true }),
        ).toBeVisible();
        await tags
          .getByRole("button", { name: "Закрыть редактор тегов" })
          .click();
      }
      await menu(page, "Удалить пост");
      if (lost) {
        const result = page.getByRole("dialog", {
          name: "Результат действия с публикацией",
        });
        await expect(result.getByRole("alert")).toContainText("не подтверждён");
        await result
          .getByRole("button", { name: "Обновить публикации", exact: true })
          .click();
        await expect(
          result.getByRole("button", {
            name: "Обновить публикации",
            exact: true,
          }),
        ).toHaveCount(0);
        await result
          .getByRole("button", { name: "Закрыть", exact: true })
          .click();
      }
      await expect(page.getByText(current.text, { exact: true })).toHaveCount(
        0,
      );
      await page.goBack();
      await expect(page).toHaveURL(/\/admin$/);
      await expect(page.getByTestId("admin-post-77")).toHaveCount(0);
      await expect
        .poll(
          () => calls.filter((call) => call.name === "admin.postCounts").length,
        )
        .toBeGreaterThan(countsBefore);
      await expect(
        page.getByText("Всего", { exact: true }).locator(".."),
      ).toContainText("0");
      expect(calls.filter((call) => call.name === "admin.posts")).toEqual([]);
      expect(calls.filter((call) => call.name === "admin.postDetail")).toEqual(
        // Normal: open, verify write, reopen, verify deletion. Lost: open, two recoveries.
        Array.from({ length: lost ? 3 : 4 }, () => ({
          name: "admin.postDetail",
          input: { id: 77 },
        })),
      );
      expect(
        calls.filter((call) => call.name === "admin.updatePost"),
      ).toHaveLength(1);
      expect(
        calls.filter((call) => call.name === "admin.deletePost"),
      ).toHaveLength(1);
    });
  }
}

for (const detail of [{}, { id: 78, tags: [] }, { id: 77, tags: [2] }]) {
  test(`deletion rejects malformed detail ${JSON.stringify(detail)} and waits for null`, async ({
    page,
  }) => {
    let inspected: unknown = detail;
    const calls = requests(page);
    await editorApi(page, (name) => {
      if (name === "feed.listPaginated")
        return ok({
          posts: inspected === null ? [] : [post()],
          nextCursor: null,
        });
      if (name === "admin.postDetail") return ok(inspected);
      if (name === "admin.deletePost") return ok(null);
    });
    page.on("dialog", (dialog) => dialog.accept());
    await gotoWithSession(page, "/feed");
    await menu(page, "Удалить пост");
    const result = page.getByRole("dialog", {
      name: "Результат действия с публикацией",
    });
    await expect(result.getByRole("alert")).toContainText("не подтверждён");
    const check = result.getByRole("button", {
      name: "Обновить публикации",
      exact: true,
    });
    await check.click();
    await expect(result.getByRole("alert")).toContainText(
      "Некорректный ответ сервера",
    );
    await expect(check).toBeEnabled();
    inspected = null;
    await check.click();
    await expect(check).toHaveCount(0);
    await expect(page.getByText(post().text, { exact: true })).toHaveCount(0);
    expect(
      calls.filter((call) => call.name === "admin.deletePost"),
    ).toHaveLength(1);
    expect(calls.filter((call) => call.name === "admin.posts")).toEqual([]);
    expect(
      calls
        .filter((call) => call.name === "admin.postDetail")
        .map((call) => call.input),
    ).toEqual([{ id: 77 }, { id: 77 }, { id: 77 }]);
  });
}

test("an account change cancels a late quick-action inspection", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = false;
  let holdInspection = false;
  let otherAccount = false;
  const calls = requests(page);
  let cancelled = false;
  page.on("requestfailed", (request) => {
    if (request.url().includes("admin.postDetail")) cancelled = true;
  });
  await editorApi(page, async (name) => {
    if (name === "feed.listPaginated")
      return ok({
        posts: [
          {
            ...post(),
            text: otherAccount ? "OTHER_ACCOUNT_POST" : post().text,
          },
        ],
        nextCursor: null,
      });
    if (name === "admin.updatePost") return failure(503);
    if (name === "admin.postDetail") {
      if (!holdInspection) return ok(post());
      started = true;
      await held;
      return ok(null);
    }
  });
  await gotoWithSession(page, "/feed");
  await menu(page, "Выбрать хештеги");
  const tags = page.getByRole("dialog", { name: "Теги публикации" });
  await tags.getByRole("button", { name: "Весна", exact: true }).click();
  await tags.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(tags.getByRole("alert")).toContainText("не подтверждён");
  holdInspection = true;
  await tags
    .getByRole("button", { name: "Обновить публикации", exact: true })
    .click();
  try {
    await expect.poll(() => started).toBe(true);
    otherAccount = true;
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        json: {
          user: {
            id: 202,
            openId: "other-user",
            name: "Other",
            role: "user",
            lastSignedIn: "2026-10-20T10:00:00Z",
          },
        },
      }),
    );
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(
      page.getByText("OTHER_ACCOUNT_POST", { exact: true }),
    ).toBeVisible();
    await expect(tags).toHaveCount(0);
    await expect.poll(() => cancelled).toBe(true);
    release();
    await expect(
      page.getByText("OTHER_ACCOUNT_POST", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("dialog", { name: "Результат действия с публикацией" }),
    ).toHaveCount(0);
    expect(
      calls.filter((call) => call.name === "admin.updatePost"),
    ).toHaveLength(1);
    expect(calls.filter((call) => call.name === "admin.posts")).toEqual([]);
  } finally {
    release();
  }
});
