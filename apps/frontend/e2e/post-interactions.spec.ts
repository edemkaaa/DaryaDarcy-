import { expect, test, type Page } from "@playwright/test";
import { editorApi, failure, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

/** Gate раздельно удерживает mutation, персональный read и count-detail, чтобы воспроизводить гонки их поколений. */
function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

const actions = [
  { kind: "like", procedure: "feed.toggleLike", label: "Нравится" },
  { kind: "save", procedure: "feed.toggleSave", label: "Сохранить пост" },
] as const;

/** Моделируем owner, подтверждённые отметки и общий счётчик отдельно; snapshot-read фиксируется до gate, а mutation учитывает владельца начала запроса. */
async function fixture(page: Page) {
  const state = {
    owner: 101,
    reads: 0,
    writes: [] as string[],
    liked: [] as number[],
    saved: [] as number[],
    gate: undefined as Promise<void> | undefined,
    heldProcedure: undefined as string | undefined,
    readGate: undefined as Promise<void> | undefined,
    status: 0,
    readStatus: 0,
    detailStatus: 0,
    detailMissing: false,
    detailGate: undefined as Promise<void> | undefined,
    totalLikes: 17,
    calls: [] as string[],
  };
  /** Количество лайков включает внешнюю базу плюс текущую отметку, чтобы локальная арифметика не подменяла свежий серверный count. */
  const post = () => ({
    id: 1,
    text: "SHARED_INTERACTION_POST",
    photos: [],
    tags: [],
    media: [],
    target: "both",
    published: true,
    status: "published",
    richText: null,
    likeCount: state.totalLikes + state.liked.length,
    commentCount: 0,
    createdAt: "2026-10-04T10:00:00Z",
    publishedAt: "2026-10-04T10:00:00Z",
  });
  await editorApi(page, async (name) => {
    state.calls.push(name);
    if (name === "club.subscription")
      return ok({
        hasClubAccess: true,
        subscribed: true,
        expiresAt: "2040-11-01T10:00:00Z",
        cancelAtPeriodEnd: false,
        cancellationStatus: "none",
        isOwner: false,
        monthlyPrice: "790",
      });
    if (name === "feed.listPaginated" || name === "club.listByCategory")
      return ok({ posts: [post()], nextCursor: null });
    if (name === "feed.getById") {
      const result = state.detailStatus
        ? failure(state.detailStatus)
        : ok(state.detailMissing ? null : post());
      await state.detailGate;
      return result;
    }
    if (name === "feed.userInteractions") {
      state.reads++;
      const result = state.readStatus
        ? failure(state.readStatus)
        : ok({ likedIds: state.liked, savedIds: state.saved });
      if (state.readGate) await state.readGate;
      return result;
    }
    if (name === "feed.toggleLike" || name === "feed.toggleSave") {
      state.writes.push(name);
      const owner = state.owner;
      const status = state.status;
      if (state.gate && (!state.heldProcedure || state.heldProcedure === name))
        await state.gate;
      if (status) return failure(status);
      if (owner === state.owner) {
        const field = name === "feed.toggleLike" ? "liked" : "saved";
        state[field] = state[field].length ? [] : [1];
        return ok(state[field].length > 0);
      }
      return ok(true);
    }
  });
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: state.owner,
          openId: `interaction-${state.owner}`,
          name: "Участница",
          role: "user",
          gender: "female",
          email: "member@example.test",
          lastSignedIn: "2026-10-04T10:00:00Z",
        },
      },
    }),
  );
  return state;
}

