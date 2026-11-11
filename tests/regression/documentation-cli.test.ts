/** Проверяем настоящий CLI ссылок в отдельном Git-репозитории, не затрагивая рабочий индекс проекта. */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
const tsx = path.join(root, "node_modules/.bin/tsx");
let sandbox: string;
/** Создаём собственный Git-корень и копируем только scanner с его зависимостью; незакоммиченные файлы входят в проверяемый инвентарь. */
beforeEach(() => {
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "daryadarcy-doc-test-"));
  execFileSync("git", ["init", "--quiet"], { cwd: sandbox });
  fs.mkdirSync(path.join(sandbox, "tooling/scripts"), { recursive: true });
  for (const file of ["check-docs.ts", "documentation-links.ts"]) {
    fs.copyFileSync(
      path.join(root, "tooling/scripts", file),
      path.join(sandbox, "tooling/scripts", file),
    );
  }
});
/** Удаляем лишь созданную тестом временную папку. */
afterEach(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});
/** Запускаем scanner отдельным процессом с cwd тестового репозитория и читаем код завершения. */
const check = () =>
  spawnSync(tsx, [path.join(sandbox, "tooling/scripts/check-docs.ts")], {
    cwd: sandbox,
    encoding: "utf8",
  });
/** Создаём локальную фикстуру документа вместе с родительскими каталогами. */
const write = (file: string, text: string) => {
  const full = path.join(sandbox, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
};

/** Проверяем поведение команды на файловой системе и в Git, а не только чистую функцию разбора Markdown. */
describe("documentation command in an isolated Git repository", () => {
  /** Навигация по сборке и тестам проверяется так же, как документация приложения. */
  it("checks infrastructure and test navigation readmes", () => {
    for (const file of ["infrastructure/build/README.md", "tests/README.md"]) {
      write(file, "[Missing](missing.md)");
      const result = check();
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(file);
      write(file, "# Navigation");
    }
    expect(check().status).toBe(0);
  });

  /** Битая ссылка должна обнаруживаться до git add и исчезать после создания целевого документа. */
  it("checks untracked docs, fails on a missing file and passes after correction", () => {
    write("README.md", "[Guide](docs/workflow.md)");
    const failed = check();
    expect(failed.status).toBe(1);
    expect(failed.stderr).toContain(
      "README.md:1: missing-target: docs/workflow.md",
    );
    write("docs/workflow.md", "# Workflow");
    expect(check().status).toBe(0);
  });

  /** Старые доказательства не переписываем, но входной README архива обязан иметь рабочие ссылки. */
  it("excludes archive content but checks its navigation entry point", () => {
    write("README.md", "# Project");
    write("docs/archive/history.md", "[Missing](../../old-file.md)");
    expect(check().status).toBe(0);
    write("docs/archive/README.md", "[Missing](../../old-file.md)");
    expect(check().status).toBe(1);
  });

  /** Локальный игнорируемый результат не заменяет файл репозитория; удалённый unstaged документ не должен ронять scanner. */
  it("does not accept ignored generated files as committed link targets", () => {
    write(".gitignore", "tmp/\n");
    write("README.md", "[Output](tmp/generated.md)");
    write("tmp/generated.md", "# Local only");
    expect(check().status).toBe(1);
    execFileSync("git", ["add", "README.md", ".gitignore"], { cwd: sandbox });
    fs.unlinkSync(path.join(sandbox, "README.md"));
    // A deletion pending staging must not crash the scanner.
    expect(check().status).toBe(0);
  });
});
