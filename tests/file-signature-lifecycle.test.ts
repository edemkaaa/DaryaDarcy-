import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import type { WorkerOptions } from "node:worker_threads";

// Fault injection only: real worker/parser/compiled-runtime tests are separate.
interface ControlledWorker extends EventEmitter {
  options: WorkerOptions;
  terminate: ReturnType<typeof vi.fn<() => Promise<number>>>;
  postMessage: ReturnType<typeof vi.fn>;
}
const state = vi.hoisted(() => ({
  workers: [] as ControlledWorker[],
  failConstruction: false,
}));
vi.mock("node:worker_threads", () => ({
  Worker: class extends EventEmitter {
    options: WorkerOptions;
    terminate = vi.fn(async (): Promise<number> => 0);
    postMessage = vi.fn();
    /** Подменяет Worker управляемым emitter: позволяет отдельно проверить создание, обмен фрагментами и освобождение ресурсов. */
    constructor(_source: string, options: WorkerOptions) {
      super();
      if (state.failConstruction) throw new Error("private startup detail");
      this.options = options;
      state.workers.push(this);
    }
  },
}));
let detect: typeof import("../apps/backend/src/media/file-signature").detectBinaryFileType;
/** Сбрасывает очередь работников и включает управляемое время перед каждым независимым сценарием детектора. */
beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  state.workers = [];
  state.failConstruction = false;
  detect = (await import("../apps/backend/src/media/file-signature"))
    .detectBinaryFileType;
});
/** Возвращает настоящие таймеры, чтобы сроки жизни детектора не влияли на другие тесты. */
afterEach(() => vi.useRealTimers());

/** Проверяет передачу только запрошенного диапазона принадлежащего буферу представления и отсутствие изменения исходника. */
it("serves only the requested owned range without copying the entire file", async () => {
  const source = Buffer.from("private-prefix-visible-private-suffix");
  const bytes = source.subarray(15, 22);
  const detection = detect(bytes);
  await vi.advanceTimersByTimeAsync(0);
  const worker = state.workers[0];
  expect(worker.options.workerData.bytes).toBeUndefined();
  worker.emit("message", { kind: "read", offset: 1, length: 3 });
  expect(worker.postMessage).toHaveBeenCalledOnce();
  const [reply, transfer] = worker.postMessage.mock.calls[0];
  expect(Buffer.from(reply)).toEqual(Buffer.from("isi"));
  expect(reply.buffer.byteLength).toBe(3);
  expect(transfer).toEqual([reply.buffer]);
  reply.fill(0);
  expect(source.toString()).toBe("private-prefix-visible-private-suffix");
  worker.emit("message", { kind: "result", result: null });
  await expect(detection).resolves.toBeUndefined();
});

/** Отклоняет отрицательные, дробные, пустые и выходящие за границы запросы worker без экспорта байтов. */
it.each([
  { offset: -1, length: 1 },
  { offset: 0, length: 0 },
  { offset: 0, length: 65_537 },
  { offset: 70_000, length: 1 },
  { offset: 0.5, length: 1 },
  { offset: NaN, length: 1 },
])(
  "refuses invalid worker ranges $offset/$length without exporting bytes",
  async (range) => {
    const failed = expect(detect(Buffer.alloc(70_000))).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Внутренняя ошибка сервера",
    });
    await vi.advanceTimersByTimeAsync(0);
    const worker = state.workers[0];
    worker.emit("message", { kind: "read", ...range });
    await failed;
    expect(worker.postMessage).not.toHaveBeenCalled();
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(worker.eventNames()).toEqual([]);
  },
);

/** Проверяет верхнюю границу одного фрагмента и корректное чтение последнего байта файла. */
it("caps each exported fragment and permits an exact end-of-file read", async () => {
  const bytes = Buffer.alloc(65_537, 0x61);
  bytes[65_536] = 0x62;
  const detection = detect(bytes);
  await vi.advanceTimersByTimeAsync(0);
  const worker = state.workers[0];
  worker.emit("message", { kind: "read", offset: 0, length: 65_536 });
  worker.emit("message", { kind: "read", offset: 65_536, length: 1 });
  expect(worker.postMessage.mock.calls[0][0].byteLength).toBe(65_536);
  expect(Buffer.from(worker.postMessage.mock.calls[1][0])).toEqual(
    Buffer.from("b"),
  );
  worker.emit("message", { kind: "result", result: null });
  await detection;
});

