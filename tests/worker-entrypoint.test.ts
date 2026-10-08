import { expect, it } from "vitest";
import { build } from "esbuild";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { createServer, type AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Removing executable activation, starting before listen, or retaining both
// schedulers must fail these real child-process observations.
it("executable activates one owned scheduler only after successful listen; occupied port runs none", async () => {
  const directory = mkdtempSync(resolve(".tmp-worker-entrypoint-"));
  const entry = join(directory, "index.mjs");
  const occupied = createServer();
  try {
    await build({
      stdin: {
        resolveDir: process.cwd(),
        loader: "ts",
        contents: `
          import { WorkerJobs } from "./apps/backend/src/workers/worker-jobs.service";
          import { Server } from "node:http";
          const timers = [], effects = [];
          let listening = false, starts = 0;
          const listen = Server.prototype.listen;
          Server.prototype.listen = function(...args) {
            this.once("listening", () => { listening = true; });
            return listen.apply(this, args);
          };
          const interval = globalThis.setInterval;
          globalThis.setInterval = (callback, delay, ...args) => {
            timers.push(delay);
            return interval(callback, delay, ...args);
          };
          const log = console.log;
          const start = WorkerJobs.prototype.start;
          WorkerJobs.prototype.start = function() {
            starts++;
            if (!listening) throw Error("Activation before listen");
            const operations = this.operations;
            operations.publishDueScheduledPosts = async () => { effects.push("publication"); return []; };
            operations.getDb = async () => { effects.push("database"); return null; };
            operations.processPendingShopDeliveryEmails = async () => { effects.push("shop"); };
            operations.runDataRetentionMaintenance = async () => { effects.push("retention"); };
            operations.runMysqlBackupIfDue = async () => { effects.push("backup"); };
            const value = start.call(this);
            // Let the immediate synthetic callbacks settle, then clean up only
            // this child's owned runner. No wall-clock sleep establishes success.
            setImmediate(async () => {
              await Promise.all(this.stop().map(item => item.settled));
              process.exit(0);
            });
            return value;
          };
          process.on("exit", () => log("RESULT:" + JSON.stringify({ listening, starts, timers, effects })));
          // Test-only bound, not an application shutdown policy. Effects are
          // synthetic, and the child owns its listener and timers exclusively.
          setTimeout(() => process.exit(2), 5000);
          await import("./apps/backend/src/_core/index");
        `,
      },
      plugins: [
        {
          name: "no-deployment-env",
          setup(builder) {
            // The executable's legacy loader must never read actual env files.
            builder.onLoad({ filter: /[/\\]load-env\.ts$/ }, () => ({
              contents: "",
              loader: "ts",
            }));
          },
        },
      ],
      platform: "node",
      packages: "external",
      bundle: true,
      format: "esm",
      outfile: entry,
    });
    const options = (port: number) => ({
      cwd: tmpdir(),
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: String(port),
        DATABASE_URL: " ",
        JWT_SECRET: "synthetic-worker-entrypoint-fixture",
        PUBLIC_APP_URL: "https://club.example.test",
      },
      encoding: "utf8" as const,
      timeout: 10_000,
    });
    const result = (output: string) => {
      const line = output
        .split("\n")
        .find((item) => item.startsWith("RESULT:"));
      expect(line).toBeDefined();
      return JSON.parse(line!.slice("RESULT:".length));
    };
    const success = execFileSync(process.execPath, [entry], options(0));
    expect(result(success)).toEqual({
      listening: true,
      starts: 1,
      timers: [60_000, 30_000, 300_000, 21_600_000],
      effects: ["publication", "database", "shop", "backup", "retention"],
    });
    await new Promise<void>((done) => occupied.listen(0, "127.0.0.1", done));
    const failure = spawnSync(
      process.execPath,
      [entry],
      options((occupied.address() as AddressInfo).port),
    );
    expect(failure.error).toBeUndefined();
    expect(failure.status).toBe(1);
    expect(result(failure.stdout)).toEqual({
      listening: false,
      starts: 0,
      timers: [],
      effects: [],
    });
  } finally {
    if (occupied.listening)
      await new Promise<void>((done) => occupied.close(() => done()));
    rmSync(entry, { force: true });
    rmdirSync(directory);
  }
}, 20_000);
