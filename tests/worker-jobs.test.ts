import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as db from "../apps/backend/src/db";
import { WorkerJobs } from "../apps/backend/src/workers/worker-jobs.service";
import type { WorkerOperations } from "../apps/backend/src/workers/worker-operations";

// SQL stays below a doubled boundary. This opaque handle is never queried.
const database = {} as NonNullable<Awaited<ReturnType<typeof db.getDb>>>;
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

function fixture() {
  const events: string[] = [];
  const operations: WorkerOperations = {
    publishDueScheduledPosts: async () => {
      events.push("publication");
      return [];
    },
    sendMarketingPostNotification: async (text, id, target) => {
      events.push(`announce:${id}:${target}:${text}`);
    },
    getDb: async () => {
      events.push("database");
      return null;
    },
    processCancellations: async () => {
      events.push("cancellation");
    },
    cancelProdamusSubscription: async () => false,
    processAccessEmails: async () => {
      events.push("email");
    },
    sendTransactionalEmail: async () => false,
    processPendingShopDeliveryEmails: async () => {
      events.push("shop");
    },
    runDataRetentionMaintenance: async () => {
      events.push("retention");
    },
    runMysqlBackupIfDue: async () => {
      events.push("backup");
    },
  };
  return { operations, events };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.clearAllTimers();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("explicit worker job orchestration", () => {
  it("does not touch domain boundaries or schedule timers during construction", async () => {
    const { operations, events } = fixture();
    new WorkerJobs(operations);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(events).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("preserves the four fixed cadences after a single explicit start", async () => {
    const { operations, events } = fixture();
    const jobs = new WorkerJobs(operations);
    jobs.start();
    jobs.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(events).toEqual([
      "publication",
      "database",
      "shop",
      "backup",
      "retention",
    ]);
    await vi.advanceTimersByTimeAsync(6 * 60 * 60_000);
    expect({
      publication: events.filter((event) => event === "publication").length,
      billing: events.filter((event) => event === "database").length,
      maintenance: events.filter((event) => event === "retention").length,
      backup: events.filter((event) => event === "backup").length,
    }).toEqual({ publication: 361, billing: 721, maintenance: 73, backup: 2 });
    jobs.stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("announces only returned published rows with their original targets", async () => {
    const { operations, events } = fixture();
    const jobs = new WorkerJobs({
      ...operations,
      publishDueScheduledPosts: async () => [
        { id: 11, text: "feed fixture", target: "feed" },
        { id: 12, text: "club fixture", target: "club" },
        { id: 13, text: "both fixture", target: "both" },
      ],
    });
    jobs.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(events.filter((event) => event.startsWith("announce:"))).toEqual([
      "announce:11:feed:feed fixture",
      "announce:12:club:club fixture",
      "announce:13:both:both fixture",
    ]);
    jobs.stop();
  });

  it("passes the same database and original sender bindings to both billing workers", async () => {
    const { operations, events } = fixture();
    const jobs = new WorkerJobs({
      ...operations,
      getDb: async () => database,
      processCancellations: async (handle, sender, userId) => {
        expect(handle).toBe(database);
        expect(sender).toBe(operations.cancelProdamusSubscription);
        expect(userId).toBeUndefined();
        events.push("cancellation");
      },
      processAccessEmails: async (handle, sender, userId) => {
        expect(handle).toBe(database);
        expect(sender).toBe(operations.sendTransactionalEmail);
        expect(userId).toBeUndefined();
        events.push("email");
      },
    });
    jobs.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(
      events.filter((event) => ["cancellation", "email"].includes(event)),
    ).toEqual(["cancellation", "email"]);
    jobs.stop();
  });

  it("keeps email processing independent of a failed cancellation worker", async () => {
    const { operations, events } = fixture();
    const jobs = new WorkerJobs({
      ...operations,
      getDb: async () => database,
      processCancellations: async () => {
        throw new Error("private-cancellation-fixture");
      },
    });
    jobs.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(events).toContain("email");
    expect(console.warn).toHaveBeenCalledExactlyOnceWith(
      "[billing] cancellation worker failed",
    );
    jobs.stop();
  });

  it("keeps cancellation processing independent of a failed email worker", async () => {
    const { operations, events } = fixture();
    const jobs = new WorkerJobs({
      ...operations,
      getDb: async () => database,
      processAccessEmails: async () => {
        throw new Error("private-email-fixture");
      },
    });
    jobs.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(events).toContain("cancellation");
    expect(console.warn).toHaveBeenCalledExactlyOnceWith(
      "[billing] email worker failed",
    );
    jobs.stop();
  });

  it("holds billing single-flight until both settled workers finish", async () => {
    const { operations, events } = fixture();
    const pending = deferred();
    let acquisitions = 0;
    const jobs = new WorkerJobs({
      ...operations,
      getDb: async () => {
        acquisitions++;
        return database;
      },
      processCancellations: async () => {
        events.push("cancellation");
        return pending.promise;
      },
    });
    jobs.start();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(acquisitions).toBe(1);
    expect(events.filter((event) => event === "email")).toHaveLength(1);
    pending.resolve();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(acquisitions).toBe(2);
    jobs.stop();
  });

  it("catches database acquisition failure and recovers on the next billing cadence", async () => {
    const { operations, events } = fixture();
    let acquisitions = 0;
    const jobs = new WorkerJobs({
      ...operations,
      getDb: async () => {
        acquisitions++;
        if (acquisitions === 1) throw new Error("private-database-fixture");
        return database;
      },
    });
    jobs.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(console.warn).toHaveBeenCalledExactlyOnceWith(
      "[workers] billing failed",
    );
    expect(events).not.toContain("email");
    await vi.advanceTimersByTimeAsync(30_000);
    expect(events).toContain("email");
    jobs.stop();
  });

  it("waits for the existing shop helper before retention maintenance", async () => {
    const { operations, events } = fixture();
    const shop = deferred();
    const jobs = new WorkerJobs({
      ...operations,
      processPendingShopDeliveryEmails: async () => {
        events.push("shop");
        return shop.promise;
      },
    });
    jobs.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(events).toContain("shop");
    expect(events).not.toContain("retention");
    shop.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(events).toContain("retention");
    jobs.stop();
  });
});
