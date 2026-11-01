import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { editorApi, ok, failure } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

// Large padded JPEGs belong only to this test, never retain them as artifacts.
test.afterEach(async ({}, info) => {
  for (const filename of ["large-avatar.jpg", "oversized-avatar.jpg"])
    await rm(join(info.outputDir, filename), { force: true });
});

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
      profileRevision: 0,
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
      if (input.expectedRevision !== state.user.profileRevision)
        return failure(409);
      if (state.mode !== "lost-uncommitted") {
        const { expectedRevision, ...patch } = input;
        Object.assign(state.user, patch);
        state.user.profileRevision = Number(expectedRevision) + 1;
      }
      await state.writeGate?.promise;
      return state.mode.startsWith("lost-")
        ? failure(503)
        : ok({ success: true, profileRevision: state.user.profileRevision });
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

for (const ime of ["composition", "keyCode 229"] as const) {
  test(`profile name waits for IME ${ime} to finish before saving`, async ({
    page,
  }) => {
    const { state } = await profileApi(page);
    await gotoWithSession(page, "/profile");
    await page
      .getByRole("button", { name: "Server name", exact: true })
      .click();
    const field = page.getByRole("textbox", { name: "Имя профиля" });
    await field.fill("途中");
    await field.dispatchEvent("compositionstart", { data: "途中" });
    await field.dispatchEvent("keydown", {
      key: "Enter",
      code: "Enter",
      keyCode: ime === "keyCode 229" ? 229 : 13,
      isComposing: ime === "composition",
      bubbles: true,
      cancelable: true,
    });
    await expect(field).toBeEditable();
    expect(state.writes).toEqual([]);

    await field.dispatchEvent("compositionend", { data: "完成" });
    await field.fill("完成");
    await field.press("Enter");
    await expect
      .poll(() => state.writes)
      .toEqual([{ name: "完成", expectedRevision: 0 }]);
    await expect(
      page.getByRole("button", { name: "完成", exact: true }),
    ).toBeVisible();
  });
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
    expect(state.writes).toEqual([
      { expectedRevision: 0, name: "Explicit saved name" },
    ]);
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
        .getByRole("button", { name: "Использовать мой черновик", exact: true })
        .click();
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
      .locator("[data-background-notice] [role=status]")
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
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
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
  page.getByRole("button", { name: "Повторить", exact: true });
const retryAvatar = (page: Page) =>
  page.getByRole("button", { name: "Повторить загрузку фото", exact: true });
const avatarJournal = (page: Page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem("darcy:user:101:avatar-upload");
    return raw ? JSON.parse(raw) : null;
  });

