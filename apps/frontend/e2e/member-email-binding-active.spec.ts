import { expect, test, type Page } from "@playwright/test";
import { editorApi, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

test.skip(
  process.env.NEXT_PUBLIC_MEMBER_EMAIL_BINDING_ENABLED !== "true",
  "Requires the explicitly enabled local build; rollout stays disabled.",
);
const row = {
  id: 201,
  name: "Телефонная участница",
  email: null as string | null,
  role: "user",
  createdAt: "2026-10-01T10:00:00Z",
  clubExpiresAt: null,
  blockedAt: null,
  blockedReason: null,
};
const form = (page: Page) =>
  page.getByRole("form", { name: "Первая привязка почты" });
async function open(page: Page) {
  await gotoWithSession(page, "/admin");
  await page.getByRole("button", { name: "Участницы", exact: true }).click();
  await page
    .getByRole("button", { name: "Привязать почту", exact: true })
    .click();
  await form(page).getByLabel("Почта участницы").fill("member@example.test");
}
async function fixture(page: Page) {
  const member = { ...row };
  const writes: { userId: number; email: string; requestKey: string }[] = [];
  let delivery = "queued";
  let state = "pending";
  let loseReply = false;
  let actor: number | null = 101;
  let holdReply: Promise<void> | undefined;
  let releaseReply = () => {};
  await editorApi(page, (name) =>
    name === "admin.members" ? ok([member]) : undefined,
  );
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user:
          actor === null
            ? null
            : {
                id: actor,
                openId: `admin-${actor}`,
                role: "admin",
                name: "Администратор",
                email: "admin@example.test",
                lastSignedIn: "2026-10-10T12:00:00Z",
              },
      },
    }),
  );
  await page.route("**/api/admin/member-email-bindings**", async (route) => {
    if (route.request().method() === "POST") {
      const input = route.request().postDataJSON();
      writes.push(input);
      await holdReply;
      if (loseReply) return route.abort("failed");
      return route.fulfill({
        status: 202,
        json: { requestKey: input.requestKey, state },
      });
    }
    return route.fulfill({
      json: {
        requestKey: writes[0].requestKey,
        userId: 201,
        state,
        delivery,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        completedAt: state === "pending" ? null : "2026-10-10T12:00:00.000Z",
      },
    });
  });
  return {
    writes,
    lose: () => {
      loseReply = true;
    },
    receive: () => {
      loseReply = false;
    },
    sent: () => {
      delivery = "sent";
    },
    confirm: () => {
      state = "confirmed";
      member.email = "member@example.test";
    },
    actor: (id: number | null) => {
      actor = id;
    },
    hold: () => {
      holdReply = new Promise<void>((resolve) => {
        releaseReply = resolve;
      });
    },
    release: () => releaseReply(),
    state: (value: string) => {
      state = value;
    },
  };
}

test("reload restores the original intent without retaining email or sending again", async ({
  page,
}) => {
  const f = await fixture(page);
  await open(page);
  await form(page)
    .getByRole("button", { name: "Отправить подтверждение", exact: true })
    .click();
  await expect(form(page)).toContainText("Заявка принята");
  const key = f.writes[0].requestKey;
  await page.reload();
  await page.getByRole("button", { name: "Участницы", exact: true }).click();
  await page
    .getByRole("button", { name: "Привязать почту", exact: true })
    .click();
  await form(page)
    .getByRole("button", { name: "Восстановить заявку", exact: true })
    .click();
  await expect(form(page)).toContainText("Письмо в очереди");
  await expect(form(page).getByLabel("Почта участницы")).toHaveValue("");
  await expect(
    form(page).getByRole("button", { name: "Повторить эту заявку" }),
  ).toHaveCount(0);
  expect(f.writes).toHaveLength(1);
  expect(f.writes[0].requestKey).toBe(key);
});

test("another tab discovers a reserved intent instead of submitting another email", async ({
  page,
  context,
}) => {
  const f = await fixture(page);
  await open(page);
  await form(page)
    .getByRole("button", { name: "Отправить подтверждение", exact: true })
    .click();
  await expect(form(page)).toContainText("Заявка принята");
  const other = await context.newPage();
  const second = await fixture(other);
  // The second tab's status endpoint sees the already-recorded server intent.
  second.writes.push(f.writes[0]);
  await open(other);
  await form(other)
    .getByLabel("Почта участницы")
    .fill("different@example.test");
  await form(other)
    .getByRole("button", { name: "Отправить подтверждение", exact: true })
    .click();
  await expect(form(other)).toContainText("Письмо в очереди");
  expect(second.writes).toHaveLength(1);
  await expect(form(other).getByLabel("Почта участницы")).toHaveValue("");
});

