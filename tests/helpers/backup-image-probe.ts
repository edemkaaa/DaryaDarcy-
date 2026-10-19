// Composition-only entry: never import the application executable or workers.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runMysqlBackupIfDue } from "../../apps/backend/src/_core/backup";

assert.equal(process.getuid?.(), 1000);
assert.equal(
  createHash("sha256")
    .update(await readFile("/app/dist/index.mjs"))
    .digest("hex"),
  process.env.BACKUP_REHEARSAL_BUNDLE_SHA,
);
assert.equal(
  Object.keys(process.env).some((key) => /^(S3_|SMTP_)/.test(key)),
  false,
);
const url = new URL(process.env.DATABASE_URL!);
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.port, "3306");
assert.equal(url.pathname, "/backend_test");
const mode = process.argv[2];
assert.ok(mode === "backup" || mode === "restore" || mode === "failed-backup");
if (mode !== "restore") {
  assert.equal((await stat("/app/backups")).mode & 0o777, 0o700);
  if (mode === "failed-backup") {
    await assert.rejects(runMysqlBackupIfDue(0), {
      message: "MySQL backup dump or output failed",
    });
    assert.deepEqual(await readdir("/app/backups"), []);
  } else {
    await runMysqlBackupIfDue(0);
    const files = await readdir("/app/backups");
    assert.equal(files.length, 1);
    assert.match(files[0]!, /^daryadarcy-.*\.sql\.gz$/);
    assert.equal(
      (await stat(join("/app/backups", files[0]!))).mode & 0o777,
      0o600,
    );
  }
  assert.equal(
    (await readdir("/tmp")).some((name) =>
      name.startsWith("daryadarcy-mysql-"),
    ),
    false,
  );
} else {
  // Synthetic fixture credentials only. Reject special characters rather than
  // maintain a second general-purpose production option-file encoder here.
  const password = decodeURIComponent(url.password);
  assert.match(password, /^[a-zA-Z0-9-]+$/);
  const directory = await mkdtemp(join(tmpdir(), "darcy-image-restore-"));
  const config = join(directory, "client.cnf");
  try {
    await writeFile(config, `[client]\npassword=${password}\n`, {
      mode: 0o600,
      flag: "wx",
    });
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        "mysql",
        [
          `--defaults-extra-file=${config}`,
          "-h127.0.0.1",
          "-P3306",
          `-u${decodeURIComponent(url.username)}`,
          "--binary-mode",
          "--",
          "backend_test",
        ],
        {
          stdio: ["pipe", "ignore", "pipe"],
          timeout: 30000,
          env: { ...process.env, DATABASE_URL: undefined },
        },
      );
      child.stderr.resume();
      child.stdin.on("error", () => {});
      process.stdin.pipe(child.stdin);
      child.once("error", () =>
        reject(new Error("Image restore could not start")),
      );
      child.once("close", (code) =>
        code === 0 ? resolve() : reject(new Error("Image restore failed")),
      );
    });
  } finally {
    await rm(config, { force: true });
    await rm(directory, { recursive: true });
  }
}
console.log(
  JSON.stringify({
    mode,
    uid: process.getuid?.(),
    workersStarted: false,
    client: execFileSync(
      mode === "restore" ? "mysql" : "mysqldump",
      ["--version"],
      { encoding: "utf8" },
    ).trim(),
  }),
);
