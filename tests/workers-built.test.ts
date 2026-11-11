/** Собранный ESM worker runtime проверяется отдельным процессом с собственными локальными operations, без БД/SMTP/S3. */
import { expect, it } from "vitest";
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/** Child payload запрещает interval до start, проверяет health до/во время задач, double start, await stop и невозможность возобновления; встроенная строка не редактируется. */
it("compiled ESM composes inert workers and only runs explicitly supplied local effects", async () => {
  const directory = mkdtempSync(resolve(".tmp-nest-workers-"));
  const entry = join(directory, "application.mjs");
  try {
    await build({
      stdin: {
        resolveDir: process.cwd(),
        loader: "ts",
        contents: `
          import { createBackendApplication } from "./apps/backend/src/_core/application";
          import { WorkerJobs } from "./apps/backend/src/workers/worker-jobs.service";
          import { WORKER_OPERATIONS } from "./apps/backend/src/workers/worker-operations";
          let approved = false;
          const interval = globalThis.setInterval;
          globalThis.setInterval = (...args) => {
            if (!approved) throw Error("Unapproved worker activation");
            return interval(...args);
          };
          const events = [];
          const warnings = [];
          const warn = console.warn;
          console.warn = (...args) => { warnings.push(args); };
          const application = await createBackendApplication();
          const jobs = application.get(WorkerJobs);
          try {
            await application.listen(0, "127.0.0.1");
            const base = "http://127.0.0.1:" + application.getHttpServer().address().port;
            const before = await fetch(base + "/api/health");
            if (before.status !== 200) throw Error("Health unavailable before activation");
            await before.json();
            const operations = application.get(WORKER_OPERATIONS);
            operations.publishDueScheduledPosts = async () => { events.push("publication"); return []; };
            operations.sendMarketingPostNotification = async () => { throw Error("No post to announce"); };
            operations.getDb = async () => { events.push("database"); return null; };
            operations.processCancellations = async () => { throw Error("No database for cancellation"); };
            operations.cancelProdamusSubscription = async () => { throw Error("No provider request allowed"); };
            operations.processAccessEmails = async () => { throw Error("No database for email"); };
            operations.sendTransactionalEmail = async () => { throw Error("No email allowed"); };
            operations.processPendingShopDeliveryEmails = async () => { events.push("shop"); };
            operations.runDataRetentionMaintenance = async () => { events.push("retention"); };
            operations.runMysqlBackupIfDue = async () => { events.push("backup"); };
            approved = true;
            jobs.start();
            jobs.start();
            const during = await fetch(base + "/api/health");
            if (during.status !== 200) throw Error("Health unavailable during activation");
            await during.json();
            await Promise.all(jobs.stop().map(item => item.settled));
            approved = false;
            jobs.start();
            await new Promise(resolve => setImmediate(resolve));
            console.log("WORKER_RESULTS:" + JSON.stringify({ events, warnings, remaining: jobs.stop().length }));
          } finally {
            await Promise.all(jobs.stop().map(item => item.settled));
            await application.close();
            globalThis.setInterval = interval;
            console.warn = warn;
          }
        `,
      },
      platform: "node",
      packages: "external",
      bundle: true,
      format: "esm",
      outfile: entry,
    });
    const output = execFileSync(process.execPath, [entry], {
      cwd: tmpdir(),
      env: {
        NODE_ENV: "production",
        JWT_SECRET: "owned-compiled-worker-fixture-secret-32-bytes",
        DATABASE_URL: "",
        PUBLIC_APP_URL: "https://club.example.test",
      },
      encoding: "utf8",
      timeout: 10_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const result = output
      .split("\n")
      .find((line) => line.startsWith("WORKER_RESULTS:"));
    expect(result).toBeDefined();
    expect(JSON.parse(result!.slice("WORKER_RESULTS:".length))).toEqual({
      events: ["publication", "database", "shop", "backup", "retention"],
      warnings: [],
      remaining: 0,
    });
  } finally {
    rmSync(entry, { force: true });
    rmdirSync(directory);
  }
}, 15_000);
