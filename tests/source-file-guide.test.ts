import { expect, it } from "vitest";
import {
  buildFileGuide,
  summarizeSource,
} from "../tooling/scripts/source-file-guide";

it("documents declared blocks and their comments without publishing function bodies", () => {
  const result = summarizeSource(
    "module.ts",
    `/** Проверяем право перед записью. */
import { db } from "./database";
/** Сохраняем только после проверки версии. */
export function save(id: number) { const password = "NOT_FOR_DOCUMENTATION"; return db(id); }
export class Worker { /** Ожидаем завершения текущей задачи. */ stop() {} }
`,
  );
  expect(result.purpose).toBe("Проверяем право перед записью.");
  expect(result.blocks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: "save",
        line: 4,
        description: "Сохраняем только после проверки версии.",
      }),
      expect.objectContaining({
        name: "Worker.stop",
        description: "Ожидаем завершения текущей задачи.",
      }),
    ]),
  );
  expect(JSON.stringify(result)).not.toContain("NOT_FOR_DOCUMENTATION");
});

it("gives every file one entry, keeps history explicit and escapes Markdown paths", () => {
  const pages = buildFileGuide([
    {
      path: "apps/backend/src/payments.ts",
      text: "/** Проверяем квитанцию. */\nexport const receipt = 1;",
    },
    { path: "apps/frontend/public/a [1].webp", text: null },
    { path: "docs/archive/old.md", text: "# Старый снимок" },
  ]);
  expect(pages.get("backend.md")).toContain("Проверяем квитанцию.");
  expect(pages.get("assets-history.md")).toContain("a%20%5B1%5D.webp");
  expect(pages.get("documents.md")).toContain("Исторический");
  const combined = [...pages.values()].join("\n");
  expect(
    combined.match(/^## \[apps\/backend\/src\/payments\.ts\]/gm),
  ).toHaveLength(1);
  expect(pages.get("index.md")).toContain("не подтверждает ручной разбор");
});

it("indexes nested test scenarios and immutable migration operations as blocks", () => {
  expect(
    summarizeSource(
      "tests/access.test.ts",
      `describe("доступ", () => { it("отказ гостю", () => {}); });`,
    ).blocks,
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: "it: отказ гостю" }),
    ]),
  );
  const sql =
    "CREATE TABLE `items` (`id` int);\nALTER TABLE `items` ADD `name` text;\nINSERT INTO items VALUES ('NOT_FOR_DOCUMENTATION');";
  const pages = buildFileGuide([
    { path: "packages/database/drizzle/0000_fixture.sql", text: sql },
  ]);
  expect(pages.get("shared-database.md")).toContain("CREATE TABLE items");
  expect(pages.get("shared-database.md")).toContain("ALTER TABLE items");
  expect(pages.get("shared-database.md")).not.toContain(
    "NOT_FOR_DOCUMENTATION",
  );
});

it("reads style purpose and Python block names without executing scripts", () => {
  const pages = buildFileGuide([
    {
      path: "apps/frontend/src/long.module.scss",
      text: `/** ${"a".repeat(299)} long explanation */\n.card {}`,
    },
    {
      path: "apps/frontend/src/feed.module.scss",
      text: "/** Карточки Ленты и состояния загрузки. */\n.card {}",
    },
    {
      path: "tooling/data/fixture.py",
      text: "# Явная подготовка тестового плана.\nraise Exception('must not execute')\ndef prepare():\n  pass\n",
    },
  ]);
  expect(pages.get("frontend.md")).toContain(
    "Карточки Ленты и состояния загрузки.",
  );
  expect(pages.get("tools-infrastructure.md")).toContain("`prepare`");
  expect([...pages.values()].join("\n")).not.toMatch(/[\t ]+$/m);
});
