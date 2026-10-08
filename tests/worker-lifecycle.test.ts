import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IntervalJobs } from "../apps/backend/src/workers/interval-jobs";

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("inert single-flight interval jobs", () => {
  it("does not run or schedule anything until explicitly started", async () => {
    const events: string[] = [];
    new IntervalJobs([
      {
        name: "publication",
        intervalMs: 1000,
        run: () => {
          events.push("run");
        },
      },
    ]);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(events).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("starts once immediately, then follows the fixed interval", async () => {
    const times: number[] = [];
    vi.setSystemTime(0);
    const jobs = new IntervalJobs([
      {
        name: "publication",
        intervalMs: 1000,
        run: () => {
          times.push(Date.now());
        },
      },
    ]);
    jobs.start();
    jobs.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(times).toEqual([0]);
    await vi.advanceTimersByTimeAsync(999);
    expect(times).toEqual([0]);
    await vi.advanceTimersByTimeAsync(2001);
    expect(times).toEqual([0, 1000, 2000, 3000]);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("skips busy intervals without overlap or a catch-up backlog", async () => {
    const first = deferred();
    let runs = 0;
    const jobs = new IntervalJobs([
      {
        name: "billing",
        intervalMs: 1000,
        run: () => {
          runs++;
          return runs === 1 ? first.promise : undefined;
        },
      },
    ]);
    jobs.start();
    await vi.advanceTimersByTimeAsync(3500);
    expect(runs).toBe(1);
    first.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(runs).toBe(1);
    await vi.advanceTimersByTimeAsync(499);
    expect(runs).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(runs).toBe(2);
  });

  it("keeps different jobs independent while one is blocked", async () => {
    const blocked = deferred();
    const events: string[] = [];
    const jobs = new IntervalJobs([
      {
        name: "billing",
        intervalMs: 1000,
        run: () => {
          events.push("billing");
          return blocked.promise;
        },
      },
      {
        name: "maintenance",
        intervalMs: 500,
        run: () => {
          events.push("maintenance");
        },
      },
    ]);
    jobs.start();
    await vi.advanceTimersByTimeAsync(1500);
    expect(events).toEqual([
      "billing",
      "maintenance",
      "maintenance",
      "maintenance",
      "maintenance",
    ]);
    blocked.resolve();
    await vi.advanceTimersByTimeAsync(0);
  });

  it.each(["throw", "reject"])(
    "recovers after a %s without logging private error data",
    async (mode) => {
      const warnings: unknown[][] = [];
      vi.spyOn(console, "warn").mockImplementation((...args) => {
        warnings.push(args);
      });
      let runs = 0;
      const jobs = new IntervalJobs([
        {
          name: "backup",
          intervalMs: 1000,
          run: () => {
            runs++;
            if (runs !== 1) return;
            const error = new Error("private-connection-fixture");
            if (mode === "throw") throw error;
            return Promise.reject(error);
          },
        },
      ]);
      jobs.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(warnings).toEqual([["[workers] backup failed"]]);
      await vi.advanceTimersByTimeAsync(1000);
      expect(runs).toBe(2);
      expect(warnings).toHaveLength(1);
    },
  );

  it("stop before start permanently prohibits activation", async () => {
    const events: string[] = [];
    const jobs = new IntervalJobs([
      {
        name: "billing",
        intervalMs: 1000,
        run: () => {
          events.push("run");
        },
      },
    ]);
    expect(jobs.stop()).toEqual([]);
    jobs.start();
    await vi.advanceTimersByTimeAsync(5000);
    expect(events).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops timers but honestly exposes an unfinished run until it settles", async () => {
    const work = deferred();
    let runs = 0;
    const jobs = new IntervalJobs([
      {
        name: "billing",
        intervalMs: 1000,
        run: () => {
          runs++;
          return work.promise;
        },
      },
    ]);
    jobs.start();
    await vi.advanceTimersByTimeAsync(0);
    const pending = jobs.stop();
    expect(pending.map((item) => item.name)).toEqual(["billing"]);
    expect(vi.getTimerCount()).toBe(0);
    let settled = false;
    const drained = Promise.all(pending.map((item) => item.settled)).then(
      () => {
        settled = true;
      },
    );
    await vi.advanceTimersByTimeAsync(5000);
    expect(settled).toBe(false);
    expect(runs).toBe(1);
    expect(jobs.stop().map((item) => item.settled)).toEqual(
      pending.map((item) => item.settled),
    );
    jobs.start();
    work.resolve();
    await drained;
    expect(settled).toBe(true);
    expect(jobs.stop()).toEqual([]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(runs).toBe(1);
  });

  it("fences a timer callback already queued before stop", async () => {
    let runs = 0;
    const timers = vi.spyOn(globalThis, "setInterval");
    const jobs = new IntervalJobs([
      {
        name: "publication",
        intervalMs: 1000,
        run: () => {
          runs++;
        },
      },
    ]);
    jobs.start();
    await vi.advanceTimersByTimeAsync(0);
    const callback = timers.mock.calls[0]?.[0];
    expect(typeof callback).toBe("function");
    jobs.stop();
    if (typeof callback !== "function")
      throw new Error("No scheduled callback");
    callback();
    await vi.advanceTimersByTimeAsync(0);
    expect(runs).toBe(1);
    expect(jobs.stop()).toEqual([]);
  });

  it("stop fences initial work that has not yet entered its callback", async () => {
    let runs = 0;
    const jobs = new IntervalJobs([
      {
        name: "publication",
        intervalMs: 1000,
        run: () => {
          runs++;
        },
      },
    ]);
    jobs.start();
    const pending = jobs.stop();
    await Promise.all(pending.map((item) => item.settled));
    await vi.advanceTimersByTimeAsync(2000);
    expect(runs).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("allows stop from inside a callback without starting other queued jobs", async () => {
    const events: string[] = [];
    const jobs = new IntervalJobs([
      {
        name: "billing",
        intervalMs: 1000,
        run: () => {
          events.push("billing");
          jobs.stop();
        },
      },
      {
        name: "maintenance",
        intervalMs: 500,
        run: () => {
          events.push("maintenance");
        },
      },
    ]);
    jobs.start();
    await vi.advanceTimersByTimeAsync(3000);
    expect(events).toEqual(["billing"]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("settles a rejected pending run after stop without claiming provider success", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const work = deferred();
    const jobs = new IntervalJobs([
      { name: "billing", intervalMs: 1000, run: () => work.promise },
    ]);
    jobs.start();
    await vi.advanceTimersByTimeAsync(0);
    const pending = jobs.stop();
    expect(pending).toHaveLength(1);
    work.reject(new Error("private-provider-fixture"));
    await expect(
      Promise.all(pending.map((item) => item.settled)),
    ).resolves.toEqual([undefined]);
    expect(jobs.stop()).toEqual([]);
  });

  it("only clears timers owned by this runner", async () => {
    let unrelatedRuns = 0;
    const unrelated = setInterval(() => {
      unrelatedRuns++;
    }, 500);
    const jobs = new IntervalJobs([
      { name: "publication", intervalMs: 1000, run: () => {} },
    ]);
    jobs.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(2);
    jobs.stop();
    await vi.advanceTimersByTimeAsync(500);
    expect(unrelatedRuns).toBe(1);
    expect(vi.getTimerCount()).toBe(1);
    clearInterval(unrelated);
  });
});
