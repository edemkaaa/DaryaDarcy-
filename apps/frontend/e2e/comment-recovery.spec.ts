import { expect, test, type Page } from "@playwright/test";
import { editorApi, failure, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

const now = () => new Date().toISOString();
const post = () => ({
  id: 1,
  text: "RECOVERY_POST",
  photos: [],
  media: [],
  tags: ["community"],
  target: "club",
  createdAt: now(),
  publishedAt: now(),
  likeCount: 0,
  commentCount: 23,
});
const comment = (id: number, text = `ROOT_${id}`) => ({
  id,
  postId: 1,
  parentId: null,
  userId: 101,
  text,
  photos: [],
  authorName: "Test",
  authorAvatarUrl: null,
  createdAt: now(),
  likeCount: 0,
  likedByMe: false,
  replyCount: 0,
});

for (const width of [320, 390, 1440]) {
  test(`a deleted reply parent preserves the discussion and composed reply at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    let missing = false;
    await editorApi(page, (name, input) => {
      if (name === "club.list")
        return ok({ posts: [post()], nextCursor: null });
      if (name === "club.commentsPage") {
        if (input.parentId) {
          missing = true;
          return failure(404);
        }
        return ok({
          items: input.cursor
            ? missing
              ? [comment(22, "PROMOTED_REPLY"), comment(23)]
              : [{ ...comment(21), replyCount: 1 }, comment(23)]
            : Array.from({ length: 20 }, (_, i) => comment(i + 1)),
          nextCursor: input.cursor ? null : "tail",
          totalCount: missing ? 22 : 23,
        });
      }
    });
    await gotoWithSession(page, "/club");
    await page
      .getByRole("button", { name: "Ещё комментарии", exact: true })
      .click();
    const parent = page
      .getByText("ROOT_21", { exact: true })
      .locator(
        "xpath=ancestor::div[.//button[@aria-label='Действия с комментарием']][1]",
      );
    await parent.getByRole("button", { name: "Ответить", exact: true }).click();
    await page.getByPlaceholder("Ваш ответ...").fill("UNSENT_REPLY_DRAFT");
    await page
      .getByRole("button", { name: "Показать ответы (1)", exact: true })
      .click();
    await expect(
      page.getByText("Этот комментарий больше недоступен.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("ROOT_23", { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder("Ваш ответ...")).toHaveValue(
      "UNSENT_REPLY_DRAFT",
    );
    await expect(
      page.getByText("Комментарии недоступны", { exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: test.info().outputPath("deleted-parent-local-notice.png"),
    });
    await page
      .getByRole("button", { name: "Обновить обсуждение", exact: true })
      .click();
    await expect(page.getByText("ROOT_21", { exact: true })).toHaveCount(0);
    await expect(
      page.getByText("PROMOTED_REPLY", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("ROOT_23", { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder("Написать комментарий...")).toHaveValue(
      "UNSENT_REPLY_DRAFT",
    );
    await page.screenshot({
      path: test.info().outputPath("deleted-parent-recovered.png"),
    });
  });
}

async function textFixture(page: Page, lost: "network" | "503" = "503") {
  const state = {
    enabled: true,
    rejectCapabilities: false,
    calls: [] as Record<string, unknown>[],
    saved: new Map<string, number>(),
    loseReply: true,
  };
  await editorApi(page, async (name, input, route) => {
    if (name === "club.list") return ok({ posts: [post()], nextCursor: null });
    if (name === "club.addComment") {
      state.calls.push(input);
      if (state.enabled)
        expect(input.idempotencyKey).toMatch(/^[a-f0-9-]{36}$/);
      const key = String(
        input.idempotencyKey ?? `legacy-${state.calls.length}`,
      );
      if (!state.saved.has(key)) state.saved.set(key, 101 + state.saved.size);
      if (state.loseReply) {
        state.loseReply = false;
        if (lost === "network") await route.abort("failed");
        return failure(503);
      }
      return ok({ id: state.saved.get(key) });
    }
    if (name === "club.commentsPage")
      return ok({
        items: [...state.saved.values()].map((id) =>
          comment(id, "PERSISTED_TEXT_COMMENT"),
        ),
        nextCursor: null,
        totalCount: state.saved.size,
      });
  });
  await page.route("**/api/capabilities", (route) =>
    state.rejectCapabilities
      ? route.fulfill({ status: 503, json: { error: "unavailable" } })
      : route.fulfill({
          json: {
            smsLogin: false,
            penPals: false,
            shopOnlinePayment: false,
            webPush: false,
            privateContentUploads: state.enabled,
            privatePostMediaUploads: false,
            privatePostVideoUploads: false,
          },
        }),
  );
  return state;
}

for (const lost of ["network", "503"] as const) {
  test(`lost text comment ACK (${lost}) survives reload and replays the original key and payload`, async ({
    page,
  }) => {
    const state = await textFixture(page, lost);
    await gotoWithSession(page, "/club");
    await page
      .getByPlaceholder("Написать комментарий...")
      .fill("PERSISTED_TEXT_COMMENT");
    await page.getByRole("button", { name: "Отправить", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Повторить отправку", exact: true }),
    ).toBeEnabled();
    expect(state.calls).toHaveLength(1);
    await gotoWithSession(page, "/club");
    const retry = page.getByRole("button", {
      name: "Повторить отправку",
      exact: true,
    });
    await expect(retry).toBeEnabled();
    expect(state.calls).toHaveLength(1);
    await expect(
      page.getByPlaceholder("Написать комментарий..."),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Восстановить отправку", exact: true })
      .click();
    await expect(page.getByPlaceholder("Написать комментарий...")).toHaveValue(
      "PERSISTED_TEXT_COMMENT",
    );
    await retry.click();
    await expect(retry).toHaveCount(0);
    await expect(
      page.getByPlaceholder("Написать комментарий..."),
    ).toBeEnabled();
    await expect(page.getByPlaceholder("Написать комментарий...")).toHaveValue(
      "",
    );
    expect(state.calls).toHaveLength(2);
    expect(state.calls[1]).toEqual(state.calls[0]);
    expect(state.saved.size).toBe(1);
    await expect(
      page.getByText("PERSISTED_TEXT_COMMENT", { exact: true }),
    ).toHaveCount(1);
  });
}

test("a stored keyed text operation cannot downgrade when the server capability switches off", async ({
  page,
}) => {
  const state = await textFixture(page);
  await gotoWithSession(page, "/club");
  await page
    .getByPlaceholder("Написать комментарий...")
    .fill("PERSISTED_TEXT_COMMENT");
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
  const retry = page.getByRole("button", {
    name: "Повторить отправку",
    exact: true,
  });
  await expect(retry).toBeEnabled();
  state.enabled = false;
  await retry.click();
  await expect(
    page.getByText(
      "Отправка комментария сейчас недоступна. Попробуйте позже.",
      {
        exact: true,
      },
    ),
  ).toBeVisible();
  await expect(retry).toBeEnabled();
  expect(state.calls).toHaveLength(1);
  state.enabled = true;
  await retry.click();
  await expect(retry).toHaveCount(0);
  await expect(page.getByPlaceholder("Написать комментарий...")).toBeEnabled();
  expect(state.calls[1]).toEqual(state.calls[0]);
  expect(state.saved.size).toBe(1);
});

test("an explicitly disabled server gate keeps the existing unkeyed text contract", async ({
  page,
}) => {
  const state = await textFixture(page);
  state.enabled = false;
  state.loseReply = false;
  await gotoWithSession(page, "/club");
  await page
    .getByPlaceholder("Написать комментарий...")
    .fill("PERSISTED_TEXT_COMMENT");
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect(page.getByPlaceholder("Написать комментарий...")).toHaveValue(
    "",
  );
  expect(state.calls).toHaveLength(1);
  expect(state.calls[0].idempotencyKey).toBeUndefined();
});

test("a failed capability read never silently dispatches an unkeyed text comment", async ({
  page,
}) => {
  const state = await textFixture(page);
  await gotoWithSession(page, "/club");
  await page.getByPlaceholder("Написать комментарий...").fill("UNSENT_TEXT");
  state.rejectCapabilities = true;
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Сервис временно недоступен" }),
  ).toBeVisible();
  await expect(page.getByPlaceholder("Написать комментарий...")).toHaveValue(
    "UNSENT_TEXT",
  );
  expect(state.calls).toHaveLength(0);
});

test("the payments screen states the current API history limit", async ({
  page,
}) => {
  await editorApi(page);
  await gotoWithSession(page, "/admin");
  await page.getByRole("button", { name: /Оплаты/ }).click();
  await expect(
    page.getByText(
      "Последние 50 оплат. Более ранние записи здесь не отображаются.",
      { exact: true },
    ),
  ).toBeVisible();
});

test("another tab with a stale empty journal cannot create a second text operation", async ({
  page,
  context,
}) => {
  const first = await textFixture(page);
  await gotoWithSession(page, "/club");
  const other = await context.newPage();
  const second = await textFixture(other);
  await gotoWithSession(other, "/club");
  await expect(other.getByPlaceholder("Написать комментарий...")).toBeEnabled();
  await page
    .getByPlaceholder("Написать комментарий...")
    .fill("PERSISTED_TEXT_COMMENT");
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Повторить отправку", exact: true }),
  ).toBeEnabled();
  await other
    .getByPlaceholder("Написать комментарий...")
    .fill("DIFFERENT_TAB_TEXT");
  await other.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect(
    other.getByText(
      "На этом устройстве уже есть отправка. Восстановите её перед повтором.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(first.calls).toHaveLength(1);
  expect(second.calls).toHaveLength(0);
  await other
    .getByRole("button", { name: "Восстановить отправку", exact: true })
    .click();
  await expect(other.getByPlaceholder("Написать комментарий...")).toHaveValue(
    "PERSISTED_TEXT_COMMENT",
  );
  await other.close();
});

test("a late capability response cannot dispatch a text comment after leaving the screen", async ({
  page,
}) => {
  const state = await textFixture(page);
  await gotoWithSession(page, "/club");
  await page.getByPlaceholder("Написать комментарий...").fill("UNSENT_TEXT");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let pending = false;
  await page.route("**/api/capabilities", async (route) => {
    pending = true;
    await gate;
    await route
      .fulfill({ json: { privateContentUploads: false } })
      .catch(() => {});
  });
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect.poll(() => pending).toBe(true);
  await page.getByRole("link", { name: "На главную", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  release();
  // A round-trip through the retained tab flushes the cancelled continuation.
  await page.getByRole("link", { name: "Клуб", exact: true }).click();
  await expect(page.getByPlaceholder("Написать комментарий...")).toBeEnabled();
  expect(state.calls).toHaveLength(0);
});