/** По дедлайну завершает зависший worker, снимает обработчики и допускает следующую задачу. */
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
  state.workers[1].emit("message", {
    kind: "result",
    result: { ext: "mp3", mime: "audio/mpeg" },
  });
  await expect(next).resolves.toEqual({ ext: "mp3", mime: "audio/mpeg" });
  expect(vi.getTimerCount()).toBe(0);
});

/** Проверяет освобождение таймеров и обработчиков после error/exit без раскрытия внутренних диагностик. */
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

/** Проверяет, что исключение конструктора Worker не блокирует последующие операции распознавания. */
it("does not poison serialization after worker construction fails", async () => {
  state.failConstruction = true;
  await expect(detect(Buffer.from("fixture"))).rejects.toThrow();
  state.failConstruction = false;
  const next = detect(Buffer.from("next"));
  await vi.advanceTimersByTimeAsync(0);
  state.workers[0].emit("message", { kind: "result", result: null });
  await expect(next).resolves.toBeUndefined();
});

/** Удерживает завершение первого worker и проверяет, что второй не выделяется до освобождения первого. */
it("awaits termination before allocating the next worker and copies only owned bytes", async () => {
  const bytes = Buffer.from("private-prefix-visible-private-suffix").subarray(
    15,
    22,
  );
  const first = detect(bytes);
  const second = detect(Buffer.from("next"));
  await vi.advanceTimersByTimeAsync(0);
  const worker = state.workers[0];
  expect(worker.options.workerData.bytes).toBeUndefined();
  worker.emit("message", { kind: "read", offset: 0, length: bytes.length });
  expect(Buffer.from(worker.postMessage.mock.calls[0][0])).toEqual(
    Buffer.from("visible"),
  );
  expect(worker.options.env).toEqual({});
  expect(worker.options.execArgv).toEqual([]);
  let finish!: (code: number) => void;
  worker.terminate.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  worker.emit("message", { kind: "result", result: null });
  await vi.advanceTimersByTimeAsync(0);
  expect(state.workers).toHaveLength(1);
  finish(0);
  await first;
  await vi.advanceTimersByTimeAsync(0);
  expect(state.workers).toHaveLength(2);
  state.workers[1].emit("message", { kind: "result", result: null });
  await second;
  expect(vi.getTimerCount()).toBe(0);
});

/** Заполняет лимит ожидающих задач, проверяет отказ лишней и восстановление допуска после освобождения слота. */
it("bounds waiting detections and admits a new request after a slot is released", async () => {
  const first = detect(Buffer.from("one"));
  const waiting = Array.from({ length: 11 }, (_, index) => detect(Buffer.from(`waiting-${index}`)));
  await vi.advanceTimersByTimeAsync(0);
  await expect(detect(Buffer.from("overflow"))).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  expect(state.workers).toHaveLength(1);
  state.workers[0].emit("message", { kind: "result", result: null });
  await first;
  const admitted = detect(Buffer.from("admitted"));
  for (const [index, detection] of [...waiting, admitted].entries()) {
    await vi.advanceTimersByTimeAsync(0);
    expect(state.workers).toHaveLength(index + 2);
    state.workers[index + 1].emit("message", { kind: "result", result: null });
    await detection;
  }
  expect(vi.getTimerCount()).toBe(0);
});

/** Проверяет общий бюджет удерживаемых буферов отдельно от ограничения числа задач. */
it("rejects queued buffers that would exceed the aggregate detector budget", async () => {
  const first = detect(Buffer.alloc(80 * 1024 * 1024));
  await vi.advanceTimersByTimeAsync(0);
  await expect(detect(Buffer.alloc(49 * 1024 * 1024))).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  expect(state.workers).toHaveLength(1);
  state.workers[0].emit("message", { kind: "result", result: null });
  await first;
});
