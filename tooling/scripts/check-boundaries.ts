// Определяет слой по пути импорта и проверяет допустимость зависимости. Это проверка архитектурных границ, а не выполнение импортируемых модулей.
import ts from "typescript";
import { builtinModules } from "node:module";
import { dirname, relative, resolve, sep } from "node:path";

const layers = ["apps/frontend", "apps/backend", "apps/video-service", "apps/legacy-web", "packages/shared", "packages/database", "infrastructure", "tooling"];
function layer(path: string) {
  // Относит нормализованный путь к известному слою по границе каталога, а не похожему префиксу имени.
 return layers.find(value => path === value || path.startsWith(`${value}/`)); }

/** Check actual syntax, including export/dynamic import/require, not source grep. */
export function inspectBoundary(file: string, source: string, root: string): string[] {
  // Разбирает реальные формы import/export/require и применяет допустимые зависимости, не выполняя импортируемые модули.

  const normalized = (path: string) => /* Приводит путь к одному относительному виду независимо от разделителя ОС для сопоставления архитектурных правил. */ relative(root, path).split(sep).join("/");
  const owner = layer(normalized(file));
  if (!owner) return [];
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const violations: string[] = [];
  function check(specifier: string, node: ts.Node, routerTypeOnly = false) {
    // Разрешает aliases в слой назначения и учитывает только узкие согласованные исключения type-only AppRouter и конфигурации сборки.

    let targetPath: string | undefined;
    if (specifier.startsWith(".")) targetPath = resolve(dirname(file), specifier);
    else if (specifier.startsWith("@shared/")) targetPath = resolve(root, "packages/shared/src", specifier.slice(8));
    else if (specifier.startsWith("@/")) targetPath = resolve(root, "apps/frontend/src", specifier.slice(2));
    else if (specifier.startsWith("@daryadarcy/")) {
      const [name, ...rest] = specifier.slice(12).split("/");
      const base = ["shared", "database"].includes(name) ? "packages" : "apps";
      targetPath = resolve(root, base, name, "src", ...rest);
    }
    const target = targetPath && layer(normalized(targetPath));
    const allowed = owner === "packages/shared" ? ["packages/shared"] :
      owner === "packages/database" ? ["packages/database", "packages/shared"] :
      owner === "apps/backend" ? ["apps/backend", "packages/database", "packages/shared"] :
      [owner, "packages/shared"];
    const neutralViolation = owner === "packages/shared" && builtinModules.includes(specifier.replace(/^node:/, ""));
    const canonicalRouterType = ["apps/frontend", "apps/legacy-web"].includes(owner!) && targetPath &&
      normalized(targetPath).replace(/\.[cm]?[jt]s$/, "") === "apps/backend/src/routers" && routerTypeOnly;
    const buildConfiguration = normalized(file) === "apps/frontend/app.config.ts" && targetPath && normalized(targetPath) === "tooling/scripts/load-env.js";
    if (neutralViolation || (target && !allowed.includes(target) && !canonicalRouterType && !buildConfiguration)) {
      const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
      violations.push(`${normalized(file)}:${line}: ${owner} cannot import ${specifier}`);
    }
  }
  function visit(node: ts.Node) {
    // Обходит синтаксические формы зависимостей; нестроковый динамический импорт требует отдельного ревью вместо молчаливого пропуска.

    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      const onlyRouter = Boolean(clause && !clause.name && bindings && ts.isNamedImports(bindings) && bindings.elements.length === 1 &&
        (bindings.elements[0].propertyName ?? bindings.elements[0].name).text === "AppRouter" && (clause.isTypeOnly || bindings.elements[0].isTypeOnly));
      check(node.moduleSpecifier.text, node, onlyRouter);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      check(node.moduleSpecifier.text, node);
    } else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
      if (node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) check(node.arguments[0].text, node);
      else violations.push(`${normalized(file)}: nonliteral module reference requires explicit review`);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal)) {
      check(node.argument.literal.text, node, !node.isTypeOf && node.qualifier?.getText(ast) === "AppRouter");
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression)) {
      check(node.moduleReference.expression.text, node);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return violations;
}
