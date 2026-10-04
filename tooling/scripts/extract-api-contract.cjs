// Extracts the compiler's inferred wire types; never executes server code.
const fs = require("fs"),
  path = require("path");
const source = path.resolve(__dirname, "../..");
const routerPath = path.join(source, "apps/backend/src/routers.ts");
const schemaPath = path.join(source, "packages/database/src/schema.ts");
const ts = require(path.join(source, "node_modules/typescript"));
const c = ts.readConfigFile(
  path.join(source, "tsconfig.json"),
  ts.sys.readFile,
);
const options = ts.parseJsonConfigFileContent(c.config, ts.sys, source).options;
const program = ts.createProgram([routerPath], options);
const checker = program.getTypeChecker();
const file = program.getSourceFile(routerPath);
const routerSymbol = checker
  .getExportsOfModule(checker.getSymbolAtLocation(file))
  .find((s) => s.name === "AppRouter");
const router = checker.getDeclaredTypeOfSymbol(routerSymbol);
const prop = (t, n) => {
  const s = t.getProperty(n);
  if (!s) throw Error("Missing " + n);
  return checker.getTypeOfSymbolAtLocation(s, file);
};
const flags =
  ts.TypeFormatFlags.NoTruncation |
  ts.TypeFormatFlags.InTypeAlias |
  ts.TypeFormatFlags.UseStructuralFallback |
  ts.TypeFormatFlags.WriteArrayAsGenericType;
let count = 0;
function render(record, indent = "  ") {
  return (
    "{\n" +
    record
      .getProperties()
      .map((s) => {
        const type = checker.getTypeOfSymbolAtLocation(s, file);
        if (!type.getProperty("_def"))
          return (
            indent +
            JSON.stringify(s.name) +
            ": " +
            render(type, indent + "  ") +
            ";"
          );
        const d = prop(type, "_def");
        if (d.getProperty("record"))
          return (
            indent +
            JSON.stringify(s.name) +
            ": " +
            render(prop(d, "record"), indent + "  ") +
            ";"
          );
        const types = prop(d, "$types");
        const kind = checker.typeToString(prop(d, "type")).replace(/"/g, "");
        const input = checker.typeToString(prop(types, "input"), file, flags),
          output = checker.typeToString(prop(types, "output"), file, flags);
        count++;
        return (
          indent +
          JSON.stringify(s.name) +
          `: ${kind === "query" ? "QueryProcedure" : "MutationProcedure"}<{ input: ${input}; output: ${output}; meta: unknown }>;`
        );
      })
      .join("\n") +
    "\n" +
    indent.slice(2) +
    "}"
  );
}
const schema = program.getSourceFile(schemaPath);
const schemaExports = checker.getExportsOfModule(
  checker.getSymbolAtLocation(schema),
);
const aliases = new Map();
const namespaceExports = {};
for (const n of file.statements) {
  if (
    ts.isImportDeclaration(n) &&
    n.importClause?.namedBindings &&
    ts.isNamespaceImport(n.importClause.namedBindings)
  ) {
    const module = checker.getSymbolAtLocation(n.moduleSpecifier);
    if (module)
      namespaceExports[n.importClause.namedBindings.name.text] =
        checker.getExportsOfModule(module);
  }
}
function localize(text) {
  return text.replace(
    /(?:import\("([^\"]+)"\)|\b(db|platformDb))\.([A-Za-z0-9_]+)/g,
    (_, importedPath, namespace, name) => {
      if (!aliases.has(name)) {
        aliases.set(name, "");
        const symbol = (
          importedPath
            ? checker.getExportsOfModule(
                checker.getSymbolAtLocation(
                  program.getSourceFile(importedPath + ".ts") ||
                    program.getSourceFile(importedPath),
                ),
              )
            : namespace
              ? namespaceExports[namespace]
              : schemaExports
        ).find((s) => s.name === name);
        if (!symbol) throw Error(name);
        const resolvedSymbol =
          symbol.flags & ts.SymbolFlags.Alias
            ? checker.getAliasedSymbol(symbol)
            : symbol;
        const declaration = resolvedSymbol.declarations?.[0];
        const rendered =
          declaration && ts.isInterfaceDeclaration(declaration)
            ? "{" +
              declaration.members
                .map((m) => m.getText(declaration.getSourceFile()))
                .join(" ") +
              "}"
            : checker.typeToString(
                checker.getDeclaredTypeOfSymbol(resolvedSymbol),
                schema,
                flags,
              );
        aliases.set(name, localize(rendered));
      }
      return name;
    },
  );
}
const record = localize(render(prop(prop(router, "_def"), "record")));
for (const name of ["RichTextInline", "ArticleBlockType"]) {
  const symbol = schemaExports.find((s) => s.name === name);
  if (symbol) {
    const resolvedSymbol =
      symbol.flags & ts.SymbolFlags.Alias
        ? checker.getAliasedSymbol(symbol)
        : symbol;
    const declaration = resolvedSymbol.declarations?.[0];
    aliases.set(
      name,
      declaration && ts.isInterfaceDeclaration(declaration)
        ? "{" +
            declaration.members
              .map((m) => m.getText(declaration.getSourceFile()))
              .join(" ") +
            "}"
        : checker.typeToString(
            checker.getDeclaredTypeOfSymbol(resolvedSymbol),
            schema,
            flags,
          ),
    );
  }
}
const result = `// Generated from apps/backend/src/routers.ts. Run pnpm api:contract after API changes.\n// Types only; frontend has no dependency on backend runtime or folder layout.\nimport type { BuiltRouter, QueryProcedure, MutationProcedure, DefaultErrorShape } from '@trpc/server/unstable-core-do-not-import';\n${[...aliases].map(([n, t]) => "export type " + n + " = " + t + ";").join("\n")}\nexport type AppRouter = BuiltRouter<{ctx: object; meta: object; errorShape: DefaultErrorShape; transformer: true}, ${record}>;\n`;
if (/import\(/.test(result)) throw Error("Backend import remains");
const dest = path.resolve(source, "apps/frontend/src/shared/api/contract.ts");
async function writeContract() {
  const formatted = await require("prettier").format(result, {
    parser: "typescript",
  });
  if (process.argv.includes("--check")) {
    if (fs.readFileSync(dest, "utf8") !== formatted)
      throw Error("API contract is outdated; run pnpm api:contract");
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, formatted);
  }
  console.log(
    "Generated " + count + " procedures (" + formatted.length + " bytes)",
  );
}
writeContract().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