/** Подтверждённый toggle обновляет отметку, затем точечно читает count своего поста и передаёт его retained-ленте. */
test("confirmed likes read only their post and copy the server count into the retained feed", async ({
  page,
}) => {
  const state = await fixture(page);
  await gotoWithSession(page, "/feed");
  const like = page.getByRole("button", { name: "Нравится", exact: true });
  await expect(like).toBeEnabled();
  await expect(like).toHaveText(/(?:^|\D)17$/);
  state.calls.length = 0;
  await like.click();
  await expect(like).toBeEnabled();
  await expect(like).toHaveText(/(?:^|\D)18$/);
  expect(state.calls).toEqual(["feed.toggleLike", "feed.getById"]);
  const detailRead = page.waitForResponse(
    (response) =>
      response.url().includes("feed.getById") && response.status() === 200,
  );
  await page.getByText("SHARED_INTERACTION_POST", { exact: true }).click();
  await expect(page).toHaveURL(/\/post\/1$/);
  await detailRead;
  await expect(like).toBeVisible();
  await expect(like).toBeEnabled();
  // Another user's likes must be reflected; subtracting one locally is wrong.
  state.totalLikes = 40;
  state.calls.length = 0;
  await like.click();
  await expect(like).toBeEnabled();
  await expect(like).toHaveText(/(?:^|\D)40$/);
  expect(state.calls).toEqual(["feed.toggleLike", "feed.getById"]);
  await page.goBack();
  await expect(page).toHaveURL(/\/feed$/);
  await expect(like).toHaveText(/(?:^|\D)40$/);
  await expect(like).toHaveAttribute("aria-pressed", "false");
});

/** Сбой count-read не откатывает уже подтверждённую отметку; recovery читает состояние без replay мутации. */
test("a failed count refresh preserves the confirmed mark and recovers without replaying the mutation", async ({
  page,
}) => {
  const state = await fixture(page);
  await gotoWithSession(page, "/feed");
  const like = page.getByRole("button", { name: "Нравится", exact: true });
  await expect(like).toBeEnabled();
  state.detailStatus = 503;
  await like.click();
  await expect(
    page.getByText(
      "Отметка обновлена, но не удалось обновить счётчик. Обновите отметки.",
    ),
  ).toBeVisible();
  await expect(like).toBeEnabled();
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await expect(like).toHaveText(/(?:^|\D)17$/);
  state.detailStatus = 0;
  await page
    .getByRole("button", { name: "Обновить отметки", exact: true })
    .click();
  await expect(like).toHaveText(/(?:^|\D)18$/);
  await expect(
    page.getByRole("button", { name: "Обновить отметки", exact: true }),
  ).toHaveCount(0);
  expect(state.writes).toEqual(["feed.toggleLike"]);
});

/** Свежий missing-detail после toggle удаляет карточку из кеша вместо сохранения устаревшей записи. */
test("a post removed before the count read disappears from the cached feed", async ({
  page,
}) => {
  const state = await fixture(page);
  await gotoWithSession(page, "/feed");
  const like = page.getByRole("button", { name: "Нравится", exact: true });
  await expect(like).toBeEnabled();
  state.detailMissing = true;
  await like.click();
  await expect(
    page.getByText("SHARED_INTERACTION_POST", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Публикаций пока нет", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toEqual(["feed.toggleLike"]);
});

/** Поздний count прежнего владельца не восстанавливает его кеш после смены аккаунта. */
test("a delayed count refresh cannot restore the previous account's cache", async ({
  page,
}) => {
  const state = await fixture(page);
  const gate = deferred();
  try {
    await gotoWithSession(page, "/feed");
    const like = page.getByRole("button", { name: "Нравится", exact: true });
    await expect(like).toBeEnabled();
    state.detailGate = gate.promise;
    await like.click();
    await expect.poll(() => state.calls.includes("feed.getById")).toBe(true);
    state.owner = 202;
    state.liked = [];
    state.totalLikes = 99;
    state.detailGate = undefined;
    await page.evaluate(() =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "darcy:session-change",
          newValue: "new-count-owner",
        }),
      ),
    );
    await expect(like).toBeEnabled();
    await expect(like).toHaveText(/(?:^|\D)99$/);
    gate.release();
    await page.getByText("SHARED_INTERACTION_POST", { exact: true }).click();
    await expect(page).toHaveURL(/\/post\/1$/);
    await expect(like).toBeEnabled();
    await expect(like).toHaveText(/(?:^|\D)99$/);
    await expect(like).toHaveAttribute("aria-pressed", "false");
    expect(state.writes).toEqual(["feed.toggleLike"]);
  } finally {
    gate.release();
  }
});