test("unavailable durable storage prevents sending and leaves an actionable error", async ({
  page,
}) => {
  const f = await fixture(page);
  await open(page);
  await page.evaluate(() => {
    indexedDB.open = () => {
      throw new Error("PRIVATE_DETAILS");
    };
  });
  await form(page)
    .getByRole("button", { name: "Отправить подтверждение", exact: true })
    .click();
  await expect(form(page).getByRole("alert")).toContainText("хранилищ");
  expect(f.writes).toHaveLength(0);
  await expect(form(page)).not.toContainText("PRIVATE_DETAILS");
});

test("missing recovery on a fresh device does not create an intent or send mail", async ({
  page,
}) => {
  const f = await fixture(page);
  await open(page);
  await form(page)
    .getByRole("button", { name: "Восстановить заявку", exact: true })
    .click();
  await expect(form(page).getByRole("alert")).toContainText(
    "заявка не найдена",
  );
  await expect(form(page).getByLabel("Почта участницы")).toBeEditable();
  expect(f.writes).toHaveLength(0);
});

test("a missing server result after reload does not discard an uncertain intent", async ({
  page,
}) => {
  const f = await fixture(page);
  f.lose();
  await open(page);
  await form(page)
    .getByRole("button", { name: "Отправить подтверждение", exact: true })
    .click();
  await expect.poll(() => f.writes.length).toBe(1);
  await expect(
    form(page).getByRole("button", { name: "Проверить заявку", exact: true }),
  ).toBeEnabled();
  await page.route("**/api/admin/member-email-bindings/**", (route) =>
    route.fulfill({ status: 404, json: { error: "Запрос недоступен." } }),
  );
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.reload();
    await page.getByRole("button", { name: "Участницы", exact: true }).click();
    await page
      .getByRole("button", { name: "Привязать почту", exact: true })
      .click();
    await form(page)
      .getByRole("button", { name: "Восстановить заявку", exact: true })
      .click();
    await expect(form(page)).toContainText("Результат запроса неизвестен");
    await expect(
      form(page).getByRole("button", { name: "Проверить заявку", exact: true }),
    ).toBeEnabled();
    await expect(
      form(page).getByRole("button", { name: "Отправить подтверждение" }),
    ).toHaveCount(0);
    await expect(
      form(page).getByRole("button", { name: "Повторить эту заявку" }),
    ).toHaveCount(0);
  }
  expect(f.writes).toHaveLength(1);
});

test("unknown recovery explicitly re-enters the original email and reuses its durable key", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  const f = await fixture(page);
  f.lose();
  await open(page);
  await form(page)
    .getByRole("button", { name: "Отправить подтверждение", exact: true })
    .click();
  await expect.poll(() => f.writes.length).toBe(1);
  await expect(
    form(page).getByRole("button", { name: "Проверить заявку", exact: true }),
  ).toBeEnabled();
  await page.reload();
  await page.route("**/api/admin/member-email-bindings/**", (route) =>
    route.fulfill({ status: 404, json: { error: "Запрос недоступен." } }),
  );
  await page.getByRole("button", { name: "Участницы", exact: true }).click();
  await page
    .getByRole("button", { name: "Привязать почту", exact: true })
    .click();
  await form(page)
    .getByRole("button", { name: "Восстановить заявку", exact: true })
    .click();
  await expect(form(page)).toContainText("Результат запроса неизвестен");
  await expect(form(page).getByLabel("Почта участницы")).toBeEditable();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await form(page).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: test.info().outputPath("recovered-intent-320.png"),
  });
  await form(page).getByLabel("Почта участницы").fill(" MEMBER@example.test ");
  f.receive();
  await form(page)
    .getByRole("button", { name: "Повторить с исходной почтой", exact: true })
    .click();
  await expect(form(page)).toContainText("Заявка принята");
  expect(f.writes).toHaveLength(2);
  expect(f.writes[1]).toEqual(f.writes[0]);
});