test.describe("damaged avatar journal", () => {
  const key = "darcy:user:101:avatar-upload";
  const reset = (page: Page) =>
    page.getByRole("button", {
      name: "Сбросить черновик",
      exact: true,
    });
  const choose = (page: Page) =>
    page.getByRole("button", { name: "Выбрать фото профиля", exact: true });
  async function damaged(page: Page, raw = "{damaged") {
    const fixture = await profileApi(page);
    await gotoWithSession(page, "/profile");
    await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
      key,
      raw,
    });
    await page.reload();
    await expect(reset(page)).toBeVisible();
    await expect(choose(page)).toBeDisabled();
    return fixture;
  }
  test("downloads the exact copy, respects cancel and enables an explicit new upload after checking the profile", async ({
    page,
  }) => {
    const { state, raster } = await damaged(page);
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: "Скачать копию",
        exact: true,
      })
      .click();
    const file = await download;
    const stream = await file.createReadStream();
    let text = "";
    for await (const chunk of stream!) text += chunk.toString();
    expect(text).toBe("{damaged");
    page.once("dialog", (dialog) => dialog.dismiss());
    await reset(page).click();
    expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
      "{damaged",
    );
    state.user.avatarUrl = "https://images.example.test/current-avatar.jpg";
    page.once("dialog", (dialog) => dialog.accept());
    await reset(page).click();
    await expect(choose(page)).toBeEnabled();
    await expect(choose(page).locator("img")).toHaveAttribute(
      "src",
      state.user.avatarUrl,
    );
    expect(await avatarJournal(page)).toBeNull();
    expect(state.avatarWrites).toEqual([]);
    expect(state.writes).toEqual([]);
    await chooseAvatar(page, raster);
    await expect.poll(() => state.avatarWrites.length).toBe(1);
    await expect(choose(page)).toBeEnabled();
  });
  test("keeps a recoverable receipt key locked while its upload is pending", async ({
    page,
  }) => {
    const raw = JSON.stringify({
      version: 1,
      ownerId: 101,
      idempotencyKey: "avatar-damaged-operation-01",
      base64: "invalid!",
      filename: "avatar.png",
      mimeType: "image/png",
    });
    const { state } = await damaged(page, raw);
    state.avatarPending = true;
    page.on("dialog", (dialog) => dialog.accept());
    await reset(page).click();
    await expect(
      page
        .locator("[data-background-notice] [role=status]")
        .filter({ hasText: "ещё обрабатывается" }),
    ).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
      raw,
    );
    await expect(choose(page)).toBeDisabled();
    state.avatarPending = false;
    await reset(page).click();
    await expect(choose(page)).toBeEnabled();
    expect(state.avatarStatuses).toEqual(
      Array(2).fill({ idempotencyKey: "avatar-damaged-operation-01" }),
    );
    expect(state.avatarWrites).toEqual([]);
  });
  test("checks the damaged replacement's receipt even when an older intent remains in memory", async ({
    page,
  }) => {
    const { state, raster } = await profileApi(page);
    state.avatarFails = true;
    await gotoWithSession(page, "/profile");
    await chooseAvatar(page, raster);
    await checkAvatar(page).click();
    await expect(retryAvatar(page)).toBeVisible();
    const replacement = JSON.stringify({
      version: 1,
      ownerId: 101,
      idempotencyKey: "avatar-new-damaged-operation-01",
      base64: "broken!",
      filename: "avatar.png",
      mimeType: "image/png",
    });
    await page.evaluate(
      ({ key, replacement }) => localStorage.setItem(key, replacement),
      { key, replacement },
    );
    await retryAvatar(page).click();
    await expect(reset(page)).toBeVisible();
    state.avatarPending = true;
    page.once("dialog", (dialog) => dialog.accept());
    await reset(page).click();
    await expect(
      page
        .locator("[data-background-notice] [role=status]")
        .filter({ hasText: "ещё обрабатывается" }),
    ).toBeVisible();
    expect(state.avatarStatuses.at(-1)).toEqual({
      idempotencyKey: "avatar-new-damaged-operation-01",
    });
    expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
      replacement,
    );
    await expect(choose(page)).toBeDisabled();
    expect(state.avatarWrites).toHaveLength(1);
  });
  test("a failed profile check does not remove the damaged record", async ({
    page,
  }) => {
    const { state } = await damaged(page);
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({ status: 503, json: { error: "unavailable" } }),
    );
    page.once("dialog", (dialog) => dialog.accept());
    await reset(page).click();
    await expect(reset(page)).toBeEnabled();
    await expect(choose(page)).toBeDisabled();
    expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
      "{damaged",
    );
    expect(state.avatarWrites).toEqual([]);
  });
  for (const outcome of ["status unavailable", "invalid receipt"] as const) {
    test(`reset preserves the damaged record when ${outcome}`, async ({
      page,
    }) => {
      const raw = JSON.stringify({
        ownerId: 101,
        idempotencyKey: "avatar-reset-status-operation-01",
        base64: "broken!",
      });
      const { state } = await damaged(page, raw);
      state.avatarStatusFails = outcome === "status unavailable";
      if (outcome === "invalid receipt")
        state.avatarReceiptOverride = {
          state: "ready",
          url: "javascript:alert(1)",
          avatarApplied: true,
          isCurrent: true,
        };
      state.holdNextRead = true;
      page.once("dialog", (dialog) => dialog.accept());
      await reset(page).click();
      await expect(
        page.locator("[data-background-notice] [role=status]").filter({
          hasText:
            outcome === "status unavailable"
              ? "Сервис временно недоступен"
              : "Некорректный ответ сервера",
        }),
      ).toBeVisible();
      await expect(reset(page)).toBeEnabled();
      expect(state.avatarStatuses).toEqual([
        { idempotencyKey: "avatar-reset-status-operation-01" },
      ]);
      expect(state.readHeld).toBe(false);
      expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
        raw,
      );
      await expect(choose(page)).toBeDisabled();
      expect(state.avatarWrites).toEqual([]);
      state.holdNextRead = false;
      state.avatarStatusFails = false;
      state.avatarReceiptOverride = undefined;
      page.once("dialog", (dialog) => dialog.accept());
      await reset(page).click();
      await expect(choose(page)).toBeEnabled();
      expect(
        await page.evaluate((key) => localStorage.getItem(key), key),
      ).toBeNull();
    });
  }
  test("does not remove a valid replacement installed during the profile check", async ({
    page,
    context,
  }) => {
    const { state } = await damaged(page);
    const other = await context.newPage();
    await profileApi(other);
    await gotoWithSession(other, "/profile");
    state.holdNextRead = true;
    const replacement = {
      version: 1,
      ownerId: 101,
      idempotencyKey: "avatar-replacement-operation-01",
      base64: "aGVsbG8=",
      filename: "avatar.png",
      mimeType: "image/png",
    };
    try {
      page.once("dialog", (dialog) => dialog.accept());
      await reset(page).click();
      await expect.poll(() => state.readHeld).toBe(true);
      await other.evaluate(
        ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
        { key, value: replacement },
      );
      state.readGate.release();
      await expect(
        page
          .locator("[data-background-notice] [role=status]")
          .filter({ hasText: "изменился в другой вкладке" }),
      ).toBeVisible();
      expect(await avatarJournal(page)).toEqual(replacement);
      await checkAvatar(page).click();
      await expect(retryAvatar(page)).toBeVisible();
      await expect(reset(page)).toHaveCount(0);
      expect(state.avatarWrites).toEqual([]);
    } finally {
      state.readGate.release();
    }
  });
  test("an account switch cancels reset without clearing the previous owner's record", async ({
    page,
  }) => {
    const { state } = await damaged(page);
    state.holdNextRead = true;
    try {
      page.once("dialog", (dialog) => dialog.accept());
      await reset(page).click();
      await expect.poll(() => state.readHeld).toBe(true);
      state.user = {
        ...state.user,
        id: 202,
        openId: "second-owner",
        name: "Second person",
      };
      await page.evaluate(() =>
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "darcy:session-change",
            newValue: "other-owner",
          }),
        ),
      );
      await expect(
        page.getByRole("button", { name: "Second person", exact: true }),
      ).toBeVisible();
      state.readGate.release();
      await expect(choose(page)).toBeEnabled();
      await expect(reset(page)).toHaveCount(0);
      expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
        "{damaged",
      );
      expect(state.avatarWrites).toEqual([]);
    } finally {
      state.readGate.release();
    }
  });
  test("a failed local removal keeps reset available and the picker locked", async ({
    page,
  }) => {
    await damaged(page);
    await page.evaluate((key) => {
      const remove = Storage.prototype.removeItem;
      Storage.prototype.removeItem = function (name) {
        if (name !== key) remove.call(this, name);
      };
    }, key);
    page.once("dialog", (dialog) => dialog.accept());
    await reset(page).click();
    await expect(
      page
        .locator("[data-background-notice] [role=status]")
        .filter({ hasText: "Не удалось сбросить" }),
    ).toBeVisible();
    await expect(choose(page)).toBeDisabled();
    expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
      "{damaged",
    );
  });
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
      page
        .locator("[data-background-notice] [role=status]")
        .filter({ hasText: "Выберите фото заново" }),
    ).toBeVisible();
    await expect(retryAvatar(page)).toHaveCount(0);
    expect(await avatarJournal(page)).toBeNull();
    expect(state.avatarWrites).toHaveLength(1);
    state.avatarConflict = false;
    await chooseAvatar(page, raster);
    await expect(page.getByText("Черновик фото", { exact: true })).toHaveCount(
      0,
    );
    await expect.poll(() => state.avatarWrites.length).toBe(2);
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
        .locator("[data-background-notice] [role=status]")
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

