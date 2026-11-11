/** Справочник строится по Git-инвентарю и объявлениям исходников, без выполнения кода. */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

type FileEntry = { path: string; text: string | null };
type Block = { name: string; line: number; description: string };
const destination = "docs/development/file-guide";
const groups = {
  "backend.md": "Бэкенд",
  "frontend.md": "Фронтенд",
  "shared-database.md": "Общие контракты и база данных",
  "tools-infrastructure.md": "Инструменты и инфраструктура",
  "tests.md": "Тесты и фикстуры",
  "documents.md": "Документы и планы",
  "assets-history.md": "Ресурсы и прежние клиенты",
  "root.md": "Настройки корня репозитория",
} as const;
type Group = keyof typeof groups;
const sourcePattern = /\.(?:[cm]?tsx?|[cm]?jsx?)$/;
const otherTextPattern = /\.(?:s?css|py|sh|conf|toml|ya?ml)$/;

function commentText(raw: string): string {
  return raw
    .replace(/^\/\*+|\*\/$/g, "")
    .split("\n")
    .map((line) => line.replace(/^\s*(?:\*|\/\/)?\s?/, "").trim())
    .filter((line) => line && !line.startsWith("@"))
    .join(" ")
    .slice(0, 300);
}

/** Фиксируем имена и пояснения блоков; тела функций и значения переменных не публикуем. */
export function summarizeSource(
  file: string,
  text: string,
): { purpose: string | null; blocks: Block[] } {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const header = ts
    .getLeadingCommentRanges(text, 0)
    ?.map((range) => commentText(text.slice(range.pos, range.end)))
    .find(
      (value) =>
        value &&
        !/eslint|@license|copyright|reference path|auto.generated/i.test(value),
    );
  const blocks: Block[] = [];
  const add = (node: ts.Node, name: string, kind: string) => {
    const docs = ts.getJSDocCommentsAndTags(node).filter(ts.isJSDoc);
    const leading = text.slice(node.getFullStart(), node.getStart(source));
    const inlineDoc = [...leading.matchAll(/\/\*\*[\s\S]*?\*\//g)].at(-1)?.[0];
    const explanation =
      docs
        .map((doc) => ts.getTextOfJSDocComment(doc.comment) || "")
        .filter(Boolean)
        .join(" ") || (inlineDoc ? commentText(inlineDoc) : "");
    blocks.push({
      name,
      line:
        source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      description:
        explanation || `${kind}. Подробности и ограничения — в исходнике.`,
    });
  };
  for (const node of source.statements) {
    if (ts.isFunctionDeclaration(node))
      add(node, node.name?.text || "default", "Функция");
    else if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node))
      add(node, node.name.text, "Контракт типов");
    else if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations)
        add(
          node,
          declaration.name.getText(source),
          declaration.initializer &&
            (ts.isArrowFunction(declaration.initializer) ||
              ts.isFunctionExpression(declaration.initializer))
            ? "Функция"
            : "Объявление данных или схемы",
        );
    } else if (ts.isClassDeclaration(node)) {
      const name = node.name?.text || "default";
      add(node, name, "Класс");
      for (const member of node.members) {
        if (
          ts.isMethodDeclaration(member) ||
          ts.isGetAccessor(member) ||
          ts.isSetAccessor(member)
        )
          add(member, `${name}.${member.name.getText(source)}`, "Метод");
        else if (ts.isConstructorDeclaration(member))
          add(member, `${name}.constructor`, "Настройка зависимостей");
      }
    }
  }
  // В тестах смысловым блоком также является сценарий внутри describe/it.each.
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.parent !== source && node.name)
      add(node, node.name.text, "Вложенная функция");
    if (
      ts.isCallExpression(node) &&
      /(?:^|\/)(?:[^/]*\.test\.[cm]?tsx?|e2e\/)/.test(file)
    ) {
      let expression: ts.Expression = node.expression;
      while (
        ts.isCallExpression(expression) ||
        ts.isPropertyAccessExpression(expression)
      )
        expression = expression.expression;
      const title = node.arguments[0];
      if (
        ts.isIdentifier(expression) &&
        ["describe", "it", "test"].includes(expression.text) &&
        title &&
        (ts.isStringLiteral(title) || ts.isNoSubstitutionTemplateLiteral(title))
      )
        add(node, `${expression.text}: ${title.text}`, "Проверочный сценарий");
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return { purpose: header || null, blocks };
}

