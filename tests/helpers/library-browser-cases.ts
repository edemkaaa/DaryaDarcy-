import { expect, it } from "vitest";
import { expect as browserExpect, type BrowserContext } from "@playwright/test";
import type { Connection, RowDataPacket } from "mysql2/promise";

interface LibraryBrowserFixture {
  rows(sql: string, args?: unknown[]): Promise<RowDataPacket[]>;
  connection: Pick<Connection, "query">;
  context: BrowserContext;
  frontend: string;
}

export function registerLibraryBrowserCases(
  fixture: () => LibraryBrowserFixture,
) {
  it("C3 opens public library articles but does not disclose club or draft bodies to guests", async () => {
    const { rows, connection, context, frontend } = fixture();
    // Catches public listing leaking hidden rows and detail bypassing club access.
    try {
      await connection.query(`CREATE TABLE IF NOT EXISTS articles (
        id INT AUTO_INCREMENT PRIMARY KEY,title VARCHAR(255) NOT NULL,coverUrl TEXT,
        access ENUM('public','club') NOT NULL DEFAULT 'public',published BOOLEAN NOT NULL DEFAULT TRUE,
        sortOrder INT NOT NULL DEFAULT 0,sections JSON NOT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB`);
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
      expect((await listed).status()).toBe(200);
      await page
        .getByPlaceholder("Поиск материалов...")
        .filter({ visible: true })
        .fill("C3 library");
      const material = page.getByRole("button", {
        name: "Открыть материал: C3 library public fixture",
        exact: true,
      });
      await browserExpect(material).toBeVisible();
      await browserExpect(
        page.getByText("C3 library club fixture", { exact: true }),
      ).toHaveCount(0);
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
      await page.getByRole("button", { name: "← Назад", exact: true }).click();
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
      // Existing undefined detail becomes a query error, not the intended not-found
      // state. Record that UI limitation separately; only the disclosure gate is
      // accepted here, and the failure must still be explicit rather than blank.
      await browserExpect(
        page.getByRole("button", { name: "Повторить", exact: true }),
      ).toBeVisible();
      await browserExpect(
        page.getByText("C3 draft article body fixture", { exact: true }),
      ).toHaveCount(0);
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
}
