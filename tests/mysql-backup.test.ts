import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { inspect } from "node:util";
import type { ChildProcess } from "node:child_process";
import { Writable } from "node:stream";
import mysql from "mysql2/promise";
import { assertTestDatabase } from "../tooling/scripts/test-database-policy";

const harness = vi.hoisted(() => ({
  scenario: "success",
  launches: [] as Array<{
    args: string[];
    configPath?: string;
    config?: string;
    mode?: number;
    dirMode?: number;
    env?: NodeJS.ProcessEnv;
  }>,
  children: [] as ChildProcess[],
}));

// Keep real child lifecycle, pipes, gzip and filesystem; replace only the DB tool.
vi.mock("node:child_process", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:child_process")>();
  const files = await import("node:fs");
  const paths = await import("node:path");
  return {
    ...original,
    spawn: (
      command: string,
      args: string[],
      options: import("node:child_process").SpawnOptions,
    ) => {
      let child: ChildProcess;
      if (command === "mysqldump") {
        const configPath = args
          .find((arg) => arg.startsWith("--defaults-extra-file="))
          ?.split("=")
          .slice(1)
          .join("=");
        harness.launches.push({
          args,
          configPath,
          config: configPath
            ? files.readFileSync(configPath, "utf8")
            : undefined,
          mode: configPath
            ? files.statSync(configPath).mode & 0o777
            : undefined,
          dirMode: configPath
            ? files.statSync(paths.dirname(configPath)).mode & 0o777
            : undefined,
          env: options.env,
        });
        if (harness.scenario === "missing") {
          child = original.spawn(
            "/nonexistent-daryadarcy-test-mysqldump",
            args,
            options,
          );
        } else if (harness.scenario === "mysql-option-parser") {
          child = original.spawn(
            "docker",
            [
              "exec",
              "-i",
              process.env.BACKUP_TEST_MYSQL_CONTAINER!,
              "my_print_defaults",
              "--defaults-file=/dev/stdin",
              "--show",
              "client",
            ],
            { ...options, stdio: ["pipe", "pipe", "pipe"] },
          );
          child.stdin!.end(files.readFileSync(configPath!));
        } else if (harness.scenario === "mysql-dump") {
          child = original.spawn(
            "docker",
            [
              "exec",
              "-i",
              process.env.BACKUP_TEST_MYSQL_CONTAINER!,
              "mysqldump",
              "--defaults-extra-file=/dev/stdin",
              "-h127.0.0.1",
              "-P3306",
              "-uroot",
              "--single-transaction",
              "--quick",
              "--",
              "backend_test",
              "backup_roundtrip",
            ],
            { ...options, stdio: ["pipe", "pipe", "pipe"] },
          );
          child.stdin!.end(files.readFileSync(configPath!));
        } else if (harness.scenario === "throw") {
          throw new Error("launch failed password=BACKUP_TEST_SECRET");
        } else {
          const script =
            harness.scenario === "failure"
              ? 'process.stdout.write("PARTIAL SQL"); process.stderr.write("password=BACKUP_TEST_SECRET"); process.exitCode=2;'
              : harness.scenario === "late-failure"
                ? 'process.stdout.end("PARTIAL SQL"); process.stderr.end(); setTimeout(() => process.exit(9), 200);'
                : harness.scenario === "streaming"
                  ? 'setInterval(() => process.stdout.write("SQL ROW\\n".repeat(1000)), 10);'
                  : 'process.stdout.write("CREATE TABLE backup_fixture (id INT);\\n");';
          child = original.spawn(process.execPath, ["-e", script], options);
        }
      } else {
        child = original.spawn(command, args, options);
      }
      harness.children.push(child);
      return child;
    },
  };
});

