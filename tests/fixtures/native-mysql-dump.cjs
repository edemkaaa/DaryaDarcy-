#!/usr/bin/env node
// Test-only transport adapter: execute the actual MySQL 8.4 tool inside the
// owned source container. Production gzip/filesystem/completion code stays real.
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const args = process.argv.slice(2);
const config = args.shift();
const id = process.env.BACKUP_REHEARSAL_SOURCE_ID;
if (
  !/^[a-f0-9]{64}$/.test(id || "") ||
  !config?.startsWith("--defaults-extra-file=")
)
  process.exit(2);
const child = spawn(
  "docker",
  [
    "exec",
    "-i",
    id,
    "mysqldump",
    "--defaults-extra-file=/dev/stdin",
    "-h127.0.0.1",
    "-P3306",
    ...args.filter((arg) => !arg.startsWith("-h") && !arg.startsWith("-P")),
  ],
  { stdio: ["pipe", "inherit", "inherit"] },
);
child.stdin.end(fs.readFileSync(config.slice("--defaults-extra-file=".length)));
child.on("error", () => process.exit(2));
child.on("close", (code) => process.exit(code ?? 2));
