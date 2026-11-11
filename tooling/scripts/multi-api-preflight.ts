// Читает приватный снимок Compose и сверяет его с ресурсами хоста и MySQL. Ошибки разбора намеренно не выводят входной файл с паролями.
import { readFile, stat } from "node:fs/promises";
import { inspectMultiApiDeployment } from "./multi-api-policy";

async function main() {
  const args = process.argv.slice(2);
  if (
    args.length !== 6 ||
    args[0] !== "--config" ||
    args[2] !== "--host-memory-mib" ||
    args[4] !== "--mysql-max-connections"
  )
    throw new Error("Invalid arguments");
  if ((await stat(args[1])).size > 4 * 1024 ** 2)
    throw new Error("Invalid config size");
  const input = JSON.parse(await readFile(args[1], "utf8"));
  const result = inspectMultiApiDeployment(input, {
    hostMemoryMiB: Number(args[3]),
    mysqlMaxConnections: Number(args[5]),
  });
  console.log(JSON.stringify(result));
  if (!result.ok) process.exitCode = 1;
}
void main().catch(() => {
  // Compose includes passwords and DB URLs. Never print parse errors or input.
  console.error(
    "Multi-API preflight failed: check arguments and private resolved config. No resources changed.",
  );
  process.exitCode = 1;
});
