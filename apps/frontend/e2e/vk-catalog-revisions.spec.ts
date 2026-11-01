import { expect, test, type Page } from "@playwright/test";
import { editorApi, failure, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";
test.skip(
  process.env.VK_CATALOG_UI_ENABLED !== "true",
  "Requires an isolated catalog build and synthetic API.",
);
const embed = "https://vkvideo.ru/video_ext.php?oid=-1&id=2&hash=abcdefgh";
const initial = {
  id: 18,
  title: "Original title",
  embedUrl: embed as string | null,
  access: "club" as "club" | "public",
  published: false,
  thumbnailUrl: "/assets/responsive/old.webp" as string | null,
  editRevision: 0,
};
const title = (page: Page) =>
  page.getByRole("textbox", { name: "Название видео VK", exact: true });
const save = (page: Page) =>
  page.getByRole("button", { name: "Сохранить видео", exact: true });
const check = (page: Page) =>
  page.getByRole("button", {
    name: "Проверить актуальную версию",
    exact: true,
  });
const newState = () => ({
  current: { ...initial },
  writes: [] as Record<string, unknown>[],
  lose: false,
  writeStatus: 0,
  readStatus: 0,
  bad: false,
  reads: 0,
  gate: null as Promise<void> | null,
});
async function fixtures(
  page: Page,
  state: ReturnType<typeof newState>,
  id = 101,
) {
  const actor = { id, role: "admin" };
  const providers: string[] = [];
  page.on("request", (request) => {
    if (
      /https:\/\/(vkvideo\.ru|vk\.com|s3\.twcstorage\.ru)/.test(request.url())
    )
      providers.push(request.url());
  });
  await editorApi(page, async (name, input, route) => {
    if (name === "admin.vkVideoDetail") {
      state.reads++;
      const detail = { ...state.current };
      if (state.gate) await state.gate;
      return state.readStatus
        ? failure(state.readStatus)
        : ok(state.bad ? { ...detail, editRevision: -1 } : detail);
    }
    if (name === "admin.upsertVkVideo") {
      state.writes.push({ ...input, actor: id });
      const saved = await page.evaluate(
        (owner) =>
          JSON.parse(
            sessionStorage.getItem(`darcy:user:${owner}:vk-editor:v1`)!,
          ),
        id,
      );
      expect(saved.state).toBe("uncertain");
      expect(saved.base.editRevision).toBe(input.expectedRevision);
      if (state.writeStatus) return failure(state.writeStatus);
      if (input.expectedRevision !== state.current.editRevision)
        return failure(409);
      state.current = {
        ...state.current,
        ...input,
        editRevision: state.current.editRevision + 1,
      } as typeof initial;
      if (state.lose) await route.abort("failed");
      return ok({ id: 18 });
    }
  });
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: {
          ...actor,
          openId: `admin-${actor.id}`,
          email: "admin@example.test",
          name: "Admin",
          lastSignedIn: "2026-10-30T00:00:00Z",
        },
      },
    }),
  );
  return { actor, providers };
}
async function open(page: Page) {
  await gotoWithSession(page, "/admin");
  await page.getByRole("button", { name: "Видео", exact: true }).click();
  await expect(
    page.getByText("Видео VK в каталоге", { exact: true }),
  ).toBeVisible();
}
async function load(page: Page) {
  await page
    .getByRole("button", { name: "Редактировать по ID", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "ID видео VK", exact: true })
    .fill("18");
  await page
    .getByRole("button", { name: "Загрузить видео", exact: true })
    .click();
  await expect(title(page)).toBeEnabled();
}
async function reconcile(page: Page) {
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Продолжить после сверки", exact: true })
    .click();
  await expect(save(page)).toBeEnabled();
}