/** Лайк и сохранение проверяются из ленты, клуба и detail: pending shared-state блокирует дубли между экранами. */
for (const action of actions) {
  for (const source of ["feed", "club", "post"] as const) {
    test(`${action.kind}: pending state survives navigation from ${source}`, async ({
      page,
    }) => {
      const state = await fixture(page);
      const gate = deferred();
      state.gate = gate.promise;
      try {
        await gotoWithSession(page, source === "club" ? "/club" : "/feed");
        if (source === "post") {
          await page
            .getByText("SHARED_INTERACTION_POST", { exact: true })
            .click();
          await expect(page).toHaveURL(/\/post\/1$/);
        }
        const button = page.getByRole("button", {
          name: action.label,
          exact: true,
        });
        await expect(button).toBeEnabled();
        await button.click();
        await expect.poll(() => state.writes.length).toBe(1);
        if (source === "post") {
          await page.goBack();
          await expect(page).toHaveURL(/\/feed$/);
        } else {
          await page
            .getByText("SHARED_INTERACTION_POST", { exact: true })
            .click();
          await expect(page).toHaveURL(/\/post\/1$/);
        }
        // The other action being enabled proves that initial reads have finished.
        const other = actions.find((item) => item.kind !== action.kind)!;
        await expect(
          page.getByRole("button", { name: other.label, exact: true }),
        ).toBeEnabled();
        await expect(button).toHaveAttribute("aria-pressed", "true");
        await expect(button).toBeDisabled();
        await button.evaluate((node) => (node as HTMLButtonElement).click());
        expect(state.writes).toEqual([action.procedure]);
        gate.release();
        await expect(button).toBeEnabled();
        await expect(button).toHaveAttribute("aria-pressed", "true");
        expect(state.writes).toEqual([action.procedure]);
      } finally {
        gate.release();
      }
    });
  }

  /** Unknown-toggle остаётся заблокированным через навигацию и успех другого действия; разблокирует его только успешная сверка соответствующего состояния. */
  test(`${action.kind}: uncertain outcome stays blocked across screens until a successful explicit read`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state.status = 500;
    await gotoWithSession(page, "/feed");
    const button = page.getByRole("button", {
      name: action.label,
      exact: true,
    });
    await expect(button).toBeEnabled();
    await button.click();
    const retry = page.getByRole("button", {
      name: "Обновить отметки",
      exact: true,
    });
    await expect(retry).toBeVisible();
    await page.getByText("SHARED_INTERACTION_POST", { exact: true }).click();
    await expect(page).toHaveURL(/\/post\/1$/);
    await expect(retry).toBeVisible();
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute("aria-pressed", "false");
    // A successful unrelated action must not remove this error or its recovery.
    state.status = 0;
    const other = actions.find((item) => item.kind !== action.kind)!;
    await page.getByRole("button", { name: other.label, exact: true }).click();
    await expect(
      page.getByRole("button", { name: other.label, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: other.label, exact: true }),
    ).toBeEnabled();
    await expect(retry).toBeVisible();
    state.readStatus = 503;
    const [failedRead] = await Promise.all([
      page.waitForResponse((response) =>
        response.url().includes("feed.interactionsForPosts"),
      ),
      retry.click(),
    ]);
    await failedRead.finished();
    expect(JSON.stringify(await failedRead.json())).toContain(
      '"httpStatus":503',
    );
    await expect(
      page.getByRole("alert").filter({ hasText: "Сервис временно недоступен" }),
    ).toBeVisible();
    await expect(button).toBeDisabled();
    state.readStatus = 0;
    // The server may have applied the first write before its response was lost.
    state[action.kind === "like" ? "liked" : "saved"] = [1];
    await retry.click();
    await expect(button).toBeEnabled();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await expect(button).toBeEnabled();
    expect(
      state.writes.filter((name) => name === action.procedure),
    ).toHaveLength(2);
  });
}

