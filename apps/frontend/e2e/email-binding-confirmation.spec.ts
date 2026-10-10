import { expect, test } from "@playwright/test";

const active = process.env.NEXT_PUBLIC_MEMBER_EMAIL_BINDING_ENABLED === "true";
const proof = "b".repeat(43);
test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "localhost"
      ? route.continue()
      : route.abort(),
  );
  await page.addInitScript(() =>
    localStorage.setItem("@darcy_install_guide_seen", "1"),
  );
  await page.route("**/api/**", (route) =>
    route.fulfill({ json: { user: null } }),
  );
});

test("default-disabled confirmation cannot submit a proof", async ({
  page,
}) => {
  test.skip(active);
  let writes = 0;
  await page.route("**/api/auth/email-bindings/confirm", (route) => {
    writes++;
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto("/email-binding#token=" + proof);
  await expect(
    page.getByRole("heading", { name: "Подтверждение почты" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Подтвердить почту", exact: true }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(/\/email-binding$/);
  expect(writes).toBe(0);
});

test.describe("explicitly enabled proof page", () => {
  test.skip(!active);
  test("opening removes proof and explicit confirmation alone shows success", async ({
    page,
  }) => {
    await page
      .context()
      .addCookies([
        {
          name: "unrelated_session",
          value: "synthetic-only",
          url: "http://localhost:8081",
        },
      ]);
    const writes: { body: unknown; cookie?: string; referrer?: string }[] = [];
    await page.route("**/api/auth/email-bindings/confirm", (route) => {
      const request = route.request();
      writes.push({
        body: request.postDataJSON(),
        cookie: request.headers().cookie,
        referrer: request.headers().referer,
      });
      return route.fulfill({ json: { ok: true } });
    });
    await page.goto("/email-binding#token=" + proof);
    const submit = page.getByRole("button", {
      name: "Подтвердить почту",
      exact: true,
    });
    await expect(submit).toBeEnabled();
    await expect(page).toHaveURL(/\/email-binding$/);
    expect(writes).toEqual([]);
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute(
      "content",
      "no-referrer",
    );
    await submit.click();
    await expect(page.getByRole("status")).toContainText("Почта подтверждена");
    await expect(submit).toHaveCount(0);
    expect(writes).toEqual([
      { body: { token: proof }, cookie: undefined, referrer: undefined },
    ]);
    await expect(
      page.getByRole("link", { name: "Перейти ко входу" }),
    ).toHaveAttribute("href", "/login");
    const storage = await page.evaluate(() =>
      JSON.stringify([localStorage, sessionStorage]),
    );
    expect(storage).not.toContain(proof);
  });
  test("reload loses memory proof and never confirms automatically", async ({
    page,
  }) => {
    await page.goto("/email-binding#token=" + proof);
    await expect(
      page.getByRole("button", { name: "Подтвердить почту", exact: true }),
    ).toBeEnabled();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Подтвердить почту", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText(
      "Откройте ссылку из письма",
    );
  });
  test("a consumed proof after a lost response is not reported as confirmed", async ({
    page,
  }) => {
    let writes = 0;
    await page.route("**/api/auth/email-bindings/confirm", (route) => {
      writes++;
      return route.fulfill({
        status: 400,
        json: { error: "private@example.test" },
      });
    });
    await page.goto("/email-binding#token=" + proof);
    await page
      .getByRole("button", { name: "Подтвердить почту", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("уже использована");
    await expect(page.getByRole("status")).not.toContainText(
      "Почта подтверждена",
    );
    await expect(page.getByRole("status")).not.toContainText(
      "private@example.test",
    );
    expect(writes).toBe(1);
  });
  test("malformed fragment offers no action", async ({ page }) => {
    await page.goto("/email-binding#token=" + proof + "&token=" + proof);
    await expect(
      page.getByRole("heading", { name: "Подтверждение почты" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/email-binding$/);
    await expect(
      page.getByRole("button", { name: "Подтвердить почту", exact: true }),
    ).toHaveCount(0);
  });
  test("lost confirmation response leaves an uncertain result without replay", async ({
    page,
  }) => {
    let writes = 0;
    await page.route("**/api/auth/email-bindings/confirm", (route) => {
      writes++;
      return route.abort("failed");
    });
    await page.goto("/email-binding#token=" + proof);
    await page
      .getByRole("button", { name: "Подтвердить почту", exact: true })
      .click();
    await expect(
      page.getByText("Ответ не подтверждён.", { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole("status")).not.toContainText(
      "Почта подтверждена",
    );
    await expect(
      page.getByRole("button", { name: "Подтвердить почту", exact: true }),
    ).toHaveCount(0);
    expect(writes).toBe(1);
  });
  test("pending explicit action cannot be submitted twice", async ({
    page,
  }) => {
    let writes = 0;
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/auth/email-bindings/confirm", async (route) => {
      writes++;
      await held;
      await route.fulfill({ json: { ok: true } });
    });
    await page.goto("/email-binding#token=" + proof);
    const submit = page.getByRole("button", {
      name: "Подтвердить почту",
      exact: true,
    });
    try {
      await submit.click();
      await expect(submit).toBeDisabled();
      await submit.evaluate((button: HTMLButtonElement) => button.click());
      expect(writes).toBe(1);
    } finally {
      release();
    }
    await expect(page.getByRole("status")).toContainText("Почта подтверждена");
  });
});