/** SQL-историю только читаем: описываем именованные DDL-операции без изменения их хешей. */
function sqlBlocks(text: string): Block[] {
  const result: Block[] = [];
  for (const match of text.matchAll(
    /\b(CREATE|ALTER|DROP)\s+(TABLE|(?:UNIQUE\s+)?INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+|IF\s+EXISTS\s+)?`?([\w]+)`?/gi,
  )) {
    result.push({
      name: `${match[1].toUpperCase()} ${match[2].toUpperCase()} ${match[3]}`,
      line: text.slice(0, match.index).split("\n").length,
      description:
        "Шаг изменения схемы. Применение и проверка истории выполняются отдельными командами миграций.",
    });
  }
  return result;
}

/** Имена Python/shell-блоков извлекаем как текст: импорт опасного инструмента не нужен. */
function scriptBlocks(file: string, text: string): Block[] {
  const result: Block[] = [];
  const pattern = file.endsWith(".py")
    ? /^\s*(?:async\s+)?(?:def|class)\s+(\w+)/gm
    : /^\s*(?:function\s+)?([\w-]+)\s*\(\)\s*\{/gm;
  for (const match of text.matchAll(pattern))
    result.push({
      name: match[1],
      line: text.slice(0, match.index).split("\n").length,
      description:
        "Именованный блок инструмента. Побочные эффекты и условия запуска проверяются в исходнике.",
    });
  return result;
}

function groupFor(file: string): Group {
  if (
    /^(tests|__tests__)\//.test(file) ||
    /^apps\/frontend\/(e2e|scripts)\//.test(file)
  )
    return "tests.md";
  if (
    file.startsWith("docs/") ||
    file.startsWith("tasks/") ||
    /^SPEC-.*\.md$/.test(file)
  )
    return "documents.md";
  if (/^apps\/legacy-|^tooling\/legacy\/|^apps\/frontend\/public\//.test(file))
    return "assets-history.md";
  if (file.startsWith("apps/backend/")) return "backend.md";
  if (file.startsWith("apps/frontend/")) return "frontend.md";
  if (file.startsWith("packages/")) return "shared-database.md";
  if (/^(tooling|infrastructure|apps\/video-service)\//.test(file))
    return "tools-infrastructure.md";
  return "root.md";
}

function purposeFor(file: FileEntry): string {
  const name = path.posix.basename(file.path);
  if (file.path.startsWith(`${destination}/`))
    return "Сгенерированная навигация по файлам; обновляется командой pnpm docs:files.";
  if (/^docs\/(archive|audits\/archive)\//.test(file.path))
    return "Исторический материал. Сохраняет прежние требования или доказательства; не является инструкцией текущего выпуска.";
  if (/^apps\/legacy-|^tooling\/legacy\//.test(file.path))
    return "Прежний клиент или инструмент. Сохранён для совместимости и истории; назначение исполнения проверять отдельно.";
  if (sourcePattern.test(file.path) && file.text !== null) {
    const source = summarizeSource(file.path, file.text);
    return (
      source.purpose ||
      `Модуль ${name}; объявления и смысловые границы перечислены ниже.`
    );
  }
  if (
    file.text !== null &&
    (otherTextPattern.test(name) || /Dockerfile/.test(name))
  ) {
    const text = file.text.replace(/^#![^\n]*\n/, "");
    const block = /^\s*(\/\*[\s\S]*?\*\/)/.exec(text)?.[1];
    if (block) return commentText(block);
    const comments = text
      .split("\n")
      .slice(0, 8)
      .filter(
        (line) => /^\s*#\s+/.test(line) && !/shellcheck|coding[:=]/.test(line),
      );
    if (comments.length)
      return comments
        .map((line) => line.replace(/^\s*#\s+/, ""))
        .join(" ")
        .slice(0, 300);
  }
  if (/\.md$/.test(name) && file.text !== null) {
    const title = file.text
      .split("\n")
      .find((line) => /^#\s+/.test(line))
      ?.replace(/^#\s+/, "");
    const status = /\d{4}-\d{2}-\d{2}/.test(name)
      ? "Датированный документ: проверяйте дату и пометки статуса."
      : "Инструкция или навигация по проекту.";
    return `${title || name}. ${status}`;
  }
  if (/packages\/database\/drizzle\/.+\.sql$/.test(file.path))
    return "Шаг истории схемы MySQL. Не изменять уже применённый SQL при уборке или комментировании.";
  if (/packages\/database\/drizzle\/meta\//.test(file.path))
    return "Метаданные истории Drizzle; нужны для сопоставления миграций и не являются временным кэшем.";
  if (name === "package.json")
    return "Зависимости и команды соответствующего workspace; источник допустимых способов запуска.";
  if (/lock\.(yaml|json)$/.test(name))
    return "Зафиксированные версии зависимостей. Обновляется пакетным менеджером, не редактируется как документация.";
  if (name === ".env.example")
    return "Шаблон настроек без рабочих секретов. Значения примеров не доказывают готовность внешних интеграций.";
  if (/^\.env|\.(?:pem|key|sql\.gz)$/.test(name))
    return "Чувствительный или операционный файл: содержимое в справочник не включается.";
  if (
    /\.(?:png|jpe?g|webp|gif|svg|avif|ico|mp[34]|woff2?|ttf|otf|pdf)$/i.test(
      name,
    )
  )
    return "Статический ресурс по указанному пути. Ссылки могут формироваться динамически; отсутствие import не доказывает ненужность.";
  if (/\.s?css$/.test(name))
    return "Стили интерфейса или визуальные токены; порядок правил и селекторы влияют на отображение.";
  if (/\.json$/.test(name))
    return "Структурированные данные или настройки. Содержимое не выполняется и не переписывается генератором.";
  if (/\.py$/.test(name))
    return "Python-инструмент; побочные эффекты и параметры запуска описаны в его комментариях и README.";
  if (/\.sh$/.test(name))
    return "Shell-сценарий; запускать только после проверки его окружения и назначения.";
  if (/Dockerfile/.test(name))
    return "Рецепт контейнерного образа; сборка и рабочий запуск — отдельные операции.";
  if (/\.(?:ya?ml|conf)$/.test(name))
    return "Конфигурация сборки, проверки или инфраструктуры; наличие файла не означает применение на сервере.";
  return "Служебный файл проекта; назначение уточняется по каталогу и связанному README.";
}

const clean = (value: string) =>
  value
    .replace(/\|/g, "\\|")
    .replace(/[\r\n]+/g, " ")
    .replace(/`/g, "'")
    .trim();
function fileLink(file: string) {
  const relative = path.posix
    .relative(destination, file)
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  return `[${clean(file).replace(/[\[\]]/g, "\\$&")}](${relative})`;
}

/** Каждый путь попадает в один раздел. Сгенерированные страницы описывают себя без чтения своих тел. */
export function buildFileGuide(files: FileEntry[]): Map<string, string> {
  const sorted = [
    ...new Map(files.map((entry) => [entry.path, entry])).values(),
  ].sort((a, b) => a.path.localeCompare(b.path, "en"));
  const pages = new Map<string, string>();
  for (const [group, title] of Object.entries(groups)) {
    const members = sorted.filter((entry) => groupFor(entry.path) === group);
    const lines = [
      `# ${title}: файлы и блоки`,
      "",
      "Справочник извлечён из путей, комментариев и объявлений. Он не подтверждает ручной разбор каждого блока или готовность выпуска.",
      "",
      "[Общая карта](index.md)",
      "",
    ];
    for (const entry of members) {
      lines.push(
        `## ${fileLink(entry.path)}`,
        "",
        clean(purposeFor(entry)),
        "",
      );
      if (
        (sourcePattern.test(entry.path) ||
          /packages\/database\/drizzle\/.+\.sql$/.test(entry.path) ||
          /\.(?:py|sh)$/.test(entry.path)) &&
        entry.text !== null
      ) {
        const blocks = entry.path.endsWith(".sql")
          ? sqlBlocks(entry.text)
          : /\.(?:py|sh)$/.test(entry.path)
            ? scriptBlocks(entry.path, entry.text)
            : summarizeSource(entry.path, entry.text).blocks;
        if (blocks.length) {
          lines.push("| Блок | Строка | Назначение |", "| --- | --- | --- |");
          for (const block of blocks)
            lines.push(
              `| \`${clean(block.name)}\` | ${block.line} | ${clean(block.description)} |`,
            );
          lines.push("");
        }
      }
    }
    pages.set(group, lines.join("\n"));
  }
  pages.set(
    "index.md",
    [
      "# Справочник файлов Daryadarcy",
      "",
      "Назначение файлов и карта объявленных блоков. Справочник не подтверждает ручной разбор всех строк, отсутствие ошибок или готовность production.",
      "",
      `В Git-инвентаре: **${sorted.length} файлов**. Секреты, зависимости и игнорируемые сборки не читаются как исходники.`,
      "",
      "Обновление: `pnpm docs:files`. Проверка актуальности: `pnpm check:files`. Человеческие пояснения находятся в исходниках; таблицы и номера строк извлекаются автоматически.",
      "",
      ...Object.entries(groups).map(
        ([group, title]) =>
          `- [${title}](${group}) — ${sorted.filter((entry) => groupFor(entry.path) === group).length} файлов.`,
      ),
      "",
      "Новые статические ресурсы и исторические материалы тоже перечислены. Ни генератор, ни отсутствие import не дают разрешения удалять файл.",
      "",
    ].join("\n"),
  );
  return pages;
}

/** CLI читает только Git-инвентарь; записи ограничены каталогом справочника. */
function main() {
  const mode = process.argv[2];
  if (!["--write", "--check"].includes(mode) || process.argv.length !== 3)
    throw new Error("Use --write or --check");
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const paths = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8" },
  )
    .split("\0")
    .filter(Boolean);
  // Добавляем будущие страницы до первого создания, чтобы повторная генерация была стабильной.
  for (const name of [...Object.keys(groups), "index.md"])
    paths.push(`${destination}/${name}`);
  const files: FileEntry[] = [];
  for (const file of new Set(paths)) {
    const generated = file.startsWith(`${destination}/`);
    const full = path.join(root, file);
    if (!generated && (!fs.existsSync(full) || !fs.lstatSync(full).isFile()))
      continue;
    const readable =
      !generated &&
      (sourcePattern.test(file) ||
        otherTextPattern.test(file) ||
        /Dockerfile/.test(file) ||
        file.endsWith(".md") ||
        /packages\/database\/drizzle\/.+\.sql$/.test(file));
    files.push({
      path: file,
      text: readable ? fs.readFileSync(full, "utf8") : null,
    });
  }
  const folder = path.join(root, destination);
  if (fs.existsSync(folder) && fs.lstatSync(folder).isSymbolicLink())
    throw new Error("Guide directory must not be a symlink");
  if (mode === "--write") fs.mkdirSync(folder, { recursive: true });
  const outdated: string[] = [];
  for (const [name, content] of buildFileGuide(files)) {
    const target = path.join(folder, name);
    if (fs.existsSync(target) && !fs.lstatSync(target).isFile())
      throw new Error("Guide target must be a regular file");
    if (mode === "--write") fs.writeFileSync(target, content);
    else if (
      !fs.existsSync(target) ||
      fs.readFileSync(target, "utf8") !== content
    )
      outdated.push(name);
  }
  if (outdated.length) {
    console.error(`File guide is outdated: ${outdated.join(", ")}`);
    process.exitCode = 1;
  } else
    console.log(
      `File guide ${mode === "--write" ? "written" : "verified"}: ${files.length} paths`,
    );
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main();