test("name editor closes on the first click beside the input and retains an unsaved draft", async ({
  page,
}) => {
  const { state } = await profileApi(page);
  await gotoWithSession(page, "/profile");
  const name = page.getByRole("button", { name: "Server name", exact: true });
  await name.click();
  const field = page.getByRole("textbox", { name: "Имя профиля", exact: true });
  await field.fill("Unsaved name");
  // One click just below the name row must dismiss the whole editor.
  const row = field.locator("..");
  const box = await row.boundingBox();
  if (!box) throw new Error("Name input row is missing");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height + 2);
  await expect(field).toHaveCount(0);
  await expect(name).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await name.click();
  await expect(field).toHaveValue("Unsaved name");
  await page
    .getByRole("button", { name: "Сохранить имя", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Unsaved name", exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
});

test("a stale name revision preserves the draft and needs an explicit reviewed retry", async ({
  page,
}) => {
  const { state } = await profileApi(page);
  await gotoWithSession(page, "/profile");
  await page.getByRole("button", { name: "Server name", exact: true }).click();
  const field = page.getByRole("textbox", { name: "Имя профиля", exact: true });
  await field.fill("My preserved draft");
  state.user.name = "Changed in another tab";
  state.user.profileRevision++;
  await page
    .getByRole("button", { name: "Сохранить имя", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Проверить сохранение имени",
      exact: true,
    }),
  ).toBeVisible();
  expect(state.user.name).toBe("Changed in another tab");
  await expect(field).toHaveValue("My preserved draft");
  await page
    .getByRole("button", { name: "Проверить сохранение имени", exact: true })
    .click();
  await expect(field).toBeEnabled();
  await expect(field).toHaveValue("My preserved draft");
  expect(state.writes).toHaveLength(1);
  await page
    .getByRole("button", { name: "Использовать мой черновик", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Сохранить имя", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "My preserved draft", exact: true }),
  ).toBeVisible();
  expect(state.writes.map((w) => w.expectedRevision)).toEqual([0, 1]);
});

for (const form of ["name", "setup"] as const) {
  test(`${form} draft retains its original revision through reload and reviewed recovery`, async ({
    page,
  }) => {
    const { state } = await profileApi(page);
    if (form === "setup") {
      state.user.name = null;
      state.user.gender = null;
    }
    const open = async () => {
      await gotoWithSession(page, form === "name" ? "/profile" : "/club");
      if (form === "name")
        await page
          .getByRole("button", { name: state.user.name!, exact: true })
          .click();
    };
    const field =
      form === "name"
        ? page.getByRole("textbox", { name: "Имя профиля", exact: true })
        : page.getByPlaceholder("Как тебя зовут?");
    const save = page.getByRole("button", {
      name: form === "name" ? "Сохранить имя" : "Продолжить",
      exact: true,
    });
    await open();
    await field.fill("Older unsent draft");
    if (form === "setup")
      await page.getByRole("button", { name: "Женский", exact: true }).click();
    state.user.name = "Newer server name";
    state.user.profileRevision = 1;
    await page.reload();
    if (form === "name")
      await page
        .getByRole("button", { name: state.user.name, exact: true })
        .click();
    await expect(field).toHaveValue("Older unsent draft");
    await save.click();
    const check = page.getByRole("button", {
      name:
        form === "name"
          ? "Проверить сохранение имени"
          : "Проверить сохранение анкеты",
      exact: true,
    });
    await expect(check).toBeEnabled();
    await expect
      .poll(() => state.writes.map((w) => w.expectedRevision))
      .toEqual([0]);
    expect(state.user.name).toBe("Newer server name");
    await check.click();
    await expect(
      page.getByText(/Сейчас в профиле: Newer server name/),
    ).toBeVisible();
    await expect(save).toBeDisabled();
    // Reload after checking must retain the unresolved review, not adopt revision 1.
    await page.reload();
    if (form === "name")
      await page
        .getByRole("button", { name: state.user.name, exact: true })
        .click();
    await expect(field).toHaveValue("Older unsent draft");
    await expect(save).toBeDisabled();
    await page
      .getByRole("button", { name: "Использовать мой черновик", exact: true })
      .click();
    await save.click();
    await expect.poll(() => state.user.name).toBe("Older unsent draft");
    expect(state.writes.map((w) => w.expectedRevision)).toEqual([0, 1]);
  });

  test(`${form} legacy draft requires a fresh read and explicit review`, async ({
    page,
  }) => {
    const { state } = await profileApi(page);
    if (form === "setup") {
      state.user.name = null;
      state.user.gender = null;
    }
    await page.addInitScript((kind) => {
      localStorage.setItem(
        `darcy:user:101:@darcy_${kind === "name" ? "profile_name" : "club_profile"}_draft`,
        kind === "name"
          ? "Legacy preserved input"
          : JSON.stringify({
              name: "Legacy preserved input",
              gender: "female",
            }),
      );
    }, form);
    await gotoWithSession(page, form === "name" ? "/profile" : "/club");
    if (form === "name")
      await page
        .getByRole("button", { name: "Server name", exact: true })
        .click();
    const field =
      form === "name"
        ? page.getByRole("textbox", { name: "Имя профиля", exact: true })
        : page.getByPlaceholder("Как тебя зовут?");
    await expect(field).toHaveValue("Legacy preserved input");
    const save = page.getByRole("button", {
      name: form === "name" ? "Сохранить имя" : "Продолжить",
      exact: true,
    });
    await expect(save).toBeDisabled();
    expect(state.writes).toHaveLength(0);
    await page
      .getByRole("button", {
        name:
          form === "name"
            ? "Сверить черновик имени"
            : "Сверить черновик анкеты",
        exact: true,
      })
      .click();
    await expect(save).toBeDisabled();
    await page
      .getByRole("button", { name: "Использовать мой черновик", exact: true })
      .click();
    await save.click();
    await expect.poll(() => state.user.name).toBe("Legacy preserved input");
    expect(state.writes).toHaveLength(1);
  });
}

test("closing and reopening a name draft never upgrades its original revision", async ({
  page,
}) => {
  const { state } = await profileApi(page);
  await gotoWithSession(page, "/profile");
  await page.getByRole("button", { name: "Server name", exact: true }).click();
  const field = page.getByRole("textbox", { name: "Имя профиля", exact: true });
  await field.fill("Kept old draft");
  await field.press("Escape");
  state.user.name = "Fresh name elsewhere";
  state.user.profileRevision = 1;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page
    .getByRole("button", { name: "Fresh name elsewhere", exact: true })
    .click();
  await expect(field).toHaveValue("Kept old draft");
  await page
    .getByRole("button", { name: "Сохранить имя", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Проверить сохранение имени",
      exact: true,
    }),
  ).toBeVisible();
  expect(state.writes.map((w) => w.expectedRevision)).toEqual([0]);
});

