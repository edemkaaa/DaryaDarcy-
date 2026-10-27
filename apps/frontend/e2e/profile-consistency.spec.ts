import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
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
    avatarLostCommitted: false,
    avatarConflict: false,
    avatarStatusFails: false,
    avatarPending: false,
    avatarReceiptOverride: undefined as unknown,
    avatarStatuses: [] as Record<string, unknown>[],
    avatarReceipts: new Map<string, string>(),
    avatarGate: null as ReturnType<typeof barrier> | null,
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
        cancellationStatus: "none",
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
    if (name === "profile.uploadAvatarWithReceipt") {
      state.avatarWrites.push(input);
      const uploadingUser = state.user;
      await state.avatarGate?.promise;
      if (state.avatarConflict) return failure(409);
      if (state.avatarFails) return failure(503);
      const url = "https://images.example.test/confirmed-avatar.jpg";
      state.avatarReceipts.set(input.idempotencyKey as string, url);
      uploadingUser.avatarUrl = url;
      if (state.avatarLostCommitted) return failure(503);
      return ok(
        state.avatarReceiptOverride ?? {
          state: "ready",
          url,
          avatarApplied: true,
          isCurrent: true,
        },
      );
    }
    if (name === "profile.avatarUploadStatus") {
      state.avatarStatuses.push(input);
      if (state.avatarStatusFails) return failure(503);
      const url = state.avatarReceipts.get(input.idempotencyKey as string);
      return ok(
        state.avatarReceiptOverride ??
          (url
            ? {
                state: "ready",
                url,
                avatarApplied: true,
                isCurrent: url === state.user.avatarUrl,
              }
            : { state: state.avatarPending ? "pending" : "missing" }),
      );
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

for (const sourceMiB of [30, 50]) {
  test(`a ${sourceMiB} MiB avatar source is cropped and uploaded within the server limit`, async ({
    page,
  }) => {
    const { state, raster } = await profileApi(page);
    const jpeg = await sharp(raster).jpeg().toBuffer();
    // Valid JPEG with padding tests source bytes independently of pixel count.
    const source = Buffer.concat([
      jpeg,
      Buffer.alloc(sourceMiB * 1024 * 1024 - jpeg.length),
    ]);
    const sourcePath = test.info().outputPath("large-avatar.jpg");
    await writeFile(sourcePath, source);
    await gotoWithSession(page, "/profile");
    const chooser = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: "Выбрать фото профиля", exact: true })
      .click();
    await (await chooser).setFiles(sourcePath);
    await page.getByRole("button", { name: "Готово", exact: true }).click();
    await expect.poll(() => state.avatarWrites.length).toBe(1);
    const uploaded = Buffer.from(
      state.avatarWrites[0].base64 as string,
      "base64",
    );
    expect(uploaded.length).toBeLessThanOrEqual(4 * 1024 * 1024);
    expect(await sharp(uploaded).metadata()).toMatchObject({
      // AvatarCropper preserves a lossless PNG before the server's WebP encode.
      format: "png",
      width: 400,
      height: 400,
    });
    await expect(
      page
        .getByRole("button", { name: "Выбрать фото профиля", exact: true })
        .locator("img"),
    ).toHaveAttribute(
      "src",
      "https://images.example.test/confirmed-avatar.jpg",
    );
    expect(state.writes).toEqual([]);
  });
}

test("an avatar above 50 MiB is rejected before cropping or uploading", async ({
  page,
}) => {
  const { state } = await profileApi(page);
  const sourcePath = test.info().outputPath("oversized-avatar.jpg");
  await writeFile(sourcePath, Buffer.alloc(50 * 1024 * 1024 + 1));
  await gotoWithSession(page, "/profile");
  let message = "";
  page.once("dialog", async (dialog) => {
    message = dialog.message();
    await dialog.accept();
  });
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Выбрать фото профиля", exact: true })
    .click();
  await (await chooser).setFiles(sourcePath);
  await expect.poll(() => message).toBe("Файл больше 50 МБ.");
  await expect(
    page.getByRole("button", { name: "Готово", exact: true }),
  ).toHaveCount(0);
  expect(state.avatarWrites).toEqual([]);
});

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