test("a refused request keeps its key and does not offer a new intent", async ({
  page,
}) => {
  const f = await fixture(page);
  await open(page);
  const attempts: unknown[] = [];
  await page.route("**/api/admin/member-email-bindings", (route) => {
    attempts.push(route.request().postDataJSON());
    return route.fulfill({
      status: 409,
      json: { error: "Запрос недоступен." },
    });
  });
  await form(page)
    .getByRole("button", { name: "Отправить подтверждение", exact: true })
    .click();
  await expect(form(page)).toContainText("Конфликт заявки");
  await expect(
    form(page).getByRole("button", { name: "Подготовить новую заявку" }),
  ).toHaveCount(0);
  await form(page)
    .getByRole("button", { name: "Повторить эту заявку", exact: true })
    .click();
  await expect.poll(() => attempts.length).toBe(2);
  expect(attempts[1]).toEqual(attempts[0]);
  expect(f.writes).toHaveLength(0);
});

test("cross-tab unknown recovery never prefills a different draft as the original email", async ({
  page,
  context,
}) => {
  const f = await fixture(page);
  f.lose();
  await open(page);
  await form(page)
    .getByRole("button", { name: "Отправить подтверждение", exact: true })
    .click();
  await expect.poll(() => f.writes.length).toBe(1);
  const other = await context.newPage();
  const second = await fixture(other);
  await other.route("**/api/admin/member-email-bindings/**", (route) =>
    route.fulfill({ status: 404, json: { error: "Запрос недоступен." } }),
  );
  await open(other);
  await form(other)
    .getByLabel("Почта участницы")
    .fill("different@example.test");
  await form(other)
    .getByRole("button", { name: "Отправить подтверждение", exact: true })
    .click();
  await expect(
    form(other).getByRole("button", {
      name: "Повторить с исходной почтой",
      exact: true,
    }),
  ).toBeEnabled();
  await expect(form(other).getByLabel("Почта участницы")).toHaveValue("");
  expect(second.writes).toHaveLength(0);
});

for (const terminal of ["expired", "cancelled"])
  test(`${terminal} allows an explicit fresh draft only after a new status check`, async ({
    page,
  }) => {
    const f = await fixture(page);
    await open(page);
    await form(page)
      .getByRole("button", { name: "Отправить подтверждение", exact: true })
      .click();
    await expect(form(page)).toContainText("Заявка принята");
    f.state(terminal);
    await form(page)
      .getByRole("button", { name: "Проверить заявку", exact: true })
      .click();
    await form(page)
      .getByRole("button", { name: "Подготовить новую заявку", exact: true })
      .click();
    await expect(form(page).getByLabel("Почта участницы")).toBeEditable();
    await expect(form(page).getByLabel("Почта участницы")).toHaveValue("");
    expect(f.writes).toHaveLength(1);
    f.state("pending");
    await form(page).getByLabel("Почта участницы").fill("next@example.test");
    await form(page)
      .getByRole("button", { name: "Отправить подтверждение", exact: true })
      .click();
    await expect(form(page)).toContainText("Заявка принята");
    expect(f.writes).toHaveLength(2);
    expect(f.writes[1].email).toBe("next@example.test");
    expect(f.writes[1].requestKey).not.toBe(f.writes[0].requestKey);
  });

test("fresh-draft preparation fails closed if terminal status cannot be revalidated", async ({
  page,
}) => {
  const f = await fixture(page);
  await open(page);
  await form(page)
    .getByRole("button", { name: "Отправить подтверждение", exact: true })
    .click();
  await expect(form(page)).toContainText("Заявка принята");
  f.state("expired");
  await form(page)
    .getByRole("button", { name: "Проверить заявку", exact: true })
    .click();
  await page.route("**/api/admin/member-email-bindings/**", (route) =>
    route.fulfill({ status: 503, json: { error: "Запрос недоступен." } }),
  );
  await form(page)
    .getByRole("button", { name: "Подготовить новую заявку", exact: true })
    .click();
  await expect(form(page).getByRole("alert")).toBeVisible();
  await expect(form(page).getByLabel("Почта участницы")).toBeDisabled();
  expect(f.writes).toHaveLength(1);
});

