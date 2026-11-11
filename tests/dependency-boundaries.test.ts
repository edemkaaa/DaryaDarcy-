/** Проверяем AST-политику зависимостей workspaces на синтетических import/re-export/require/dynamic-import строках. */
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { inspectBoundary } from "../tooling/scripts/check-boundaries";
const root = resolve(".");
/** Нормализует путь фикстуры относительно Git-корня и вызывает чистую проверку границы. */
function check(file: string, source: string) { return inspectBoundary(resolve(root, file), source, root); }
/** Контракты общего пакета и type-only API-граница отделены от серверного runtime и инфраструктуры. */
describe("enforced workspace dependency direction", () => {
  /** Запрещённое направление должно дать ровно одну диагностику, включая type-import SQL-модели и dynamic import. */
  it.each([
    ["apps/frontend/lib/test.ts", 'import { getDb } from "../../backend/src/db";'],
    ["apps/frontend/lib/test.ts", 'import type { User } from "../../../packages/database/src/schema";'],
    ["packages/shared/src/test.ts", 'export { getDb } from "../../../apps/backend/src/db";'],
    ["packages/database/src/test.ts", 'const client = await import("../../../apps/frontend/lib/trpc");'],
    ["apps/backend/src/test.ts", 'const deploy = require("../../../infrastructure/deploy/config");'],
    ["packages/shared/src/test.ts", 'import { readFile } from "node:fs";'],
    ["apps/frontend/lib/test.ts", 'import { AppRouter } from "../../backend/src/routers";'],
    ["apps/frontend/lib/test.ts", 'import type * as Server from "../../backend/src/routers";'],
    ["apps/legacy-web/src/test.ts", 'import { AppRouter } from "../../backend/src/routers";'],
    ["apps/frontend/app.config.ts", 'import "../../tooling/operations/deploy-web.mjs";'],
    ["apps/video-service/server.mjs", 'import { getDb } from "../backend/src/db";'],
    ["apps/video-service/server.mjs", 'import { users } from "../../packages/database/src/schema";'],
    ["apps/backend/src/test.ts", 'import "../../video-service/main.mjs";'],
  ])("rejects invalid dependency in %s", (file, source) => { expect(check(file, source)).toHaveLength(1); });
  /** Поддерживаемые направления и узкие type-only исключения должны оставаться разрешёнными. */
  it.each([
    ["apps/frontend/lib/test.ts", 'import { normalizeEmail } from "@shared/email";'],
    ["apps/backend/src/test.ts", 'import { users } from "../../../packages/database/src/schema";'],
    ["packages/database/src/test.ts", 'import type { Season } from "../../shared/src/launch-settings";'],
    ["apps/frontend/lib/trpc.ts", 'import type { AppRouter } from "../../backend/src/routers";'],
    ["apps/frontend/lib/trpc.ts", 'import { type AppRouter as Api } from "../../backend/src/routers";'],
    ["apps/backend/src/test.ts", 'import { readFile } from "node:fs";'],
    ["apps/legacy-web/src/trpc.ts", 'import type { AppRouter } from "../../backend/src/routers";'],
    ["apps/frontend/app.config.ts", 'import "../../tooling/scripts/load-env.js";'],
    ["apps/video-service/server.mjs", 'import { createServer } from "node:http";'],
  ])("accepts supported dependency in %s", (file, source) => { expect(check(file, source)).toEqual([]); });
});