for (const form of ["name", "setup"] as const) {
  test(`${form} recovery keeps pending input when persisting the review fails`, async ({
    page,
  }) => {
    const { state } = await profileApi(page);
    if (form === "setup") {
      state.user.name = null;
      state.user.gender = null;
    }
    state.mode = "lost-uncommitted";
    await gotoWithSession(page, form === "name" ? "/profile" : "/club");
    if (form === "name")
      await page
        .getByRole("button", { name: "Server name", exact: true })
        .click();
    const field =
      form === "name"
        ? page.getByRole("textbox", { name: "Имя профиля", exact: true })
        : page.getByPlaceholder("Как тебя зовут?");
    await field.fill("Keep this input");
    if (form === "setup")
      await page.getByRole("button", { name: "Женский", exact: true }).click();
    await page
      .getByRole("button", {
        name: form === "name" ? "Сохранить имя" : "Продолжить",
        exact: true,
      })
      .click();
    const check = page.getByRole("button", {
      name:
        form === "name"
          ? "Проверить сохранение имени"
          : "Проверить сохранение анкеты",
      exact: true,
    });
    await expect(check).toBeVisible();
    const pendingKey = `darcy:user:101:@darcy_${form === "name" ? "profile_name" : "club_profile"}_pending`;
    const before = await page.evaluate(
      (key) => localStorage.getItem(key),
      pendingKey,
    );
    await page.evaluate(
      (key) => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (name, value) {
          if (name === key)
            throw new DOMException("Full", "QuotaExceededError");
          return original.call(this, name, value);
        };
      },
      pendingKey.replace(/_pending$/, "_draft"),
    );
    await check.click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Не удалось проверить сохранение" }),
    ).toBeVisible();
    expect(
      await page.evaluate((key) => localStorage.getItem(key), pendingKey),
    ).toBe(before);
    await expect(field).toHaveValue("Keep this input");
    await page.reload();
    if (form === "name")
      await page
        .getByRole("button", { name: "Server name", exact: true })
        .click();
    await expect(field).toHaveValue("Keep this input");
    await expect(field).toBeDisabled();
    await check.click();
    await expect(
      page.getByRole("button", {
        name: "Использовать мой черновик",
        exact: true,
      }),
    ).toBeEnabled();
    expect(state.writes).toHaveLength(1);
  });
}