describe("MySQL backup credentials and completion", () => {
  let directory: string;
  let runBackup: typeof import("../apps/backend/src/_core/backup").runMysqlBackupIfDue;

  beforeEach(async () => {
    directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "daryadarcy-backup-test-"),
    );
    vi.spyOn(process, "cwd").mockReturnValue(directory);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubEnv(
      "DATABASE_URL",
      "mysql://fixture:BACKUP_TEST_SECRET@127.0.0.1:33317/backend_test",
    );
    for (const key of [
      "S3_ENDPOINT",
      "S3_ACCESS_KEY",
      "S3_SECRET_KEY",
      "S3_BUCKET",
    ])
      vi.stubEnv(key, "");
    harness.scenario = "success";
    harness.launches.length = 0;
    harness.children.length = 0;
    vi.resetModules();
    runBackup = (await import("../apps/backend/src/_core/backup"))
      .runMysqlBackupIfDue;
  });

  afterEach(async () => {
    await Promise.all(
      harness.children.map(async (child) => {
        if (child.exitCode !== null || child.signalCode !== null) return;
        await new Promise<void>((resolve) => {
          child.once("close", () => resolve());
          child.kill("SIGKILL");
        });
      }),
    );
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const copies = (directory: string) =>
    fs.readdirSync(path.join(directory, "backups"));

  it("passes credentials through an owner-only temporary file, not process arguments", async () => {
    await runBackup();
    const launch = harness.launches[0];
    expect(launch.args.join(" ")).not.toContain("BACKUP_TEST_SECRET");
    expect(launch.args[0]).toMatch(/^--defaults-extra-file=/);
    expect(launch.args.slice(1)).toEqual([
      "-h127.0.0.1",
      "-P33317",
      "-ufixture",
      "--single-transaction",
      "--quick",
      "--",
      "backend_test",
    ]);
    expect(launch.config).toBe('[client]\npassword="BACKUP_TEST_SECRET"\n');
    expect(launch.mode).toBe(0o600);
    expect(launch.dirMode).toBe(0o700);
    expect(launch.env?.DATABASE_URL).toBeUndefined();
    expect(launch.env?.MYSQL_PWD).toBeUndefined();
    expect(fs.existsSync(launch.configPath!)).toBe(false);
    const [name] = copies(directory);
    expect(name).toMatch(/^daryadarcy-.*\.sql\.gz$/);
    const fullPath = path.join(directory, "backups", name);
    expect(gunzipSync(fs.readFileSync(fullPath)).toString()).toBe(
      "CREATE TABLE backup_fixture (id INT);\n",
    );
    expect(fs.statSync(fullPath).mode & 0o777).toBe(0o600);
  });

  it("does not expose spawn arguments or credentials when mysqldump is missing", async () => {
    harness.scenario = "missing";
    const error = await runBackup().catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(Error);
    expect(inspect(error)).not.toMatch(
      /BACKUP_TEST_SECRET|spawnargs|mysql:\/\//,
    );
    expect(copies(directory)).toEqual([]);
    expect(fs.existsSync(harness.launches[0].configPath!)).toBe(false);
  });

  it("rejects partial dumps without returning sensitive stderr or keeping a usable-looking file", async () => {
    harness.scenario = "failure";
    const error = await runBackup().catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(Error);
    expect(inspect(error)).not.toContain("BACKUP_TEST_SECRET");
    expect(copies(directory)).toEqual([]);
  });

  it("waits for process success even when stdout finishes before a failing exit", async () => {
    harness.scenario = "late-failure";
    await expect(runBackup()).rejects.toThrow();
    expect(copies(directory)).toEqual([]);
  });

  it("allows the next scheduled attempt after a failed dump instead of waiting a day", async () => {
    harness.scenario = "failure";
    await expect(runBackup()).rejects.toThrow();
    harness.scenario = "success";
    await runBackup();
    expect(harness.launches).toHaveLength(2);
    expect(copies(directory)).toHaveLength(1);
  });

  it("shares one in-progress backup even when callers explicitly bypass the interval", async () => {
    await Promise.all([runBackup(0), runBackup(0)]);
    expect(harness.launches).toHaveLength(1);
    expect(copies(directory)).toHaveLength(1);
  });

  it("cleans up credentials and stops the dump when writing fails", async () => {
    harness.scenario = "streaming";
    vi.spyOn(fs, "createWriteStream").mockImplementation((_file, options) => {
      fs.closeSync((options as { fd: number }).fd);
      return new Writable({
        write(_chunk, _encoding, callback) {
          callback(new Error("ENOSPC password=BACKUP_TEST_SECRET"));
        },
      }) as fs.WriteStream;
    });
    const error = await runBackup().catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(Error);
    expect(inspect(error)).not.toContain("BACKUP_TEST_SECRET");
    expect(copies(directory)).toEqual([]);
    expect(fs.existsSync(harness.launches[0].configPath!)).toBe(false);
    expect(harness.children[0].signalCode).toBe("SIGKILL");
  });

  it("cleans up an output stream even if launching the tool throws synchronously", async () => {
    harness.scenario = "throw";
    await expect(runBackup()).rejects.toThrow();
    expect(copies(directory)).toEqual([]);
    expect(fs.existsSync(harness.launches[0].configPath!)).toBe(false);
  });

  it("quotes option-file metacharacters without injecting extra settings", async () => {
    vi.stubEnv(
      "DATABASE_URL",
      "mysql://fixture:%20x%23%22%5Cs%0A%0D%09%08%20@127.0.0.1:33317/backend_test",
    );
    await runBackup();
    expect(harness.launches[0].config).toBe(
      '[client]\npassword=" x#\\"\\\\s\\n\\r\\t\\b "\n',
    );
  });

  it.skipIf(!process.env.BACKUP_TEST_MYSQL_CONTAINER)(
    "roundtrips special password characters through the real MySQL option parser",
    async () => {
      harness.scenario = "mysql-option-parser";
      vi.stubEnv(
        "DATABASE_URL",
        "mysql://fixture:%20x%23%22%5Cs%0A%0D%09%08%20@127.0.0.1:33317/backend_test",
      );
      await runBackup();
      const [name] = copies(directory);
      const output = gunzipSync(
        fs.readFileSync(path.join(directory, "backups", name)),
      ).toString();
      expect(output).toBe('--password= x#"\\s\n\r\t\b \n');
    },
  );

  it.skipIf(
    !process.env.BACKUP_TEST_MYSQL_CONTAINER ||
      !process.env.BACKEND_TEST_DATABASE_URL,
  )(
    "creates a restorable dump with the real MySQL client on a disposable database",
    async () => {
      const databaseUrl = process.env.BACKEND_TEST_DATABASE_URL!;
      assertTestDatabase(databaseUrl);
      const conn = await mysql.createConnection({
        uri: databaseUrl,
        multipleStatements: true,
      });
      let ownsTable = false;
      try {
        await conn.query(
          "CREATE TABLE backup_roundtrip (id INT PRIMARY KEY, value VARCHAR(30))",
        );
        ownsTable = true;
        await conn.query(
          "INSERT INTO backup_roundtrip VALUES (41, 'backup-roundtrip')",
        );
        harness.scenario = "mysql-dump";
        vi.stubEnv("DATABASE_URL", databaseUrl);
        await runBackup();
        const [name] = copies(directory);
        const sql = gunzipSync(
          fs.readFileSync(path.join(directory, "backups", name)),
        ).toString();
        expect(sql).toContain("CREATE TABLE `backup_roundtrip`");
        await conn.query("DROP TABLE backup_roundtrip");
        await conn.query(sql);
        const [rows] = await conn.query("SELECT * FROM backup_roundtrip");
        expect(rows).toEqual([{ id: 41, value: "backup-roundtrip" }]);
        expect(fs.existsSync(harness.launches[0].configPath!)).toBe(false);
      } finally {
        try {
          if (ownsTable)
            await conn.query("DROP TABLE IF EXISTS backup_roundtrip");
        } finally {
          await conn.end();
        }
      }
    },
  );

  it.each([
    "mysql://fixture:BACKUP_TEST_SECRET@invalid host/backend_test",
    "mysql://fixture:BACKUP_TEST_SECRET%ZZ@127.0.0.1/backend_test",
    "mysql://fixture:BACKUP_TEST_SECRET%00@127.0.0.1/backend_test",
    "mysql://fixture%00:BACKUP_TEST_SECRET@127.0.0.1/backend_test",
  ])(
    "rejects invalid configuration without echoing credentials (%#)",
    async (databaseUrl) => {
      vi.stubEnv("DATABASE_URL", databaseUrl);
      const error = await runBackup().catch((failure: unknown) => failure);
      expect(error).toBeInstanceOf(Error);
      expect(inspect(error)).not.toContain("BACKUP_TEST_SECRET");
      expect(harness.launches).toEqual([]);
    },
  );
});
