import { expect, test, type Page } from "@playwright/test";
import superjson from "superjson";
import { editorApi, failure, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

const person = {
  id: 101,
  openId: "handoff-member",
  name: "Участница",
  role: "user",
  email: "member@example.test",
  lastSignedIn: "2026-10-14T10:00:00Z",
};
const receipt =
  "Запрос принят. Проверьте почту: в письме будет ссылка для установки пароля.";
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
async function fixture(page: Page, authenticated = true) {
  const state = {
    user: authenticated ? { ...person } : (null as typeof person | null),
    postTarget: "feed" as "feed" | "both",
    paid: false,
    blocked: false,
    password: "initial-password",
    registerStatus: 202,
    registerWrites: [] as Record<string, unknown>[],
    logins: [] as Record<string, unknown>[],
    instructionWrites: 0,
    postOutcome: "success" as "success" | "missing" | "undefined" | number,
    commentsStatus: 0,
    commentsReads: 0,
    postReads: 0,
    interactionReads: 0,
    toggleWrites: [] as string[],
    interactionsStatus: 0,
    interactionsGate: undefined as Promise<void> | undefined,
    likeStatus: 0,
    liked: [] as number[],
    saved: [] as number[],
  };
  const post = () => ({
    id: 1,
    text: "HANDOFF_POST",
    target: state.postTarget,
    published: true,
    status: "published",
    photos: [
      "https://handoff.example.test/video_thumb.jpg",
      "https://handoff.example.test/photo.png",
    ],
    media: [
      {
        id: 5,
        type: "video",
        url: "https://handoff.example.test/video.mp4",
        duration: null,
        filename: null,
        mimeType: null,
        posterUrl: null,
        fileSize: null,
        postId: 1,
        sortOrder: 0,
        createdAt: "2026-10-14T10:00:00Z",
      },
    ],
    tags: ["community"],
    richText: null,
    createdAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    likeCount: 0,
    commentCount: 1,
  });
  await editorApi(page, async (name) => {
    if (name === "club.subscription")
      return ok({
        hasClubAccess: state.paid,
        subscribed: state.paid,
        expiresAt: state.paid ? "2040-11-01T10:00:00Z" : null,
        cancelAtPeriodEnd: false,
        cancellationStatus: "none",
        isOwner: false,
        monthlyPrice: "790",
      });
    if (name === "feed.getById") {
      state.postReads++;
      if (typeof state.postOutcome === "number")
        return failure(state.postOutcome);
      if (state.postOutcome === "undefined")
        return { result: { data: superjson.serialize(undefined) } };
      return ok(state.postOutcome === "missing" ? null : post());
    }
    if (name === "feed.listPaginated")
      return ok({ posts: [post()], nextCursor: null });
    if (name === "club.comments") {
      state.commentsReads++;
      return state.commentsStatus
        ? failure(state.commentsStatus)
        : ok([
            {
              id: 11,
              userId: 101,
              postId: 1,
              parentId: null,
              text: "HANDOFF_COMMENT",
              photos: ["https://handoff.example.test/comment.png"],
              authorName: "Автор",
              authorAvatarUrl: null,
              createdAt: new Date().toISOString(),
              likeCount: 0,
              likedByMe: false,
            },
          ]);
    }
    if (name === "club.toggleCommentLike")
      return ok({ liked: true, likeCount: 1 });
    if (name === "feed.userInteractions") {
      state.interactionReads++;
      if (state.interactionsGate) await state.interactionsGate;
      return state.interactionsStatus
        ? failure(state.interactionsStatus)
        : ok({ likedIds: state.liked, savedIds: state.saved });
    }
    if (name === "feed.toggleLike" || name === "feed.toggleSave") {
      state.toggleWrites.push(name);
      if (state.likeStatus) return failure(state.likeStatus);
      if (name === "feed.toggleLike") state.liked = [1];
      else state.saved = [1];
      return ok(true);
    }
  });
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { user: state.user } }),
  );
  await page.route("**/api/auth/register", (route) => {
    state.registerWrites.push(route.request().postDataJSON());
    return route.fulfill({
      status: state.registerStatus,
      json:
        state.registerStatus === 202
          ? { ok: true, message: receipt }
          : { error: "SMTP_PRIVATE_DETAILS" },
    });
  });
  await page.route("**/api/auth/password/request", (route) => {
    state.instructionWrites++;
    return route.fulfill({
      status: 202,
      json: {
        ok: true,
        message: "Если аккаунт доступен, мы отправим письмо с инструкцией.",
      },
    });
  });
  await page.route("**/api/auth/login", (route) => {
    const input = route.request().postDataJSON();
    state.logins.push(input);
    const accepted = !state.blocked && input.password === state.password;
    if (accepted) state.user = { ...person };
    return route.fulfill({
      status: accepted ? 200 : 401,
      json: accepted
        ? { user: person }
        : { error: "Неверный email или пароль" },
    });
  });
  await page.route("https://handoff.example.test/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect width="200" height="120" fill="beige"/></svg>',
    }),
  );
  return state;
}
async function register(page: Page) {
  await gotoWithSession(page, "/login");
  await page
    .getByRole("button", { name: "Нет аккаунта? Зарегистрироваться" })
    .click();
  await page.getByLabel("Имя", { exact: true }).fill("Новое имя");
  await page.getByLabel("Email", { exact: true }).fill(person.email);
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Получить письмо", exact: true })
    .click();
}
async function login(page: Page, password: string) {
  await page.getByLabel("Email", { exact: true }).fill(person.email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
}
async function wake(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
  });
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
  });
}
test("202 keeps registration and explicit resend without claiming delivery or a session", async ({
  page,
}) => {
  const state = await fixture(page, false);
  await register(page);
  await expect(page.getByText(receipt, { exact: true })).toBeVisible();
  await expect(page.getByLabel("Пароль", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Получить письмо", exact: true }),
  ).toBeEnabled();
  await expect(page.getByRole("checkbox")).toBeChecked();
  await page
    .getByRole("button", { name: "Получить письмо", exact: true })
    .click();
  await expect.poll(() => state.registerWrites.length).toBe(2);
  expect(state.registerWrites[1]).toEqual(state.registerWrites[0]);
  expect(state.logins).toEqual([]);
  await expect(page).toHaveURL(/\/login$/);
  await page.screenshot({
    path: test.info().outputPath("registration-accepted-mobile.png"),
  });
});
test("SMTP refusal keeps fields and permits a deliberate registration retry", async ({
  page,
}) => {
  const state = await fixture(page, false);
  state.registerStatus = 503;
  await register(page);
  await expect(
    page.getByText("Сервис временно недоступен. Попробуйте ещё раз."),
  ).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
    person.email,
  );
  await expect(page.getByLabel("Имя", { exact: true })).toHaveValue(
    "Новое имя",
  );
  await expect(page.getByLabel("Пароль", { exact: true })).toHaveCount(0);
  state.registerStatus = 202;
  await page
    .getByRole("button", { name: "Получить письмо", exact: true })
    .click();
  await expect(page.getByText(receipt, { exact: true })).toBeVisible();
  expect(state.logins).toEqual([]);
});
test("accepted password instructions stay separate from login and leave the old password usable", async ({
  page,
}) => {
  const state = await fixture(page, false);
  await gotoWithSession(page, "/login");
  await page
    .getByRole("button", { name: "Забыли пароль или ещё не установили его?" })
    .click();
  await page.getByLabel("Email", { exact: true }).fill(person.email);
  await page
    .getByRole("button", { name: "Отправить инструкцию", exact: true })
    .click();
  await expect(page.getByLabel("Пароль", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Отправить инструкцию", exact: true }),
  ).toBeEnabled();
  expect(state.logins).toEqual([]);
  await page
    .getByRole("button", { name: "Вернуться ко входу", exact: true })
    .click();
  await login(page, "initial-password");
  await expect(page).toHaveURL(/\/profile$/);
});
test("the frontend password page reports completion and still requires a separate login", async ({
  page,
}) => {
  const state = await fixture(page, false);
  let completions = 0;
  await page.route("**/api/auth/password/complete", (route) => {
    completions++;
    state.password = route.request().postDataJSON().password;
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto("/password#token=" + "a".repeat(43));
  await expect(page).toHaveURL(/\/password$/);
  await page.getByLabel("Новый пароль").fill("installed-password");
  await page
    .getByRole("button", { name: "Сохранить пароль", exact: true })
    .click();
  await expect(
    page.getByText("Теперь вы можете войти в аккаунт с новым паролем.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(completions).toBe(1);
  expect(state.user).toBeNull();
  expect(state.logins).toEqual([]);
  await page.getByRole("link", { name: "Войти", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Войти", exact: true }),
  ).toBeEnabled();
  await login(page, "installed-password");
  await expect(page).toHaveURL(/\/profile$/);
});
for (const reason of ["password reset", "blocking"] as const) {
  test(`${reason} closes the old session and a new login preserves paid expiry`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state.paid = true;
    await gotoWithSession(page, "/profile");
    await expect(page.getByText(/1 ноября 2040/)).toBeVisible();
    // Synthetic server revocation; this checks client behavior, not SQL or password hashing.
    state.user = null;
    if (reason === "blocking") state.blocked = true;
    else state.password = "new-password";
    await wake(page);
    await expect(page.getByText(/1 ноября 2040/)).toHaveCount(0);
    await page.getByRole("button", { name: "Войти →", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await login(page, "initial-password");
    await expect(
      page.getByText("Неверный email или пароль", { exact: true }),
    ).toBeVisible();
    if (reason === "blocking") {
      state.blocked = false;
      await wake(page);
      await expect(page).toHaveURL(/\/login$/);
      expect(state.user).toBeNull();
    }
    await login(page, state.password);
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByText(/1 ноября 2040/)).toBeVisible();
  });
}
for (const outcome of ["missing", "undefined", 403, 404] as const) {
  test(`fresh post result ${outcome} removes old content, photo viewer and media`, async ({
    page,
  }) => {
    const state = await fixture(page);
    await gotoWithSession(page, "/post/1");
    await expect(page.getByText("HANDOFF_POST", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "Открыть видео", exact: true })
      .click();
    await expect(page.locator("video")).toHaveCount(1);
    await page
      .getByRole("group", { name: "Фотографии поста", exact: true })
      .getByRole("button", { name: "Открыть фото", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Закрыть фотографии" }),
    ).toBeVisible();
    state.postOutcome = outcome;
    const reads = state.postReads;
    await wake(page);
    await expect.poll(() => state.postReads).toBeGreaterThan(reads);
    await expect(page.getByText("HANDOFF_POST", { exact: true })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: "Закрыть фотографии" }),
    ).toHaveCount(0);
    await expect(page.locator("video")).toHaveCount(0);
    await expect(
      page.getByText(
        outcome === 403 ? "Нет доступа к этому действию." : "Пост не найден",
        { exact: true },
      ),
    ).toBeVisible();
  });
}
test("temporary post failure preserves confirmed content and does not manufacture absence", async ({
  page,
}) => {
  const state = await fixture(page);
  await gotoWithSession(page, "/post/1");
  await expect(page.getByText("HANDOFF_POST", { exact: true })).toBeVisible();
  state.postOutcome = 503;
  const reads = state.postReads;
  await wake(page);
  await expect.poll(() => state.postReads).toBeGreaterThanOrEqual(reads + 2);
  await expect(
    page.getByText("Не удалось обновить публикацию", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("HANDOFF_POST", { exact: true })).toBeVisible();
  await expect(page.getByText("Пост не найден")).toHaveCount(0);
});
test("guest public discussion offers login without calling authenticated comments API", async ({
  page,
}) => {
  const state = await fixture(page, false);
  await gotoWithSession(page, "/post/1");
  await expect(
    page.getByText("Войдите, чтобы оставить комментарий"),
  ).toBeVisible();
  expect(state.commentsReads).toBe(0);
});
for (const target of ["feed", "both"] as const) {
  test(`an unpaid signed-in person reads public ${target} discussion without a paid gate`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state.postTarget = target;
    await gotoWithSession(page, "/post/1");
    await expect(
      page.getByText("HANDOFF_COMMENT", { exact: true }),
    ).toBeVisible();
    expect(state.paid).toBe(false);
    expect(state.commentsReads).toBeGreaterThan(0);
    await page
      .getByPlaceholder("Написать комментарий...")
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: test.info().outputPath("public-discussion-mobile.png"),
    });
  });
}

for (const status of [403, 404]) {
  test(`comment refetch ${status} removes old photos, text and editing form`, async ({
    page,
  }) => {
    const state = await fixture(page);
    await gotoWithSession(page, "/post/1");
    await expect(
      page.getByText("HANDOFF_COMMENT", { exact: true }),
    ).toBeVisible();
    const draft = page.getByPlaceholder("Написать комментарий...");
    await draft.fill("PRIVATE_COMMENT_DRAFT");
    state.commentsStatus = status;
    // A successful reaction invalidates the comments and obtains the authoritative refusal.
    await page
      .getByRole("button", { name: "Поставить лайк комментарию", exact: true })
      .click();
    await expect(
      page.getByText("HANDOFF_COMMENT", { exact: true }),
    ).toHaveCount(0);
    await expect(draft).toHaveCount(0);
    await expect(
      page.locator('img[src="https://handoff.example.test/comment.png"]'),
    ).toHaveCount(0);
    state.commentsStatus = 0;
    if (status === 404) await page.reload();
    else
      await page
        .getByRole("button", { name: "Повторить", exact: true })
        .click();
    await expect(
      page.getByText("HANDOFF_COMMENT", { exact: true }),
    ).toBeVisible();
    await expect(draft).toHaveValue("");
  });
}
test("returning after an unknown save keeps recovery available before allowing another toggle", async ({
  page,
}) => {
  const state = await fixture(page);
  state.likeStatus = 500;
  await gotoWithSession(page, "/feed");
  await page.getByLabel("Открыть публикацию", { exact: true }).press("Enter");
  await expect(page).toHaveURL(/\/post\/1$/);
  await page
    .getByRole("button", { name: "Сохранить пост", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Сохранить пост", exact: true }),
  ).toBeDisabled();
  await expect.poll(() => state.toggleWrites.length).toBe(1);
  await page
    .getByRole("button", { name: "Вернуться назад", exact: true })
    .click();
  const gate = deferred();
  state.interactionsGate = gate.promise;
  const reads = state.interactionReads;
  await expect(page).toHaveURL(/\/feed$/);
  await page.getByLabel("Открыть публикацию", { exact: true }).press("Enter");
  await expect(page).toHaveURL(/\/post\/1$/);
  await expect(
    page.getByRole("button", { name: "Сохранить пост", exact: true }),
  ).toBeDisabled();
  expect(state.toggleWrites).toHaveLength(1);
  // Changing screens must not discard an uncertain write. Reconcile it through
  // the explicit recovery action, rather than expecting navigation to bypass
  // the shared interaction cache's freshness window.
  const retry = page.getByRole("button", {
    name: "Обновить отметки",
    exact: true,
  });
  await expect(retry).toBeVisible();
  try {
    await retry.click();
    await expect.poll(() => state.interactionReads).toBeGreaterThan(reads);
    await expect(
      page.getByRole("button", { name: "Сохранить пост", exact: true }),
    ).toBeDisabled();
    expect(state.toggleWrites).toHaveLength(1);
  } finally {
    state.interactionsGate = undefined;
    gate.resolve();
  }
  await expect(
    page.getByRole("button", { name: "Сохранить пост", exact: true }),
  ).toBeEnabled();
  expect(state.toggleWrites).toHaveLength(1);
});
