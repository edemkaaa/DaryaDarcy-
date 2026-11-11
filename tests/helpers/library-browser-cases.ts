import { expect, it } from "vitest";
import {
  expect as browserExpect,
  type BrowserContext,
  type Response,
} from "@playwright/test";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { sdk } from "../../apps/backend/src/_core/sdk";
import { COOKIE_NAME } from "../../packages/shared/src/const";

interface LibraryBrowserFixture {
  rows(sql: string, args?: unknown[]): Promise<RowDataPacket[]>;
  connection: Pick<Connection, "query">;
  context: BrowserContext;
  frontend: string;
  memberId: number;
}

export async function ensureArticles(connection: Pick<Connection, "query">) {
  // Создаёт минимальную таблицу лишь в соединении одноразовой фикстуры; не является production-миграцией.

  await connection.query(`CREATE TABLE IF NOT EXISTS articles (
    id INT AUTO_INCREMENT PRIMARY KEY,title VARCHAR(255) NOT NULL,coverUrl TEXT,
    access ENUM('public','club') NOT NULL DEFAULT 'public',published BOOLEAN NOT NULL DEFAULT TRUE,
    sortOrder INT NOT NULL DEFAULT 0,sections JSON NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);
}

async function articleData(response: Response, id: number) {
  // Выбирает детализацию по ID внутри tRPC batch, где рядом может идти проверка подписки.

  // Subscription reads may share the same tRPC batch; select this detail by ID.
  const batch: { result?: { data?: { json?: { id?: number } } } }[] =
    await response.json();
  return batch.find((entry) => entry.result?.data?.json?.id === id)?.result
    ?.data?.json;
}

export function registerLibraryBrowserCases(
  fixture: () => LibraryBrowserFixture,
) {
  // Проверяет гостя, клубный доступ, черновик, сетевой отказ и истечение доступа на собственных статьях без изменения аккаунта.

  it("C3 opens public library articles but does not disclose club or draft bodies to guests", async () => {
    // Сценарий: Гостевой список не содержит тел клубных статей или черновиков; отсутствие материала отделено от сетевого отказа с ручным retry.

    const { rows, connection, context, frontend } = fixture();
    // Catches public listing leaking hidden rows and detail bypassing club access.
    try {
      await ensureArticles(connection);
      await connection.query(`INSERT INTO articles (id,title,access,published,sections) VALUES
        (94641,'C3 library public fixture','public',1,JSON_ARRAY(JSON_OBJECT('type','text','text','C3 public article body fixture'))),
        (94642,'C3 library club fixture','club',1,JSON_ARRAY(JSON_OBJECT('type','text','text','C3 private article body fixture'))),
        (94643,'C3 library draft fixture','public',0,JSON_ARRAY(JSON_OBJECT('type','text','text','C3 draft article body fixture')))`);
      const before = await rows(
        "SELECT * FROM articles WHERE id IN (94641,94642,94643) ORDER BY id",
      );
      await context.clearCookies();
      const page = await context.newPage();
      const listed = page.waitForResponse((response) =>
        response.url().includes("articles.list"),
      );
      await page.goto(frontend + "library");
      const listResponse = await listed;
      expect(listResponse.status()).toBe(200);
      const listBody = await listResponse.text();
      expect(listBody).toContain("C3 library public fixture");
      expect(listBody).toContain("C3 library club fixture");
      expect(listBody).not.toContain("C3 private article body fixture");
      expect(listBody).not.toContain("C3 library draft fixture");
      expect(listBody).not.toContain("C3 draft article body fixture");
      await page
        .getByPlaceholder("Поиск материалов...")
        .filter({ visible: true })
        .fill("C3 library");
      const material = page.getByRole("button", {
        name: "Открыть материал: C3 library public fixture",
        exact: true,
      });
      await browserExpect(material).toBeVisible();
      const clubCard = page.getByRole("button", {
        name: "Открыть материал: C3 library club fixture",
        exact: true,
      });
      await browserExpect(clubCard).toBeVisible();
      await browserExpect(
        clubCard.locator("..").getByText("Для участниц клуба Darcy →", {
          exact: true,
        }),
      ).toBeVisible();
      await browserExpect(
        page.getByText("C3 library draft fixture", { exact: true }),
      ).toHaveCount(0);
      const opened = page.waitForResponse((response) =>
        response.url().includes("articles.getById"),
      );
      await material.click();
      expect((await opened).status()).toBe(200);
      await browserExpect(
        page.getByText("C3 public article body fixture", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Вернуться назад", exact: true })
        .click();
      await browserExpect(material).toBeVisible();
      const locked = page.waitForResponse((response) =>
        response.url().includes("articles.getById"),
      );
      await page.goto(frontend + "library/article/94642");
      const lockedResponse = await locked;
      expect(lockedResponse.status()).toBe(200);
      expect(await lockedResponse.json()).toMatchObject([
        { result: { data: { json: { locked: true, sections: [] } } } },
      ]);
      await browserExpect(
        page.getByText("Эта статья для участниц клуба Darcy.", { exact: true }),
      ).toBeVisible();
      await browserExpect(
        page.getByText("C3 private article body fixture", { exact: true }),
      ).toHaveCount(0);
      await browserExpect(
        page.getByRole("button", { name: "Вступить в клуб", exact: true }),
      ).toBeVisible();
      const hidden = page.waitForResponse((response) =>
        response.url().includes("articles.getById"),
      );
      await page.goto(frontend + "library/article/94643");
      const hiddenResponse = await hidden;
      expect(hiddenResponse.status()).toBe(200);
      expect(await hiddenResponse.text()).not.toContain(
        "C3 draft article body fixture",
      );
      await browserExpect(
        page.getByText("Статья не найдена", { exact: true }),
      ).toBeVisible();
      await browserExpect(
        page.getByText("C3 draft article body fixture", { exact: true }),
      ).toHaveCount(0);
      await browserExpect(
        page.getByRole("button", { name: "Повторить", exact: true }),
      ).toHaveCount(0);
      const missing = page.waitForResponse((response) =>
        response.url().includes("articles.getById"),
      );
      await page.goto(frontend + "library/article/94644");
      expect((await missing).status()).toBe(200);
      await browserExpect(
        page.getByText("Статья не найдена", { exact: true }),
      ).toBeVisible();
      await browserExpect(
        page.getByRole("button", { name: "Повторить", exact: true }),
      ).toHaveCount(0);
      // A network failure must not be normalized to a successful missing result.
      await page.route("**/api/trpc/*", async (route) => {
        if (route.request().url().includes("articles.getById"))
          await route.abort("failed");
        else await route.fallback();
      });
      await page.goto(frontend + "library/article/94641");
      await browserExpect(
        page.getByRole("button", { name: "Повторить", exact: true }),
      ).toBeVisible();
      await browserExpect(
        page.getByText("Статья не найдена", { exact: true }),
      ).toHaveCount(0);
      await page.unrouteAll({ behavior: "wait" });
      const recovered = page.waitForResponse((response) =>
        response.url().includes("articles.getById"),
      );
      await page
        .getByRole("button", { name: "Повторить", exact: true })
        .click();
      expect((await recovered).status()).toBe(200);
      await browserExpect(
        page.getByText("C3 public article body fixture", { exact: true }),
      ).toBeVisible();
      expect(
        await rows(
          "SELECT * FROM articles WHERE id IN (94641,94642,94643) ORDER BY id",
        ),
      ).toEqual(before);
    } finally {
      await connection.query(
        "DELETE FROM articles WHERE id IN (94641,94642,94643) AND title LIKE 'C3 library % fixture'",
      );
    }
  }, 30_000);
  it("C3 reloads a paid club article and removes its body after access expiry without changing identity", async () => {
    // Сценарий: Платный читатель получает статью после reload; истечение только синтетического доступа убирает тело, сохраняя статью и личность.

    const { rows, connection, context, frontend, memberId } = fixture();
    const articleSql = "SELECT * FROM articles WHERE id=94645";
    const identitySql =
      "SELECT id,email,passwordHash,role,sessionVersion FROM users WHERE id=?";
    const paymentSql =
      "SELECT * FROM club_payments WHERE userId=? AND orderId='c3-library-reader-access'";
    // Catches denied paid reads, stale unlocked content after reload, and expiry bypass.
    try {
      await ensureArticles(connection);
      await connection.query(`INSERT INTO articles (id,title,access,published,sections) VALUES
        (94645,'C3 paid library fixture','club',1,JSON_ARRAY(JSON_OBJECT('type','text','text','C3 paid article body fixture')))`);
      await connection.query(
        "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'c3-library-reader-access','paid','0','2030-01-01')",
        [memberId],
      );
      const article = await rows(articleSql);
      const identity = await rows(identitySql, [memberId]);
      const payment = await rows(paymentSql, [memberId]);
      await context.clearCookies();
      await context.addCookies([
        {
          name: COOKIE_NAME,
          value: await sdk.createSessionToken("binding-browser-member", {
            sessionVersion: 0,
          }),
          url: frontend,
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      const page = await context.newPage();
      const read = () =>
        /* Ожидает конкретный ответ детализации статьи, а не случайную параллельную проверку подписки. */ page.waitForResponse((response) =>
          response.url().includes("articles.getById"),
        );
      const opened = read();
      await page.goto(frontend + "library/article/94645");
      const response = await opened;
      expect(response.status()).toBe(200);
      expect(await articleData(response, 94645)).toMatchObject({
        id: 94645,
        locked: false,
        sections: [{ type: "text", text: "C3 paid article body fixture" }],
      });
      await browserExpect(
        page.getByText("C3 paid article body fixture", { exact: true }),
      ).toBeVisible();
      const reloaded = read();
      await page.reload();
      expect((await reloaded).status()).toBe(200);
      await browserExpect(
        page.getByText("C3 paid article body fixture", { exact: true }),
      ).toBeVisible();
      expect(await rows(paymentSql, [memberId])).toEqual(payment);
      // Expire only this synthetic entitlement; no wall-clock or provider writes.
      await connection.query(
        "UPDATE club_payments SET expiresAt='2020-01-01' WHERE userId=? AND orderId='c3-library-reader-access'",
        [memberId],
      );
      const expiredPayment = await rows(paymentSql, [memberId]);
      const expired = read();
      await page.reload();
      const expiredResponse = await expired;
      expect(expiredResponse.status()).toBe(200);
      expect(await articleData(expiredResponse, 94645)).toMatchObject({
        id: 94645,
        locked: true,
        sections: [],
      });
      await browserExpect(
        page.getByText("Эта статья для участниц клуба Darcy.", { exact: true }),
      ).toBeVisible();
      await browserExpect(
        page.getByText("C3 paid article body fixture", { exact: true }),
      ).toHaveCount(0);
      expect(await rows(articleSql)).toEqual(article);
      expect(await rows(identitySql, [memberId])).toEqual(identity);
      expect(await rows(paymentSql, [memberId])).toEqual(expiredPayment);
    } finally {
      await connection.query(
        "DELETE FROM articles WHERE id=94645 AND title='C3 paid library fixture'",
      );
      await connection.query(
        "DELETE FROM club_payments WHERE userId=? AND orderId='c3-library-reader-access'",
        [memberId],
      );
    }
  }, 30_000);
}
