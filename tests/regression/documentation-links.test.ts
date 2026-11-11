/** Проверяем локальные Markdown-ссылки относительно Git-инвентаря без сетевых запросов. */
import { describe, expect, it } from "vitest";
import { checkDocumentationLinks } from "../../tooling/scripts/documentation-links";

const files = new Set([
  "README.md",
  "docs/README.md",
  "docs/development/workflow.md",
  "docs/architecture/api.md",
  "docs/reference/a file.md",
  "docs/reference/picture.png",
  "apps/frontend/app/(tabs)/index.tsx",
  "packages/database/src/schema.ts",
]);

/** Фиксированный набор путей отделяет правила разбора ссылки от реального состояния диска. */
describe("documentation file links", () => {
  /** Диагностика должна указывать исходный документ, строку и отсутствующую цель. */
  it("reports a missing document with its source line", () => {
    expect(
      checkDocumentationLinks(
        "README.md",
        "# Intro\n\n[API](docs/OLD-API.md)",
        files,
      ),
    ).toEqual([
      {
        file: "README.md",
        line: 3,
        target: "docs/OLD-API.md",
        reason: "missing-target",
      },
    ]);
  });

  /** Проверяем относительные переходы между папками и к общей SQL-схеме. */
  it("accepts the same document after its link is rebased", () => {
    expect(
      checkDocumentationLinks(
        "docs/development/workflow.md",
        "[API](../architecture/api.md)\n[Schema](../../packages/database/src/schema.ts)",
        files,
      ),
    ).toEqual([]);
  });

  /** Ссылка на папку допустима по наличию вложенных путей, а не по завершающему слешу. */
  it("accepts a directory only when the inventory contains its children", () => {
    expect(
      checkDocumentationLinks(
        "README.md",
        "[Docs](docs/)\n[Empty](absent/)",
        files,
      ),
    ).toEqual([
      {
        file: "README.md",
        line: 2,
        target: "absent/",
        reason: "missing-target",
      },
    ]);
  });

  /** Изображения и вынесенные определения ссылок проходят тот же контроль существования. */
  it("supports images and reference definitions", () => {
    expect(
      checkDocumentationLinks(
        "README.md",
        '![Screenshot](docs/reference/picture.png)\n[Read][guide]\n[guide]: docs/MISSING.md "Title"',
        files,
      ),
    ).toEqual([
      {
        file: "README.md",
        line: 3,
        target: "docs/MISSING.md",
        reason: "missing-target",
      },
    ]);
  });

  /** Пробелы, заголовки и URL-суффиксы не должны искажать путь к файлу. */
  it("supports angles, percent-encoded spaces, titles, query and fragment", () => {
    expect(
      checkDocumentationLinks(
        "README.md",
        '[One](<docs/reference/a file.md> "Title")\n[Two](docs/reference/a%20file.md?view=source#intro)',
        files,
      ),
    ).toEqual([]);
  });

  /** Скобки группы маршрута являются частью пути, поэтому их нельзя принять за конец Markdown-ссылки. */
  it("supports balanced parentheses in Expo route paths", () => {
    expect(
      checkDocumentationLinks(
        "README.md",
        "[Screen](apps/frontend/app/(tabs)/index.tsx)",
        files,
      ),
    ).toEqual([]);
    expect(
      checkDocumentationLinks(
        "README.md",
        "[Screen](apps/frontend/app/(tabs)/missing.tsx)",
        files,
      ),
    ).toEqual([
      {
        file: "README.md",
        line: 1,
        target: "apps/frontend/app/(tabs)/missing.tsx",
        reason: "missing-target",
      },
    ]);
  });

  /** Относительный переход за Git-корень остаётся ошибкой даже при существовании внешнего файла. */
  it("rejects links outside the repository", () => {
    expect(
      checkDocumentationLinks(
        "docs/README.md",
        "[Secret](../../outside.md)",
        files,
      ),
    ).toEqual([
      {
        file: "docs/README.md",
        line: 1,
        target: "../../outside.md",
        reason: "outside-repository",
      },
    ]);
  });

  /** Начальный слеш трактуется относительно репозитория, не корня файловой системы. */
  it("accepts repository-root paths", () => {
    expect(
      checkDocumentationLinks(
        "docs/development/workflow.md",
        "[Root](/README.md)",
        files,
      ),
    ).toEqual([]);
  });

  /** Внешние URL, почта и якоря не относятся к локальному файловому инвентарю. */
  it("does not fetch URLs or treat headings as file paths", () => {
    expect(
      checkDocumentationLinks(
        "README.md",
        "[Web](https://example.invalid/missing)\n[Mail](mailto:user@example.invalid)\n[Anchor](#intro)\n[Host](//example.invalid/file)",
        files,
      ),
    ).toEqual([]);
  });

  /** Примеры кода исключаем из поиска ссылок, сохраняя точные строки настоящей ошибки. */
  it("ignores fenced examples and inline code but preserves line numbers", () => {
    const source =
      "~~~md\n[Example](missing.md)\n~~~\n`[Example](missing.md)`\n[Broken](missing.md)";
    expect(checkDocumentationLinks("README.md", source, files)).toEqual([
      {
        file: "README.md",
        line: 5,
        target: "missing.md",
        reason: "missing-target",
      },
    ]);
  });

  /** Неверное percent-кодирование даёт отдельную диагностику и не прерывает остальные ссылки. */
  it("handles bad encoding without crashing the rest of the scan", () => {
    expect(
      checkDocumentationLinks(
        "README.md",
        "[Bad](docs/%ZZ.md)\n[Good](docs/README.md)",
        files,
      ),
    ).toEqual([
      {
        file: "README.md",
        line: 1,
        target: "docs/%ZZ.md",
        reason: "invalid-encoding",
      },
    ]);
  });
});