test("portrait avatar crop contains photo pixels across the full square", async ({
  page,
}) => {
  const { state } = await profileApi(page);
  const portrait = await sharp({
    create: {
      width: 576,
      height: 1280,
      channels: 3,
      background: { r: 16, g: 192, b: 32 },
    },
  })
    .png()
    .toBuffer();
  await gotoWithSession(page, "/profile");
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Выбрать фото профиля", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({ name: "portrait.png", mimeType: "image/png", buffer: portrait });
  await page.getByRole("button", { name: "Готово", exact: true }).click();
  await expect.poll(() => state.avatarWrites.length).toBe(1);

  const uploaded = Buffer.from(String(state.avatarWrites[0].base64), "base64");
  const { data, info } = await sharp(uploaded)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixelAt = (x: number) => {
    const offset = (Math.floor(info.height / 2) * info.width + x) * 3;
    return {
      red: data[offset],
      green: data[offset + 1],
      blue: data[offset + 2],
    };
  };
  for (const x of [20, Math.floor(info.width / 2), info.width - 21]) {
    const pixel = pixelAt(x);
    expect(pixel.green).toBeGreaterThan(120);
    expect(pixel.red).toBeLessThan(80);
    expect(pixel.blue).toBeLessThan(80);
  }
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

test("failed avatar cropping retains the selection and retries without uploading the original", async ({
  page,
}) => {
  const { state, raster } = await profileApi(page);
  await gotoWithSession(page, "/profile");
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Выбрать фото профиля", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({ name: "avatar.png", mimeType: "image/png", buffer: raster });
  await expect(
    page.getByRole("button", { name: "Готово", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toDataURL;
    window.addEventListener(
      "audit-restore-canvas",
      () => {
        HTMLCanvasElement.prototype.toDataURL = original;
      },
      { once: true },
    );
    HTMLCanvasElement.prototype.toDataURL = () => {
      throw new Error("Synthetic crop failure");
    };
  });
  await page.getByRole("button", { name: "Готово", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Не удалось" }),
  ).toBeVisible();
  expect(state.avatarWrites).toHaveLength(0);
  await expect(
    page.getByRole("button", { name: "Готово", exact: true }),
  ).toBeEnabled();
  await page.evaluate(() =>
    window.dispatchEvent(new Event("audit-restore-canvas")),
  );
  await page.getByRole("button", { name: "Готово", exact: true }).click();
  await expect.poll(() => state.avatarWrites.length).toBe(1);
  expect(
    await sharp(
      Buffer.from(state.avatarWrites[0].base64 as string, "base64"),
    ).metadata(),
  ).toMatchObject({ width: 400, height: 400 });
});

for (const outcome of ["cancel", "timeout"] as const) {
  test(`a stalled avatar crop supports ${outcome} without uploading`, async ({
    page,
  }) => {
    const { state, raster } = await profileApi(page);
    await page.clock.install();
    await gotoWithSession(page, "/profile");
    const chooser = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: "Выбрать фото профиля", exact: true })
      .click();
    await (
      await chooser
    ).setFiles({ name: "avatar.png", mimeType: "image/png", buffer: raster });
    await expect(
      page.getByRole("button", { name: "Готово", exact: true }),
    ).toBeVisible();
    await page.evaluate(() => {
      const NativeImage = window.Image;
      window.Image = class extends NativeImage {
        set src(_value: string) {
          /* Simulate an image that never loads. */
        }
      };
    });
    await page.getByRole("button", { name: "Готово", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "...", exact: true }),
    ).toBeDisabled();
    if (outcome === "cancel") {
      await page.getByRole("button", { name: "Отмена", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Выбрать фото профиля", exact: true }),
      ).toBeVisible();
    }
    await page.clock.fastForward(16_000);
    if (outcome === "timeout") {
      await expect(
        page.getByRole("alert").filter({ hasText: "Не удалось" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Готово", exact: true }),
      ).toBeEnabled();
    }
    expect(state.avatarWrites).toHaveLength(0);
  });
}

test("avatar crop error keeps retry and cancel reachable in a short viewport", async ({
  page,
}) => {
  const { state, raster } = await profileApi(page);
  await gotoWithSession(page, "/profile");
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Выбрать фото профиля", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({ name: "avatar.png", mimeType: "image/png", buffer: raster });
  await expect(
    page.getByRole("button", { name: "Готово", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    HTMLCanvasElement.prototype.toDataURL = () => {
      throw new Error("Synthetic crop failure");
    };
  });
  await page.getByRole("button", { name: "Готово", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Не удалось обрезать фото" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 320, height: 400 });
  for (const name of ["Готово", "Отмена"]) {
    const action = page.getByRole("button", { name, exact: true });
    await action.scrollIntoViewIfNeeded();
    expect(
      await action.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const target = document.elementFromPoint(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
        );
        return Boolean(target && element.contains(target));
      }),
    ).toBe(true);
  }
  expect(state.avatarWrites).toHaveLength(0);
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Выбрать фото профиля", exact: true }),
  ).toBeVisible();
});

async function chooseAvatar(page: Page, raster: Buffer) {
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Выбрать фото профиля", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({ name: "photo.png", mimeType: "image/png", buffer: raster });
  await page.getByRole("button", { name: "Готово", exact: true }).click();
}
const checkAvatar = (page: Page) =>
  page.getByRole("button", { name: "Проверить фото в профиле", exact: true });
const retryAvatar = (page: Page) =>
  page.getByRole("button", { name: "Повторить загрузку фото", exact: true });
const avatarJournal = (page: Page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem("darcy:user:101:avatar-upload");
    return raw ? JSON.parse(raw) : null;
  });

test.describe("avatar receipt recovery", () => {
  test("a lost committed response survives reload and is checked without uploading again", async ({
    page,
  }) => {
    const { state, raster } = await profileApi(page);
    state.avatarLostCommitted = true;
    await gotoWithSession(page, "/profile");
    await chooseAvatar(page, raster);
    await expect(checkAvatar(page)).toBeVisible();
    const intent = await avatarJournal(page);
    expect(intent).toMatchObject({ ownerId: 101, ...state.avatarWrites[0] });
    await page.reload();
    await expect(
      page.getByText("Черновик фото", { exact: true }),
    ).toBeVisible();
    await checkAvatar(page).click();
    await expect(page.getByText("Черновик фото", { exact: true })).toHaveCount(
      0,
    );
    expect(state.avatarWrites).toHaveLength(1);
    expect(state.avatarStatuses).toEqual([
      { idempotencyKey: intent.idempotencyKey },
    ]);
    expect(await avatarJournal(page)).toBeNull();
    expect(state.writes).toEqual([]);
  });

  for (const pending of [false, true]) {
    test(`${pending ? "pending" : "missing"} receipt retries exactly the saved bytes and key after reload`, async ({
      page,
    }) => {
      const { state, raster } = await profileApi(page);
      state.avatarFails = true;
      state.avatarPending = pending;
      await gotoWithSession(page, "/profile");
      await chooseAvatar(page, raster);
      await expect(checkAvatar(page)).toBeVisible();
      await page.reload();
      await checkAvatar(page).click();
      await expect(retryAvatar(page)).toBeVisible();
      state.avatarFails = false;
      await retryAvatar(page).click();
      await expect(
        page.getByText("Черновик фото", { exact: true }),
      ).toHaveCount(0);
      expect(state.avatarWrites).toHaveLength(2);
      expect(state.avatarWrites[1]).toEqual(state.avatarWrites[0]);
      expect(state.avatarStatuses).toHaveLength(2);
      expect(await avatarJournal(page)).toBeNull();
    });
  }

  test("a ready receipt discovered on retry avoids a second upload", async ({
    page,
  }) => {
    const { state, raster } = await profileApi(page);
    state.avatarFails = true;
    await gotoWithSession(page, "/profile");
    await chooseAvatar(page, raster);
    await checkAvatar(page).click();
    await expect(retryAvatar(page)).toBeVisible();
    const intent = await avatarJournal(page);
    state.user.avatarUrl =
      "https://images.example.test/completed-elsewhere.jpg";
    state.avatarReceipts.set(intent.idempotencyKey, state.user.avatarUrl);
    await retryAvatar(page).click();
    await expect(page.getByText("Черновик фото", { exact: true })).toHaveCount(
      0,
    );
    expect(state.avatarWrites).toHaveLength(1);
  });

  test("an old ready receipt reads the current profile without reapplying the old avatar", async ({
    page,
  }) => {
    const { state, raster } = await profileApi(page);
    state.avatarLostCommitted = true;
    await gotoWithSession(page, "/profile");
    await chooseAvatar(page, raster);
    await expect(checkAvatar(page)).toBeVisible();
    state.user.avatarUrl = "https://images.example.test/newer-avatar.jpg";
    await checkAvatar(page).click();
    await expect(page.getByText("Черновик фото", { exact: true })).toHaveCount(
      0,
    );
    await expect(
      page
        .getByRole("button", { name: "Выбрать фото профиля", exact: true })
        .locator("img"),
    ).toHaveAttribute("src", state.user.avatarUrl);
    expect(state.writes).toEqual([]);
    expect(state.avatarWrites).toHaveLength(1);
  });

  test("status 503 preserves the intent and prevents a blind retry", async ({
    page,
  }) => {
    const { state, raster } = await profileApi(page);
    state.avatarFails = true;
    state.avatarStatusFails = true;
    await gotoWithSession(page, "/profile");
    await chooseAvatar(page, raster);
    await expect(checkAvatar(page)).toBeVisible();
    const intent = await avatarJournal(page);
    await checkAvatar(page).click();
    await expect.poll(() => state.avatarStatuses.length).toBe(1);
    await expect(checkAvatar(page)).toBeEnabled();
    await expect(retryAvatar(page)).toHaveCount(0);
    expect(await avatarJournal(page)).toEqual(intent);
    expect(state.avatarWrites).toHaveLength(1);
  });

  test("a conflict stops retries and allows only an explicit new photo", async ({
    page,
  }) => {
    const { state, raster } = await profileApi(page);
    state.avatarConflict = true;
    await gotoWithSession(page, "/profile");
    await chooseAvatar(page, raster);
    await expect(
      page.getByRole("alert").filter({ hasText: "Выберите фото заново" }),
    ).toBeVisible();
    await expect(retryAvatar(page)).toHaveCount(0);
    expect(await avatarJournal(page)).toBeNull();
    expect(state.avatarWrites).toHaveLength(1);
    state.avatarConflict = false;
    await chooseAvatar(page, raster);
    await expect(page.getByText("Черновик фото", { exact: true })).toHaveCount(
      0,
    );
    expect(state.avatarWrites).toHaveLength(2);
    expect(state.avatarWrites[1].idempotencyKey).not.toBe(
      state.avatarWrites[0].idempotencyKey,
    );
  });

  test("an invalid ready receipt keeps recovery available", async ({
    page,
  }) => {
    const { state, raster } = await profileApi(page);
    state.avatarReceiptOverride = {
      state: "ready",
      url: "javascript:alert(1)",
      avatarApplied: true,
      isCurrent: null,
    };
    await gotoWithSession(page, "/profile");
    await chooseAvatar(page, raster);
    await expect(checkAvatar(page)).toBeVisible();
    expect(await avatarJournal(page)).not.toBeNull();
    await expect(retryAvatar(page)).toHaveCount(0);
    expect(state.avatarWrites).toHaveLength(1);
  });

  test("storage failure blocks upload until the exact draft can be saved", async ({
    page,
  }) => {
    const { state, raster } = await profileApi(page);
    await gotoWithSession(page, "/profile");
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key.endsWith(":avatar-upload"))
          throw new DOMException("full", "QuotaExceededError");
        return original.call(this, key, value);
      };
      Object.assign(window, {
        restoreAvatarStorage: () => {
          Storage.prototype.setItem = original;
        },
      });
    });
    await chooseAvatar(page, raster);
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Проверьте доступность хранилища" }),
    ).toBeVisible();
    expect(state.avatarWrites).toEqual([]);
    await page.evaluate(() =>
      (
        window as unknown as { restoreAvatarStorage: () => void }
      ).restoreAvatarStorage(),
    );
    await checkAvatar(page).click();
    await retryAvatar(page).click();
    await expect(page.getByText("Черновик фото", { exact: true })).toHaveCount(
      0,
    );
    expect(state.avatarWrites).toHaveLength(1);
  });

  test("another account never sees or sends the previous owner's pending photo", async ({
    page,
  }) => {
    const { state, raster } = await profileApi(page);
    state.avatarFails = true;
    await gotoWithSession(page, "/profile");
    await chooseAvatar(page, raster);
    await expect(checkAvatar(page)).toBeVisible();
    const intent = await avatarJournal(page);
    state.user.id = 202;
    state.user.openId = "another-person";
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Выбрать фото профиля", exact: true }),
    ).toBeEnabled();
    await expect(page.getByText("Черновик фото", { exact: true })).toHaveCount(
      0,
    );
    expect(state.avatarWrites).toHaveLength(1);
    expect(state.avatarStatuses).toEqual([]);
    expect(await avatarJournal(page)).toEqual(intent);
  });
});