test("two administrators preserve the losing draft and explicitly reconcile before another update", async ({
  page,
  context,
}) => {
  const state = newState();
  const first = await fixtures(page, state);
  await open(page);
  await load(page);
  const other = await context.newPage();
  await fixtures(other, state, 102);
  await open(other);
  await load(other);
  await title(page).fill("First administrator");
  await title(other).fill("Second draft");
  await save(page).click();
  await expect(
    page.getByText("Видео сохранено. ID: 18", { exact: true }),
  ).toBeVisible();
  await save(other).click();
  await expect(
    other.getByText("Актуальная версия на сервере: First administrator", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(title(other)).toHaveValue("Second draft");
  await expect(save(other)).toBeDisabled();
  expect(state.current.title).toBe("First administrator");
  expect(state.current.editRevision).toBe(1);
  expect(state.writes.map((row) => row.expectedRevision)).toEqual([0, 0]);
  for (const width of [320, 1440]) {
    await other.setViewportSize({ width, height: 844 });
    await other
      .getByRole("textbox", { name: "Актуальная ссылка VK", exact: true })
      .scrollIntoViewIfNeeded();
    expect(
      await other.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await other.screenshot({
      path: test.info().outputPath(`vk-revision-conflict-${width}.png`),
    });
  }
  await other.reload();
  await other.getByRole("button", { name: "Видео", exact: true }).click();
  await expect(title(other)).toHaveValue("Second draft");
  await expect(save(other)).toBeDisabled();
  expect(state.writes).toHaveLength(2);
  await check(other).click();
  await reconcile(other);
  expect(state.writes).toHaveLength(2);
  await save(other).click();
  await expect(
    other.getByText("Видео сохранено. ID: 18", { exact: true }),
  ).toBeVisible();
  expect(state.writes[2]).toMatchObject({
    expectedRevision: 1,
    title: "Second draft",
  });
  expect(first.providers).toEqual([]);
  await other.close();
});

test("a committed lost ACK survives reload; matching detail is not proof of this write", async ({
  page,
}) => {
  const state = newState();
  state.lose = true;
  await fixtures(page, state);
  await open(page);
  await load(page);
  await title(page).fill("Lost answer draft");
  await save(page).click();
  await expect(check(page)).toBeEnabled();
  await page.reload();
  await page.getByRole("button", { name: "Видео", exact: true }).click();
  await expect(title(page)).toHaveValue("Lost answer draft");
  await expect(
    page.getByRole("button", { name: "Повторить сохранение", exact: true }),
  ).toBeDisabled();
  await check(page).click();
  await expect(
    page.getByText("Актуальная версия на сервере: Lost answer draft", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Видео сохранено. ID: 18", { exact: true }),
  ).toHaveCount(0);
  const saved = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("darcy:user:101:vk-editor:v1")!),
  );
  expect(saved.base.editRevision).toBe(0);
  expect(saved.review.editRevision).toBe(1);
  expect(state.writes).toHaveLength(1);
});

test("412 loads a fresh detail and cannot update the original revision implicitly", async ({
  page,
}) => {
  const state = newState();
  state.writeStatus = 412;
  await fixtures(page, state);
  await open(page);
  await load(page);
  await title(page).fill("Keep this draft");
  state.current.editRevision = 4;
  await save(page).click();
  await expect(
    page.getByText("Актуальная версия на сервере: Original title", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(title(page)).toHaveValue("Keep this draft");
  await expect(save(page)).toBeDisabled();
  state.writeStatus = 0;
  await reconcile(page);
  await save(page).click();
  await expect(
    page.getByText("Видео сохранено. ID: 18", { exact: true }),
  ).toBeVisible();
  expect(state.writes.map((row) => row.expectedRevision)).toEqual([0, 4]);
});

for (const kind of ["bad", "404", "503"] as const) {
  test(`${kind} detail cannot open an editable form or issue a mutation`, async ({
    page,
  }) => {
    const state = newState();
    state.bad = kind === "bad";
    state.readStatus = kind === "bad" ? 0 : Number(kind);
    await fixtures(page, state);
    await open(page);
    await page
      .getByRole("button", { name: "Редактировать по ID", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "ID видео VK", exact: true })
      .fill("18");
    await page
      .getByRole("button", { name: "Загрузить видео", exact: true })
      .click();
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    await expect(title(page)).toBeDisabled();
    await expect(save(page)).toBeDisabled();
    expect(state.writes).toEqual([]);
  });
}

test("nullable embed is accepted but saving requires an explicit valid export link", async ({
  page,
}) => {
  const state = newState();
  state.current.embedUrl = null;
  await fixtures(page, state);
  await open(page);
  await load(page);
  await expect(title(page)).toHaveValue("Original title");
  await expect(save(page)).toBeDisabled();
  await page
    .getByRole("button", { name: "Добавить ссылку VK", exact: true })
    .click();
  await page
    .getByLabel("Экспортируемая ссылка VK", { exact: true })
    .fill(embed);
  await page
    .getByRole("button", { name: "Добавить видео", exact: true })
    .click();
  await save(page).click();
  await expect(
    page.getByText("Видео сохранено. ID: 18", { exact: true }),
  ).toBeVisible();
  expect(state.writes[0].expectedRevision).toBe(0);
});

test("quota failure keeps the typed draft visible and blocks the write", async ({
  page,
}) => {
  const state = newState();
  await fixtures(page, state);
  await open(page);
  await load(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.includes(":vk-editor:")) throw Error("quota");
      return original.call(this, key, value);
    };
  });
  await title(page).fill("Visible unsaved draft");
  await expect(title(page)).toHaveValue("Visible unsaved draft");
  await expect(save(page)).toBeDisabled();
  expect(state.writes).toEqual([]);
});

for (const role of ["admin", "user"] as const) {
  test(`late detail cannot cross an account change to ${role}`, async ({
    page,
  }) => {
    const state = newState();
    const { actor } = await fixtures(page, state);
    await open(page);
    let release!: () => void;
    state.gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page
      .getByRole("button", { name: "Редактировать по ID", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "ID видео VK", exact: true })
      .fill("18");
    await page
      .getByRole("button", { name: "Загрузить видео", exact: true })
      .click();
    await expect.poll(() => state.reads).toBe(1);
    actor.id = 102;
    actor.role = role;
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(
      page.getByRole("textbox", { name: "ID видео VK", exact: true }),
    ).toHaveCount(0);
    release();
    state.gate = null;
    if (role === "admin") {
      await page.getByRole("button", { name: "Видео", exact: true }).click();
      await expect(title(page)).toHaveValue("");
    }
    expect(state.writes).toEqual([]);
  });
}

test("next editing rereads detail and uses the new revision", async ({
  page,
}) => {
  const state = newState();
  await fixtures(page, state);
  await open(page);
  await load(page);
  await title(page).fill("First save");
  await save(page).click();
  await page
    .getByRole("button", {
      name: "Редактировать сохранённое видео",
      exact: true,
    })
    .click();
  await expect(title(page)).toBeEnabled();
  await title(page).fill("Second save");
  await save(page).click();
  await expect(
    page.getByText("Видео сохранено. ID: 18", { exact: true }),
  ).toBeVisible();
  expect(state.writes.map((row) => row.expectedRevision)).toEqual([0, 1]);
  expect(state.reads).toBe(2);
});
