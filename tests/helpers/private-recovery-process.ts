import { build } from "esbuild";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { assertTestDatabase } from "../../tooling/scripts/test-database-policy";

/** Fresh process with only the owned DB/wire credentials; never imports production boot. */
export async function runPrivateRecoveryProcess() {
  // Перед обслуживанием требует одноразовый URL и запускает отдельный процесс только с собственной БД и wire; удаляет лишь свой временный каталог.

  assertTestDatabase(process.env.BACKEND_TEST_DATABASE_URL!);
  const root = new URL("../../", import.meta.url).pathname;
  const directory = await mkdtemp(
    join(tmpdir(), "daryadarcy-ag5-maintenance-"),
  );
  try {
    await symlink(join(root, "node_modules"), join(directory, "node_modules"));
    await build({
      stdin: {
        contents: `
      import { getDb } from ${JSON.stringify(join(root, "apps/backend/src/db.ts"))};
      import { maintainPrivateRecovery } from ${JSON.stringify(join(root, "apps/backend/src/content/private-recovery-maintenance.ts"))};
      const db=await getDb();
      try { console.log(JSON.stringify({pid:process.pid,result:await maintainPrivateRecovery(db,{limit:10})})); }
      finally { await db.$client.end(); }
    `,
        resolveDir: root,
        loader: "ts",
      },
      outfile: join(directory, "maintenance.mjs"),
      bundle: true,
      platform: "node",
      format: "esm",
      packages: "external",
      logLevel: "silent",
    });
    // Очистка recovery/orphan включается только в отдельно запускаемой fixture с охраняемым URL и собственным storage wire.
    const env: Record<string, string> = {
      PATH: process.env.PATH!,
      NODE_ENV: "test",
      DATABASE_URL: process.env.BACKEND_TEST_DATABASE_URL!,
      CONTENT_RECOVERY_RETENTION_ENABLED: "true",
      CONTENT_RECOVERY_MAINTENANCE_ENABLED: "true",
      PRIVATE_ORPHAN_CLEANUP_ENABLED: "true",
    };
    for (const name of [
      "S3_ENDPOINT",
      "S3_BUCKET",
      "S3_ACCESS_KEY",
      "S3_SECRET_KEY",
    ])
      env[name] = process.env[name]!;
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [join(directory, "maintenance.mjs")],
      { cwd: directory, env, timeout: 15000, maxBuffer: 8192 },
    );
    return JSON.parse(stdout.trim()) as {
      pid: number;
      result: { deleted: number; failed: number };
    };
  } finally {
    if (!basename(directory).startsWith("daryadarcy-ag5-maintenance-"))
      throw new Error("Owned process directory mismatch");
    await rm(directory, { recursive: true, force: true });
  }
}
