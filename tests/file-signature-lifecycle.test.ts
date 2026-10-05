import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import type { WorkerOptions } from "node:worker_threads";

// Fault injection only: real worker/parser/compiled-runtime tests are separate.
interface ControlledWorker extends EventEmitter {
  options: WorkerOptions;
  terminate: ReturnType<typeof vi.fn<() => Promise<number>>>;
}
const state = vi.hoisted(() => ({
  workers: [] as ControlledWorker[],
  failConstruction: false,
}));
vi.mock("node:worker_threads", () => ({
  Worker: class extends EventEmitter {
    options: WorkerOptions;
    terminate = vi.fn(async (): Promise<number> => 0);
    constructor(_source: string, options: WorkerOptions) {
      super();
      if (state.failConstruction) throw new Error("private startup detail");
      this.options = options;
      state.workers.push(this);
    }
  },
}));
let detect: typeof import("../apps/backend/src/media/file-signature").detectBinaryFileType;
beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  state.workers = [];
  state.failConstruction = false;
  detect = (await import("../apps/backend/src/media/file-signature"))
    .detectBinaryFileType;
});
afterEach(() => vi.useRealTimers());

it("terminates a hung detector at its deadline and permits the next request", async () => {
  const stalled = expect(detect(Buffer.from("fixture"))).rejects.toMatchObject({
    code: "BAD_REQUEST",
  });
  await vi.advanceTimersByTimeAsync(5_000);
  await stalled;
  expect(state.workers[0].terminate).toHaveBeenCalledOnce();
  expect(state.workers[0].eventNames()).toEqual([]);
  const next = detect(Buffer.from("next"));
  await vi.advanceTimersByTimeAsync(0);
  state.workers[1].emit("message", { ext: "mp3", mime: "audio/mpeg" });
  await expect(next).resolves.toEqual({ ext: "mp3", mime: "audio/mpeg" });
  expect(vi.getTimerCount()).toBe(0);
});

it.each(["error", "exit"])(
  "tears down after %s without leaking private diagnostics",
  async (event) => {
    const failed = expect(detect(Buffer.from("fixture"))).rejects.toMatchObject(
      {
        code: "INTERNAL_SERVER_ERROR",
        message: "Внутренняя ошибка сервера",
      },
    );
    await vi.advanceTimersByTimeAsync(0);
    state.workers[0].emit(
      event,
      event === "error" ? new Error("private parser path") : 0,
    );
    await failed;
    expect(state.workers[0].terminate).toHaveBeenCalledOnce();
    expect(state.workers[0].eventNames()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  },
);

it("does not poison serialization after worker construction fails", async () => {
  state.failConstruction = true;
  await expect(detect(Buffer.from("fixture"))).rejects.toThrow();
  state.failConstruction = false;
  const next = detect(Buffer.from("next"));
  await vi.advanceTimersByTimeAsync(0);
  state.workers[0].emit("message", null);
  await expect(next).resolves.toBeUndefined();
});

it("awaits termination before allocating the next worker and copies only owned bytes", async () => {
  const bytes = Buffer.from("private-prefix-visible-private-suffix").subarray(
    15,
    22,
  );
  const first = detect(bytes);
  const second = detect(Buffer.from("next"));
  await vi.advanceTimersByTimeAsync(0);
  const worker = state.workers[0];
  expect(Buffer.from(worker.options.workerData.bytes)).toEqual(bytes);
  expect(worker.options.workerData.bytes.buffer.byteLength).toBe(bytes.length);
  expect(worker.options.env).toEqual({});
  expect(worker.options.execArgv).toEqual([]);
  let finish!: (code: number) => void;
  worker.terminate.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  worker.emit("message", null);
  await vi.advanceTimersByTimeAsync(0);
  expect(state.workers).toHaveLength(1);
  finish(0);
  await first;
  await vi.advanceTimersByTimeAsync(0);
  expect(state.workers).toHaveLength(2);
  state.workers[1].emit("message", null);
  await second;
  expect(vi.getTimerCount()).toBe(0);
});
