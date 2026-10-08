import { expect, test, type Page } from "@playwright/test";
import { editorApi, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

test.use({ hasTouch: true });
const member = (id: number, name: string, extra = {}) => ({
  id,
  name,
  email: null,
  role: "user",
  createdAt: "2026-10-01T10:00:00Z",
  clubExpiresAt: "2026-11-01T10:00:00Z",
  blockedAt: null,
  blockedReason: null,
  ...extra,
});
const card = (page: Page, name = "Телефонная участница") =>
  page.getByText(name, { exact: true }).locator("..");

async function fixtures(page: Page) {
  let rows = [
    member(201, "Телефонная участница"),
    member(202, "Другая участница", { email: "" }),
    member(203, "С почтой", { email: "existing@example.test" }),
    member(204, "Заблокирована", { blockedAt: "2026-10-08T10:00:00Z" }),
    member(205, "Модератор", { role: "moderator" }),
    member(206, "Администратор", { role: "admin" }),
  ];
  const writes: string[] = [];
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname.startsWith("/api/") &&
      request.method() !== "GET"
    )
      writes.push(request.url());
  });
  await editorApi(page, (name) => {
    if (name === "admin.members") return ok(rows);
  });
  return {
    writes,
    setRows: (next: typeof rows) => {
      rows = next;
    },
  };
}

async function openMembers(page: Page) {
  await gotoWithSession(page, "/admin");
  await page.getByRole("button", { name: "Участницы", exact: true }).click();
  await expect(card(page)).toBeVisible();
}

for (const width of [320, 390, 1440]) {
  test(`preparation validates locally and cannot send or claim success at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const { writes } = await fixtures(page);
    await openMembers(page);
    await expect(
      page.getByRole("button", { name: "Привязать почту", exact: true }),
    ).toHaveCount(2);
    const account = card(page);
    await account
      .getByRole("button", { name: "Привязать почту", exact: true })
      .tap();
    const form = account.getByRole("form", { name: "Первая привязка почты" });
    await expect(form).toContainText("Аккаунт: Телефонная участница · ID 201");
    const email = form.getByLabel("Почта участницы");
    await email.fill("invalid-email");
    await email.press("Tab");
    await expect(form.getByRole("alert")).toHaveText(
      "Укажите корректный email.",
    );
    await email.fill("draft-only@example.test");
    await email.press("Tab");
    await expect(form.getByRole("alert")).toHaveCount(0);
    await expect(
      form.getByRole("button", { name: "Привязать", exact: true }),
    ).toBeDisabled();
    await email.press("Enter");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(email).toHaveValue("draft-only@example.test");
    await expect(form).toContainText(
      "Привязка пока недоступна. Данные не отправляются",
    );
    await expect(account.getByText("нет email", { exact: true })).toBeVisible();
    await expect(
      page.getByText(/Почта привязана|Письмо отправлено|Email сохранён/),
    ).toHaveCount(0);
    expect(writes).toEqual([]);
    expect(
      await page.evaluate(() =>
        JSON.stringify({ ...localStorage, ...sessionStorage }),
      ),
    ).not.toContain("draft-only@example.test");
    await expect(email).toHaveCSS("font-size", "16px");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await form.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: test.info().outputPath(`member-email-${width}.png`),
    });
  });
}

test("drafts stay with their own account and cancellation discards input", async ({
  page,
}) => {
  const { writes } = await fixtures(page);
  await openMembers(page);
  await card(page)
    .getByRole("button", { name: "Привязать почту", exact: true })
    .click();
  await card(page).getByLabel("Почта участницы").fill("first@example.test");
  const other = card(page, "Другая участница");
  await other
    .getByRole("button", { name: "Привязать почту", exact: true })
    .click();
  await expect(other.getByLabel("Почта участницы")).toHaveValue("");
  await other.getByLabel("Почта участницы").fill("second@example.test");
  await expect(card(page).getByLabel("Почта участницы")).toHaveValue(
    "first@example.test",
  );
  await card(page).getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(card(page).getByRole("form")).toHaveCount(0);
  await card(page)
    .getByRole("button", { name: "Привязать почту", exact: true })
    .click();
  await expect(card(page).getByLabel("Почта участницы")).toHaveValue("");
  await expect(other.getByLabel("Почта участницы")).toHaveValue(
    "second@example.test",
  );
  expect(writes).toEqual([]);
});

test("reload discards the draft and a bound account no longer offers first binding", async ({
  page,
}) => {
  const { writes, setRows } = await fixtures(page);
  await openMembers(page);
  await card(page)
    .getByRole("button", { name: "Привязать почту", exact: true })
    .click();
  await card(page).getByLabel("Почта участницы").fill("not-saved@example.test");
  setRows([
    member(201, "Телефонная участница", { email: "bound@example.test" }),
  ]);
  await openMembers(page);
  await expect(
    card(page).getByText("bound@example.test", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Почта участницы")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Привязать почту", exact: true }),
  ).toHaveCount(0);
  expect(writes).toEqual([]);
});

for (const role of ["moderator", "user", "guest"]) {
  test(`${role} does not receive the preparation or the members list`, async ({
    page,
  }) => {
    await fixtures(page);
    const memberReads: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("admin.members"))
        memberReads.push(request.url());
    });
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        json: {
          user:
            role === "guest"
              ? null
              : {
                  id: 102,
                  openId: "test-staff",
                  name: "Другой пользователь",
                  email: "staff@example.test",
                  role,
                  lastSignedIn: "2026-10-08T10:00:00Z",
                },
        },
      }),
    );
    await gotoWithSession(page, "/admin");
    if (role === "moderator")
      await expect(page.getByText("Модерация", { exact: true })).toBeVisible();
    else
      await expect(
        page.getByText("Нет доступа к управлению приложением", { exact: true }),
      ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Привязать почту", exact: true }),
    ).toHaveCount(0);
    expect(memberReads).toEqual([]);
  });
}

for (const nextActor of [102, null]) {
  test(`${nextActor === null ? "session revocation" : "another administrator"} clears prepared private input`, async ({
    page,
  }) => {
    const { writes } = await fixtures(page);
    let actorId: number | null = 101;
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        json: {
          user:
            actorId === null
              ? null
              : {
                  id: actorId,
                  openId: `test-admin-${actorId}`,
                  name: "Администратор",
                  email: "admin@example.test",
                  role: "admin",
                  lastSignedIn: "2026-10-08T10:00:00Z",
                },
        },
      }),
    );
    await openMembers(page);
    await card(page)
      .getByRole("button", { name: "Привязать почту", exact: true })
      .click();
    await card(page)
      .getByLabel("Почта участницы")
      .fill("private-draft@example.test");
    actorId = nextActor;
    const refreshed = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/auth/me",
    );
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await refreshed;
    await expect(page.getByLabel("Почта участницы")).toHaveCount(0);
    if (nextActor !== null) {
      await page
        .getByRole("button", { name: "Участницы", exact: true })
        .click();
      await expect(card(page)).toBeVisible();
      await card(page)
        .getByRole("button", { name: "Привязать почту", exact: true })
        .click();
      await expect(card(page).getByLabel("Почта участницы")).toHaveValue("");
    } else {
      await expect(
        page.getByRole("button", { name: "Привязать почту", exact: true }),
      ).toHaveCount(0);
    }
    expect(writes).toEqual([]);
  });
}
