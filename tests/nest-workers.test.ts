/** Фабрика и app-owned worker bindings проверяются настоящим Nest/health HTTP, но все domain effects подменены до init. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import * as db from "../apps/backend/src/db";
import * as cancellation from "../apps/backend/src/billing/cancellation";
import * as access from "../apps/backend/src/identity/access";
import * as email from "../apps/backend/src/_core/email";
import * as prodamus from "../apps/backend/src/prodamus";
import * as push from "../apps/backend/src/push";
import * as shop from "../apps/backend/src/shop-delivery";
import * as platformDb from "../apps/backend/src/platform-db";
import * as backup from "../apps/backend/src/_core/backup";
import { WorkerJobs } from "../apps/backend/src/workers/worker-jobs.service";
import {
  WORKER_OPERATIONS,
  type WorkerOperations,
} from "../apps/backend/src/workers/worker-operations";

const events: string[] = [];
// Domain helpers are doubled; this handle is never queried or connected.
const database = {} as NonNullable<Awaited<ReturnType<typeof db.getDb>>>;

/** Устанавливаем все synthetic boundaries заранее, чтобы случайный auto-start был наблюдаемым и безопасным. */
beforeEach(() => {
  events.length = 0;
  vi.stubEnv("DATABASE_URL", "");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  // Install every effect boundary before factory creation, not after init.
  vi.spyOn(db, "publishDueScheduledPosts").mockImplementation(async () => {
    events.push("publication");
    return [];
  });
  vi.spyOn(db, "getDb").mockImplementation(async () => {
    events.push("database");
    return database;
  });
  vi.spyOn(cancellation, "processCancellations").mockImplementation(
    async (handle, sender, userId) => {
      expect(handle).toBe(database);
      expect(sender).toBe(prodamus.cancelProdamusSubscription);
      expect(userId).toBeUndefined();
      events.push("cancellation");
    },
  );
  vi.spyOn(access, "processAccessEmails").mockImplementation(
    async (handle, sender, userId) => {
      expect(handle).toBe(database);
      expect(sender).toBe(email.sendTransactionalEmail);
      expect(userId).toBeUndefined();
      events.push("email");
    },
  );
  vi.spyOn(push, "sendMarketingPostNotification").mockImplementation(
    async (text, id, target) => {
      events.push(`announce:${id}:${target}:${text}`);
    },
  );
  vi.spyOn(shop, "processPendingShopDeliveryEmails").mockImplementation(
    async () => {
      events.push("shop");
    },
  );
  vi.spyOn(platformDb, "runDataRetentionMaintenance").mockImplementation(
    async () => {
      events.push("retention");
    },
  );
  vi.spyOn(backup, "runMysqlBackupIfDue").mockImplementation(async () => {
    events.push("backup");
  });
});
/** Снимаем spies и env. */
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

/** Ищем именно app-owned WorkerJobs, отдельно отмечая отсутствие provider. */
function boundWorker(application: INestApplication): WorkerJobs | null {
  try {
    return application.get(WorkerJobs);
  } catch {
    return null;
  }
}

/** Настоящий локальный health подтверждает, что активация/остановка задач не убили listener. */
async function health(application: INestApplication) {
  const { port } = application.getHttpServer().address() as AddressInfo;
  const response = await fetch(`http://127.0.0.1:${port}/api/health`);
  expect(response.status).toBe(200);
  await response.json();
}

/** Сначала ждём settled всех своих tasks, затем закрываем Nest app. */
async function close(application?: INestApplication) {
  if (!application) return;
  const pending = boundWorker(application)?.stop() ?? [];
  await Promise.all(pending.map((item) => item.settled));
  await application.close();
}

/** До explicit start effects отсутствуют; stop ждёт ожидаемую последовательность synthetic jobs. */
it("factory/init/listen stay worker-free; explicit activation uses the Nest-bound helpers", async () => {
  let application: INestApplication | undefined;
  try {
    application = await createBackendApplication();
    expect(application.getHttpServer().listening).toBe(false);
    await application.listen(0, "127.0.0.1");
    await health(application);
    expect(events).toEqual([]);
    const jobs = boundWorker(application);
    expect(jobs).toBeInstanceOf(WorkerJobs);
    if (!jobs) throw new Error("Missing worker provider");
    jobs.start();
    await health(application);
    const pending = jobs.stop();
    await Promise.all(pending.map((item) => item.settled));
    expect(events).toEqual([
      "publication",
      "database",
      "shop",
      "backup",
      "cancellation",
      "email",
      "retention",
    ]);
  } finally {
    await close(application);
  }
});

/** У каждого app отдельный operations object и start; публикации/уведомления не используют последнюю глобальную подмену. */
it("two native apps own independent bindings and explicit activation state", async () => {
  let first: INestApplication | undefined;
  let second: INestApplication | undefined;
  try {
    first = await createBackendApplication();
    second = await createBackendApplication();
    await first.listen(0, "127.0.0.1");
    await second.listen(0, "127.0.0.1");
    await Promise.all([health(first), health(second)]);
    expect(events).toEqual([]);
    const firstJobs = boundWorker(first);
    const secondJobs = boundWorker(second);
    expect(firstJobs).toBeInstanceOf(WorkerJobs);
    expect(secondJobs).toBeInstanceOf(WorkerJobs);
    if (!firstJobs || !secondJobs) throw new Error("Missing worker providers");
    const firstOperations = first.get<WorkerOperations>(WORKER_OPERATIONS);
    const secondOperations = second.get<WorkerOperations>(WORKER_OPERATIONS);
    /** Первый app отдаёт собственную synthetic клубную публикацию. */
    const firstPublish: WorkerOperations["publishDueScheduledPosts"] =
      async () => [{ id: 11, text: "first app", target: "club" }];
    /** Второй app отдаёт другую synthetic feed публикацию. */
    const secondPublish: WorkerOperations["publishDueScheduledPosts"] =
      async () => [{ id: 12, text: "second app", target: "feed" }];
    // Imported helpers already share spies in this fixture. Replace the two
    // owned binding properties, not the shared spy's implementation.
    Object.defineProperty(firstOperations, "publishDueScheduledPosts", {
      value: firstPublish,
    });
    Object.defineProperty(secondOperations, "publishDueScheduledPosts", {
      value: secondPublish,
    });
    firstJobs.start();
    await health(first);
    expect(events.filter((event) => event.startsWith("announce:"))).toEqual([
      "announce:11:club:first app",
    ]);
    secondJobs.start();
    await health(second);
    expect(events.filter((event) => event.startsWith("announce:"))).toEqual([
      "announce:11:club:first app",
      "announce:12:feed:second app",
    ]);
  } finally {
    await Promise.all([close(first), close(second)]);
  }
});