test("a delayed avatar response cannot update the next account", async ({
  page,
}) => {
  const { state, raster } = await profileApi(page);
  state.avatarGate = barrier();
  try {
    await gotoWithSession(page, "/profile");
    await chooseAvatar(page, raster);
    await expect.poll(() => state.avatarWrites.length).toBe(1);
    const intent = await avatarJournal(page);
    state.user = {
      ...state.user,
      id: 202,
      openId: "second-person",
      name: "Second person",
      avatarUrl: "https://images.example.test/second-person.jpg",
    };
    await page.evaluate(() =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "darcy:session-change",
          newValue: "second-account",
        }),
      ),
    );
    await expect(
      page.getByRole("button", { name: "Second person", exact: true }),
    ).toBeVisible();
    state.avatarGate.release();
    await expect(
      page
        .getByRole("button", { name: "Выбрать фото профиля", exact: true })
        .locator("img"),
    ).toHaveAttribute("src", "https://images.example.test/second-person.jpg");
    await expect(page.getByText("Черновик фото", { exact: true })).toHaveCount(
      0,
    );
    expect(state.writes).toEqual([]);
    expect(state.avatarStatuses).toEqual([]);
    expect(await avatarJournal(page)).toEqual(intent);
  } finally {
    state.avatarGate.release();
  }
});