test("fresh-draft preparation cannot erase a newer cross-tab reservation", async ({
  page,
}) => {
  const f = await fixture(page);
  await open(page);
  await form(page)
    .getByRole("button", { name: "Отправить подтверждение", exact: true })
    .click();
  await expect(form(page)).toContainText("Заявка принята");
  f.state("cancelled");
  await form(page)
    .getByRole("button", { name: "Проверить заявку", exact: true })
    .click();
  const nextKey = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  await page.evaluate(
    (requestKey) =>
      new Promise<void>((resolve, reject) => {
        const opening = indexedDB.open("darcy-member-email-intents", 1);
        opening.onerror = () => reject(new Error("fixture open failed"));
        opening.onsuccess = () => {
          const db = opening.result;
          const tx = db.transaction("intents", "readwrite");
          tx.objectStore("intents").put({ version: 1, requestKey }, "101:201");
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onabort = () => {
            db.close();
            reject(new Error("fixture write failed"));
          };
        };
      }),
    nextKey,
  );
  await form(page)
    .getByRole("button", { name: "Подготовить новую заявку", exact: true })
    .click();
  await expect(form(page).getByRole("alert")).toContainText(
    "заявка изменилась",
  );
  await expect(form(page).getByLabel("Почта участницы")).toBeDisabled();
  // Recovery must still find the newer key; this also catches unconditional deletion.
  await page.reload();
  await page.route("**/api/admin/member-email-bindings/**", (route) =>
    route.fulfill({
      json: {
        requestKey: nextKey,
        userId: 201,
        state: "pending",
        delivery: "queued",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        completedAt: null,
      },
    }),
  );
  await page.getByRole("button", { name: "Участницы", exact: true }).click();
  await page
    .getByRole("button", { name: "Привязать почту", exact: true })
    .click();
  await form(page)
    .getByRole("button", { name: "Восстановить заявку", exact: true })
    .click();
  await expect(form(page)).toContainText("Письмо в очереди");
  expect(f.writes).toHaveLength(1);
});

test("a nonterminal revalidation retains the intent instead of opening a new draft", async ({
  page,
}) => {
  const f = await fixture(page);
  await open(page);
  await form(page)
    .getByRole("button", { name: "Отправить подтверждение", exact: true })
    .click();
  await expect(form(page)).toContainText("Заявка принята");
  f.state("expired");
  await form(page)
    .getByRole("button", { name: "Проверить заявку", exact: true })
    .click();
  await expect(
    form(page).getByRole("button", { name: "Подготовить новую заявку" }),
  ).toBeVisible();
  f.state("pending");
  await form(page)
    .getByRole("button", { name: "Подготовить новую заявку", exact: true })
    .click();
  await expect(form(page)).toContainText("Письмо в очереди");
  await expect(form(page).getByLabel("Почта участницы")).toBeDisabled();
  await expect(
    form(page).getByRole("button", { name: "Подготовить новую заявку" }),
  ).toHaveCount(0);
  expect(f.writes).toHaveLength(1);
});

