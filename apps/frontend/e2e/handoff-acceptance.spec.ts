import { expect, test } from "@playwright/test";
import superjson from "superjson";
import { gotoWithSession, layoutApi } from "./layout-fixtures";
import { failure } from "./editor-fixtures";

test.skip(
  process.env.NORMAL_CHECKOUT_UI_ENABLED !== "true" ||
    process.env.VK_CATALOG_UI_ENABLED !== "true",
  "Requires both integrations in the build; synthetic API/provider replies only.",
);

test("one recovered purchase opens club playback; account changes remove payment and media state", async ({
  page,
}) => {
  await layoutApi(page, true);
  await page.addInitScript(() =>
    localStorage.setItem(
      "darcy:user:202:@darcy_club_profile_completed",
      "true",
    ),
  );
  const member = {
    id: 101,
    openId: "acceptance-member",
    name: "Участница",
    email: "member@example.test",
    role: "user",
    lastSignedIn: "2026-10-14T10:00:00Z",
  };
  const state = {
    user: { ...member } as typeof member | null,
    paid: false,
    service: false,
    succeeded: false,
    key: null as string | null,
    writes: 0,
    statusOwners: [] as number[],
    legacyWrites: 0,
    providerRequests: 0,
  };
  const result = (value: unknown) => ({
    result: { data: superjson.serialize(value) },
  });
  const embed = "https://vkvideo.ru/video_ext.php?oid=-1&id=2&hash=abcdefgh";
  await page.route("https://vkvideo.ru/video_ext.php?**", (route) => {
    state.providerRequests++;
    return route.fulfill({
      contentType: "text/html",
      body: "<html><body>Synthetic VK player</body></html>",
    });
  });
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { user: state.user } }),
  );
  await page.route("**/api/trpc/**", async (route) => {
    const url = new URL(route.request().url());
    const names = url.pathname.split("/api/trpc/")[1].split(",");
    const encoded = JSON.parse(
      route.request().postData() ?? url.searchParams.get("input") ?? "{}",
    );
    const replies = await Promise.all(
      names.map(async (name, index) => {
        const input = url.searchParams.has("batch")
          ? (encoded[index]?.json ?? {})
          : (encoded.json ?? {});
        if (name === "club.subscription")
          return result({
            hasClubAccess: state.paid || state.service,
            subscribed: state.paid,
            expiresAt: state.paid ? new Date("2040-12-01T10:00:00Z") : null,
            cancelAtPeriodEnd: false,
            cancellationStatus: "none",
            isOwner: false,
            monthlyPrice: "790",
          });
        if (name === "club.createNormalCheckout") {
          expect(route.request().method()).toBe("POST");
          const saved = await page.evaluate(() =>
            localStorage.getItem("darcy:user:101:normal-checkout:v1"),
          );
          expect(JSON.parse(saved!)).toMatchObject({
            ownerId: 101,
            idempotencyKey: input.idempotencyKey,
            plan: "monthly",
          });
          state.writes++;
          state.key = input.idempotencyKey;
          // The model commits the order but loses the transport reply.
          await route.abort("failed");
          return result({ state: "pending", orderId: "acceptance-order" });
        }
        if (name === "club.normalCheckoutStatus") {
          expect(route.request().method()).toBe("GET");
          state.statusOwners.push(state.user!.id);
          if (!state.key) return result({ state: "notRecorded" });
          expect(input.idempotencyKey).toBe(state.key);
          return result(
            state.succeeded
              ? {
                  state: "succeeded",
                  orderId: "acceptance-order",
                  expiresAt: new Date("2040-12-01T10:00:00Z"),
                }
              : { state: "pending", orderId: "acceptance-order" },
          );
        }
        if (name === "club.createCheckout") {
          state.legacyWrites++;
          return failure(412);
        }
        if (name === "club.reconcileCheckout")
          throw new Error("NORMAL must not use TEST proof");
        if (name === "videos.catalog")
          return result({
            items: [
              {
                id: 42,
                title: "ACCEPTANCE_VIDEO",
                duration: null,
                access: "club",
                canWatch: Boolean(state.user && (state.paid || state.service)),
              },
            ],
            nextCursor: null,
          });
        if (name === "videos.playback") {
          if (!state.user) return failure(401);
          if (!state.paid && !state.service) return failure(403);
          return result({ id: 42, provider: "vk", embedUrl: embed });
        }
        if (name === "videos.list" || name === "videos.getById")
          throw new Error("Mixed catalog must not fall back to legacy sources");
        if (name === "feed.userInteractions")
          return result({ likedIds: [], savedIds: [] });
        if (name === "club.list" || name === "feed.listPaginated")
          return result({ posts: [], nextCursor: null });
        if (name === "notifications.latest")
          return result({ feedId: null, clubId: null });
        return result([]);
      }),
    );
    await route
      .fulfill({ json: url.searchParams.has("batch") ? replies : replies[0] })
      .catch(() => {});
  });

  await gotoWithSession(page, "/club?checkout=1");
  await page
    .getByRole("button", { name: /Оплатить 790/ })
    .first()
    .click();
  await expect(
    page
      .getByRole("button", { name: "Восстановить ссылку оплаты", exact: true })
      .first(),
  ).toBeEnabled();
  expect(state.writes).toBe(1);
  expect(state.key).not.toBeNull();
  await page.reload();
  await expect(
    page.getByText(/Оплата этой покупки пока не подтверждена/),
  ).toBeVisible();
  expect(state.writes).toBe(1);
  state.succeeded = true;
  state.paid = true;
  await page
    .getByRole("button", { name: "Проверить покупку", exact: true })
    .first()
    .click();
  await expect(
    page.getByText(/Оплата этой покупки подтверждена/),
  ).toBeVisible();
  await expect(
    page
      .getByRole("button", { name: "Новая покупка подписки", exact: true })
      .first(),
  ).toBeEnabled();
  // Leave the explicit checkout visit through the persistent tab navigation.
  await page.getByRole("link", { name: "Видео", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Открыть видео: ACCEPTANCE_VIDEO",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Открыть профиль", exact: true })
    .click();
  await expect(page.getByText("Активна", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Клуб", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Комьюнити", exact: true }),
  ).toBeVisible();
  expect(state.writes).toBe(1);
  expect(state.legacyWrites).toBe(0);
  await page.getByRole("link", { name: "Видео", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Открыть видео: ACCEPTANCE_VIDEO",
      exact: true,
    })
    .click();
  await expect(page.getByTitle("VK Видео", { exact: true })).toHaveAttribute(
    "src",
    embed + "&autoplay=0",
  );
  const loaded = state.providerRequests;
  state.user = null;
  state.paid = false;
  await page.evaluate(() =>
    dispatchEvent(
      new StorageEvent("storage", {
        key: "darcy:session-change",
        newValue: "revoked",
      }),
    ),
  );
  await expect(
    page.getByText("Войдите, чтобы смотреть это видео", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("iframe[src]")).toHaveCount(0);
  expect(state.providerRequests).toBe(loaded);
  state.user = { ...member, id: 202, role: "moderator" };
  state.service = true;
  await page.evaluate(() =>
    dispatchEvent(
      new StorageEvent("storage", {
        key: "darcy:session-change",
        newValue: "moderator",
      }),
    ),
  );
  await expect(page.getByTitle("VK Видео", { exact: true })).toBeVisible();
  await page
    .getByRole("link", { name: "Открыть профиль", exact: true })
    .click();
  await expect(
    page.getByText("Служебный доступ", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Отменить подписку", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Клуб", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Комьюнити", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Оплата этой покупки подтверждена/)).toHaveCount(
    0,
  );
  expect(state.statusOwners.every((id) => id === 101)).toBe(true);
  expect(state.writes).toBe(1);
  expect(state.legacyWrites).toBe(0);
});