test("missing profile revision blocks a write independently of storage errors", async ({
  page,
}) => {
  const { state } = await profileApi(page);
  await page.route("**/api/auth/me", (route) => {
    const { profileRevision: _revision, ...user } = state.user;
    return route.fulfill({ json: { user } });
  });
  await gotoWithSession(page, "/profile");
  await page.getByRole("button", { name: "Server name", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Имя профиля", exact: true })
    .fill("Input without a baseline");
  await page
    .getByRole("button", { name: "Сохранить имя", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Версия профиля недоступна" }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
});

test("a failed review confirmation keeps saving blocked and the persisted comparison intact", async ({
  page,
}) => {
  const { state } = await profileApi(page);
  await gotoWithSession(page, "/profile");
  await page.getByRole("button", { name: "Server name", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Имя профиля", exact: true })
    .fill("Reviewed old draft");
  state.user.name = "Server changed";
  state.user.profileRevision = 1;
  const save = page.getByRole("button", { name: "Сохранить имя", exact: true });
  await save.click();
  await page
    .getByRole("button", { name: "Проверить сохранение имени", exact: true })
    .click();
  // Finish the server comparison before injecting failure into accepting it.
  await expect(
    page.getByRole("button", {
      name: "Использовать мой черновик",
      exact: true,
    }),
  ).toBeEnabled();
  const draftKey = "darcy:user:101:@darcy_profile_name_draft";
  const before = await page.evaluate(
    (key) => localStorage.getItem(key),
    draftKey,
  );
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException("Full", "QuotaExceededError");
      return original.call(this, name, value);
    };
  }, draftKey);
  await page
    .getByRole("button", { name: "Использовать мой черновик", exact: true })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Не удалось сохранить сверенный черновик" }),
  ).toBeVisible();
  await expect(save).toBeDisabled();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), draftKey),
  ).toBe(before);
  expect(state.writes).toHaveLength(1);
});
