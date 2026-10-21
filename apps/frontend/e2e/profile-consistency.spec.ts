import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { editorApi, ok, failure } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

function barrier() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
async function profileApi(page: Page) {
  const state = {
    user: {
      id: 101,
      openId: "profile-consistency",
      name: "Server name" as string | null,
      gender: "female" as "female" | "male" | null,
      avatarUrl: null as string | null,
      email: "profile@example.test",
      role: "user",
      lastSignedIn: "2026-10-21T00:00:00Z",
    },
    mode: "ok" as "ok" | "reject" | "lost-committed" | "lost-uncommitted",
    avatarFails: false,
    writes: [] as Record<string, unknown>[],
    avatarWrites: [] as Record<string, unknown>[],
    holdNextRead: false,
    readHeld: false,
    readGate: barrier(),
    writeGate: null as ReturnType<typeof barrier> | null,
  };
  const origin = new URL(test.info().project.use.baseURL!).origin;
  await page.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin
      ? route.continue()
      : route.abort(),
  );
  await editorApi(page, async (name, input) => {
    if (name === "club.subscription")
      return ok({
        hasClubAccess: true,
        subscribed: true,
        expiresAt: "2040-11-01T10:00:00Z",
        cancelAtPeriodEnd: false,
        isOwner: false,
        monthlyPrice: "790",
      });
    if (name === "profile.update") {
      state.writes.push(input);
      if (state.mode === "reject") return failure(400);
      if (state.mode !== "lost-uncommitted") Object.assign(state.user, input);
      await state.writeGate?.promise;
      return state.mode.startsWith("lost-")
        ? failure(503)
        : ok({ success: true });
    }
    if (name === "profile.uploadAvatar") {
      state.avatarWrites.push(input);
      if (state.avatarFails) return failure(503);
      state.user.avatarUrl = "https://images.example.test/confirmed-avatar.jpg";
      return ok({ url: state.user.avatarUrl });
    }
    if (name === "feed.savedPosts") return ok([]);
  });
  await page.route("**/api/auth/me", async (route) => {
    const user = { ...state.user };
    if (state.holdNextRead) {
      state.holdNextRead = false;
      state.readHeld = true;
      await state.readGate.promise;
    }
    await route.fulfill({ json: { user } }).catch(() => {});
  });
  await page.addInitScript(() => {
    localStorage.removeItem("darcy:user:101:@darcy_club_profile_completed");
  });
  const raster = await sharp({
    create: { width: 400, height: 400, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  await page.route("**/_next/image?**", (route) =>
    route.fulfill({ contentType: "image/png", body: raster }),
  );
  return { state, raster };
}

for (const width of [390, 1280]) {
  test(`opening Club and profile never uploads stale local name, gender or avatar (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const { state } = await profileApi(page);
    await page.addInitScript(() => {
      localStorage.setItem(
        "darcy:user:101:@darcy_club_profile_name",
        "Stale browser name",
      );
      localStorage.setItem("darcy:user:101:@darcy_club_profile_gender", "male");
      localStorage.setItem(
        "darcy:user:101:@darcy_club_profile_avatar",
        "https://images.example.test/stale.jpg",
      );
    });
    await gotoWithSession(page, "/club");
    await expect(page.locator("main")).toContainText("Server name");
    await expect(
      page.getByRole("dialog", { name: "Настройка профиля клуба" }),
    ).toHaveCount(0);
    await page
      .getByRole("link", { name: "Открыть профиль", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Server name", exact: true }),
    ).toBeVisible();
    await page.waitForTimeout(200);
    expect(state.writes).toEqual([]);
    expect(state.avatarWrites).toEqual([]);
    expect(state.user).toMatchObject({
      name: "Server name",
      gender: "female",
      avatarUrl: null,
    });
  });
}

test("name changes require an explicit save and supersede a delayed pre-write session read", async ({
  page,
}) => {
  const { state } = await profileApi(page);
  try {
    await gotoWithSession(page, "/profile");
    state.holdNextRead = true;
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect.poll(() => state.readHeld).toBe(true);
    await page
      .getByRole("button", { name: "Server name", exact: true })
      .click();
    const field = page.getByRole("textbox", {
      name: "Имя профиля",
      exact: true,
    });
    await field.fill("Explicit saved name");
    await field.press("Tab");
    expect(state.writes).toEqual([]);
    await page
      .getByRole("button", { name: "Сохранить имя", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Explicit saved name", exact: true }),
    ).toBeVisible();
    state.readGate.release();
    await page.waitForTimeout(200);
    await expect(
      page.getByRole("button", { name: "Explicit saved name", exact: true }),
    ).toBeVisible();
    expect(state.writes).toEqual([{ name: "Explicit saved name" }]);
  } finally {
    state.readGate.release();
  }
});

for (const committed of [false, true]) {
  test(`unknown club setup result is checked before retry, committed=${committed}`, async ({
    page,
  }) => {
    const { state } = await profileApi(page);
    state.user.name = null;
    state.user.gender = null;
    state.mode = committed ? "lost-committed" : "lost-uncommitted";
    await gotoWithSession(page, "/club");
    const setup = page.getByRole("dialog", { name: "Настройка профиля клуба" });
    const field = setup.getByPlaceholder("Как тебя зовут?");
    await expect(field).toBeEnabled();
    await field.fill("Confirmed setup name");
    await setup.getByRole("button", { name: "Женский", exact: true }).click();
    await setup
      .getByRole("button", { name: "Продолжить", exact: true })
      .click();
    await expect(setup.getByRole("alert")).toContainText(
      "Результат сохранения не подтверждён",
    );
    await expect(field).toBeDisabled();
    expect(state.writes).toHaveLength(1);
    expect(
      await page.evaluate(() =>
        localStorage.getItem("darcy:user:101:@darcy_club_profile_completed"),
      ),
    ).toBeNull();
    if (!committed)
      await page.screenshot({
        path: test.info().outputPath("setup-unknown-result.png"),
        fullPage: true,
      });
    if (!committed) {
      await page.reload();
      await expect(field).toHaveValue("Confirmed setup name");
      await expect(field).toBeDisabled();
      expect(state.writes).toHaveLength(1);
    }
    await setup
      .getByRole("button", { name: "Проверить сохранение анкеты", exact: true })
      .click();
    if (!committed) {
      await expect(field).toBeEnabled();
      await expect(field).toHaveValue("Confirmed setup name");
      state.mode = "ok";
      await setup
        .getByRole("button", { name: "Продолжить", exact: true })
        .click();
    }
    await expect(setup).toHaveCount(0);
    await expect(page.locator("main")).toContainText("Confirmed setup name");
    expect(state.writes).toHaveLength(committed ? 1 : 2);
    expect(state.user).toMatchObject({
      name: "Confirmed setup name",
      gender: "female",
    });
  });
}

test("a rejected setup keeps an editable draft across reload and never trusts the old completed flag", async ({
  page,
}) => {
  const { state } = await profileApi(page);
  state.user.name = null;
  state.user.gender = null;
  state.mode = "reject";
  await page.addInitScript(() =>
    localStorage.setItem(
      "darcy:user:101:@darcy_club_profile_completed",
      "true",
    ),
  );
  await gotoWithSession(page, "/club");
  const setup = page.getByRole("dialog", { name: "Настройка профиля клуба" });
  const field = setup.getByPlaceholder("Как тебя зовут?");
  await expect(field).toBeEnabled();
  await field.fill("Draft after rejection");
  await setup.getByRole("button", { name: "Мужской", exact: true }).click();
  await setup.getByRole("button", { name: "Продолжить", exact: true }).click();
  await expect(setup.getByRole("alert")).toBeVisible();
  await expect(field).toBeEnabled();
  await page.reload();
  await expect(field).toHaveValue("Draft after rejection");
  expect(state.writes).toHaveLength(1);
  expect(state.user.name).toBeNull();
});

for (const committed of [false, true]) {
  test(`unknown name write requires a read before another write, committed=${committed}`, async ({
    page,
  }) => {
    const { state } = await profileApi(page);
    state.mode = committed ? "lost-committed" : "lost-uncommitted";
    await gotoWithSession(page, "/profile");
    await page
      .getByRole("button", { name: "Server name", exact: true })
      .click();
    const field = page.getByRole("textbox", {
      name: "Имя профиля",
      exact: true,
    });
    await field.fill("Name recovery draft");
    await page
      .getByRole("button", { name: "Сохранить имя", exact: true })
      .click();
    await expect(field).toBeDisabled();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Результат сохранения не подтверждён" }),
    ).toBeVisible();
    if (!committed) {
      await page.reload();
      await page
        .getByRole("button", { name: "Server name", exact: true })
        .click();
      await expect(field).toHaveValue("Name recovery draft");
      await expect(field).toBeDisabled();
    }
    await page
      .getByRole("button", { name: "Проверить сохранение имени", exact: true })
      .click();
    if (committed) {
      await expect(
        page.getByRole("button", { name: "Name recovery draft", exact: true }),
      ).toBeVisible();
    } else {
      await expect(field).toBeEnabled();
      await expect(field).toHaveValue("Name recovery draft");
      expect(state.user.name).toBe("Server name");
    }
    expect(state.writes).toHaveLength(1);
  });
}

test("failed photo upload retains a labeled draft and never changes name or the confirmed avatar", async ({
  page,
}) => {
  const { state, raster } = await profileApi(page);
  state.user.avatarUrl = "https://images.example.test/old-avatar.jpg";
  state.avatarFails = true;
  await gotoWithSession(page, "/profile");
  const picker = page.getByRole("button", {
    name: "Выбрать фото профиля",
    exact: true,
  });
  const chooser = page.waitForEvent("filechooser");
  await picker.click();
  await (
    await chooser
  ).setFiles({ name: "photo.png", mimeType: "image/png", buffer: raster });
  await page.getByRole("button", { name: "Готово", exact: true }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Загрузка фото не подтверждена" }),
  ).toBeVisible();
  await expect(picker.locator("img")).toHaveAttribute(
    "src",
    "https://images.example.test/old-avatar.jpg",
  );
  await expect(page.getByText("Черновик фото", { exact: true })).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("photo-upload-error.png"),
    fullPage: true,
  });
  expect(state.writes).toEqual([]);
  await page
    .getByRole("button", { name: "Проверить фото в профиле", exact: true })
    .click();
  state.avatarFails = false;
  await page
    .getByRole("button", { name: "Повторить загрузку фото", exact: true })
    .click();
  await expect(picker.locator("img")).toHaveAttribute(
    "src",
    "https://images.example.test/confirmed-avatar.jpg",
  );
  await expect(page.getByText("Черновик фото", { exact: true })).toHaveCount(0);
  expect(state.writes).toEqual([]);
  expect(state.avatarWrites).toHaveLength(2);
  expect(state.user.name).toBe("Server name");
});

test("a late name ACK cannot replace a different account", async ({ page }) => {
  const { state } = await profileApi(page);
  const gate = barrier();
  try {
    state.writeGate = gate;
    await gotoWithSession(page, "/profile");
    await page
      .getByRole("button", { name: "Server name", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Имя профиля", exact: true })
      .fill("First owner edit");
    await page
      .getByRole("button", { name: "Сохранить имя", exact: true })
      .click();
    await expect.poll(() => state.writes.length).toBe(1);
    state.user = {
      ...state.user,
      id: 202,
      openId: "profile-second",
      name: "Second owner",
    };
    await page.evaluate(() =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "darcy:session-change",
          newValue: "second-owner",
        }),
      ),
    );
    await expect(
      page.getByRole("button", { name: "Second owner", exact: true }),
    ).toBeVisible();
    gate.release();
    await page.waitForTimeout(200);
    await expect(
      page.getByRole("button", { name: "Second owner", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        localStorage.getItem("darcy:user:202:@darcy_profile_name_draft"),
      ),
    ).toBeNull();
  } finally {
    gate.release();
  }
});