/** ACK мутации прежнего аккаунта не меняет отметки нового, но не блокирует его самостоятельные действия. */
test("an old account's pending response cannot change the new account's marks", async ({
  page,
}) => {
  const state = await fixture(page);
  const gate = deferred();
  state.gate = gate.promise;
  try {
    await gotoWithSession(page, "/post/1");
    const like = page.getByRole("button", { name: "Нравится", exact: true });
    await expect(like).toBeEnabled();
    await like.click();
    await expect.poll(() => state.writes.length).toBe(1);
    state.owner = 202;
    await page.evaluate(() =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "darcy:session-change",
          newValue: "second-owner",
        }),
      ),
    );
    await expect(like).toBeEnabled();
    await expect(like).toHaveAttribute("aria-pressed", "false");
    gate.release();
    await page
      .getByRole("button", { name: "Сохранить пост", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Сохранить пост", exact: true }),
    ).toBeEnabled();
    await expect(like).toHaveAttribute("aria-pressed", "false");
    await like.click();
    await expect(like).toHaveAttribute("aria-pressed", "true");
    await expect(like).toBeEnabled();
    expect(
      state.writes.filter((name) => name === "feed.toggleLike"),
    ).toHaveLength(2);
  } finally {
    gate.release();
  }
});

/** Сверка покрывает только операции, существовавшие к её началу: более поздний unknown-write требует отдельного read. */
test("a recovery read cannot unlock a different write that failed after the read started", async ({
  page,
}) => {
  const state = await fixture(page);
  const mutation = deferred();
  const read = deferred();
  state.gate = mutation.promise;
  state.heldProcedure = "feed.toggleLike";
  state.status = 500;
  try {
    await gotoWithSession(page, "/post/1");
    const like = page.getByRole("button", { name: "Нравится", exact: true });
    const save = page.getByRole("button", {
      name: "Сохранить пост",
      exact: true,
    });
    await expect(like).toBeEnabled();
    await like.click();
    await expect.poll(() => state.writes.length).toBe(1);
    await save.click();
    const retry = page.getByRole("button", {
      name: "Обновить отметки",
      exact: true,
    });
    await expect(retry).toBeVisible();
    state.readGate = read.promise;
    const previousReads = state.reads;
    await retry.click();
    await expect.poll(() => state.reads).toBeGreaterThan(previousReads);
    mutation.release();
    await expect(like).toHaveAttribute("aria-pressed", "false");
    read.release();
    await expect(save).toBeEnabled();
    await expect(like).toBeDisabled();
    await expect(retry).toBeVisible();
    await retry.click();
    await expect(like).toBeEnabled();
    expect(state.writes).toHaveLength(2);
  } finally {
    mutation.release();
    read.release();
  }
});

/** Отменённая сверка не подтверждает unknown-save старым кешем, даже если параллельный like завершился успешно. */
test("a cancelled recovery read does not unlock an uncertain save with old cached data", async ({
  page,
}) => {
  const state = await fixture(page);
  const mutation = deferred();
  const read = deferred();
  try {
    await gotoWithSession(page, "/post/1");
    const like = page.getByRole("button", { name: "Нравится", exact: true });
    const save = page.getByRole("button", {
      name: "Сохранить пост",
      exact: true,
    });
    await expect(save).toBeEnabled();
    state.status = 500;
    await save.click();
    const retry = page.getByRole("button", {
      name: "Обновить отметки",
      exact: true,
    });
    await expect(retry).toBeVisible();
    state.status = 0;
    state.gate = mutation.promise;
    state.heldProcedure = "feed.toggleLike";
    await like.click();
    await expect.poll(() => state.writes.length).toBe(2);
    state.readGate = read.promise;
    const previousReads = state.reads;
    await retry.click();
    await expect.poll(() => state.reads).toBeGreaterThan(previousReads);
    // Confirming this write cancels the older recovery read; subsequent reads
    // may finish normally, but the cancelled read is not a recovery result.
    state.readGate = undefined;
    mutation.release();
    await expect(like).toBeEnabled();
    await expect(like).toHaveAttribute("aria-pressed", "true");
    await expect(save).toBeDisabled();
    read.release();
    await expect(retry).toBeVisible();
    await retry.click();
    await expect(save).toBeEnabled();
    expect(state.writes).toHaveLength(2);
  } finally {
    mutation.release();
    read.release();
  }
});