for (const width of [320, 390, 1440])
  test(`binding reports queue, SMTP and confirmed identity separately at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const f = await fixture(page);
    await open(page);
    await form(page)
      .getByRole("button", { name: "Отправить подтверждение", exact: true })
      .click({ timeout: 5000 });
    await expect(form(page)).toContainText("Заявка принята");
    await expect(page.getByText("нет email", { exact: true })).toBeVisible();
    await expect(form(page).getByLabel("Почта участницы")).toBeDisabled();
    f.sent();
    await form(page)
      .getByRole("button", { name: "Проверить заявку", exact: true })
      .click();
    await expect(form(page)).toContainText("Почтовый сервер принял письмо");
    await expect(page.getByText("нет email", { exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await form(page).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: test.info().outputPath(`binding-active-${width}.png`),
    });
    f.confirm();
    await form(page)
      .getByRole("button", { name: "Проверить заявку", exact: true })
      .click();
    await expect(
      page.getByText("member@example.test", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Привязать почту", exact: true }),
    ).toHaveCount(0);
    expect(f.writes).toHaveLength(1);
    expect(f.writes[0]).toEqual({
      userId: 201,
      email: "member@example.test",
      requestKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
  });

test("lost receipt keeps the same intent after closing and switching the admin tab", async ({
  page,
}) => {
  const f = await fixture(page);
  f.lose();
  await open(page);
  await form(page)
    .getByRole("button", { name: "Отправить подтверждение", exact: true })
    .click({ timeout: 5000 });
  await expect(form(page)).toContainText("Результат запроса неизвестен");
  await form(page)
    .getByRole("button", { name: "Закрыть", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Привязать почту", exact: true })
    .click();
  await expect(form(page)).toContainText("Результат запроса неизвестен");
  await form(page)
    .getByRole("button", { name: "Повторить эту заявку", exact: true })
    .click();
  await expect.poll(() => f.writes.length).toBe(2);
  expect(f.writes[1]).toEqual(f.writes[0]);
  await page.getByRole("button", { name: "Посты", exact: true }).click();
  await page.getByRole("button", { name: "Участницы", exact: true }).click();
  await page
    .getByRole("button", { name: "Привязать почту", exact: true })
    .click();
  await form(page)
    .getByRole("button", { name: "Проверить заявку", exact: true })
    .click();
  await expect(form(page)).toContainText("Письмо в очереди");
  expect(f.writes).toHaveLength(2);
  expect(
    await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    ),
  ).not.toContain("member@example.test");
});

test("synchronous duplicate submit cannot create two intents", async ({
  page,
}) => {
  const f = await fixture(page);
  f.hold();
  await open(page);
  try {
    await form(page).evaluate((node) => {
      (node as HTMLFormElement).requestSubmit();
      (node as HTMLFormElement).requestSubmit();
    });
    await expect.poll(() => f.writes.length).toBe(1);
    await expect(
      form(page).getByRole("button", { name: "Проверить заявку", exact: true }),
    ).toBeDisabled();
    f.release();
    await expect(form(page)).toContainText("Заявка принята");
    expect(f.writes).toHaveLength(1);
  } finally {
    f.release();
  }
});

test("an address rejected by the contract stays editable without creating an intent", async ({
  page,
}) => {
  const f = await fixture(page);
  await open(page);
  await form(page).getByLabel("Почта участницы").fill("member@localhost");
  await form(page)
    .getByRole("button", { name: "Отправить подтверждение", exact: true })
    .click();
  await expect(form(page).getByRole("alert")).toContainText(
    "Укажите корректный email",
  );
  await expect(form(page).getByLabel("Почта участницы")).toBeEditable();
  expect(f.writes).toHaveLength(0);
});

test("a replayed pending receipt does not assert that delivery is still queued", async ({
  page,
}) => {
  const f = await fixture(page);
  f.lose();
  await open(page);
  await form(page)
    .getByRole("button", { name: "Отправить подтверждение", exact: true })
    .click();
  await expect(form(page)).toContainText("Результат запроса неизвестен");
  f.receive();
  f.sent();
  await form(page)
    .getByRole("button", { name: "Повторить эту заявку", exact: true })
    .click();
  await expect(form(page)).toContainText("Заявка принята");
  await expect(form(page)).not.toContainText("Письмо в очереди");
  await form(page)
    .getByRole("button", { name: "Проверить заявку", exact: true })
    .click();
  await expect(form(page)).toContainText("Почтовый сервер принял письмо");
  expect(f.writes[1]).toEqual(f.writes[0]);
});

for (const nextActor of [102, null])
  test(`late accepted reply cannot leak into session ${nextActor}`, async ({
    page,
  }) => {
    const f = await fixture(page);
    f.hold();
    await open(page);
    try {
      await form(page)
        .getByRole("button", { name: "Отправить подтверждение", exact: true })
        .click();
      await expect.poll(() => f.writes.length).toBe(1);
      f.actor(nextActor);
      const refreshed = page.waitForResponse(
        (response) => new URL(response.url()).pathname === "/api/auth/me",
      );
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await refreshed;
      await expect(form(page)).toHaveCount(0);
      f.release();
      if (nextActor !== null) {
        await page
          .getByRole("button", { name: "Участницы", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Привязать почту", exact: true })
          .click();
        await expect(form(page).getByLabel("Почта участницы")).toHaveValue("");
        await expect(form(page)).not.toContainText("Заявка принята");
        await expect(
          form(page).getByRole("button", {
            name: "Проверить заявку",
            exact: true,
          }),
        ).toHaveCount(0);
      } else await expect(page).toHaveURL(/\/login$/);
    } finally {
      f.release();
    }
  });

for (const [state, message] of [
  ["expired", "Срок заявки истёк"],
  ["cancelled", "Заявка отменена"],
])
  test(`${state} never grants a displayed identity or resends mail`, async ({
    page,
  }) => {
    const f = await fixture(page);
    await open(page);
    await form(page)
      .getByRole("button", { name: "Отправить подтверждение", exact: true })
      .click();
    await expect(form(page)).toContainText("Заявка принята");
    f.state(state);
    await form(page)
      .getByRole("button", { name: "Проверить заявку", exact: true })
      .click();
    await expect(form(page)).toContainText(message);
    await expect(page.getByText("нет email", { exact: true })).toBeVisible();
    await expect(
      form(page).getByRole("button", {
        name: "Повторить эту заявку",
        exact: true,
      }),
    ).toHaveCount(0);
    expect(f.writes).toHaveLength(1);
  });
