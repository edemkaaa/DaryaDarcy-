/** Определяем бинарный тип по сигнатуре файла, а не по переданному клиентом расширению. */
import { TRPCError } from "@trpc/server";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

export interface BinaryFileType {
  ext: string;
  mime: string;
}

const DETECTOR_CHUNK_BYTES = 64 * 1024;
// Fixed trusted code. Random-access reads retain full-file detection semantics,
// but only bounded independent byte copies cross the worker boundary.
const DETECTOR_SOURCE = `
const { parentPort, workerData } = require("node:worker_threads");
(async () => {
  const { fileTypeFromTokenizer } = await import(workerData.moduleUrl);
  const { AbstractTokenizer, EndOfStreamError } = await import(workerData.tokenizerUrl);
  class RangeTokenizer extends AbstractTokenizer {
    fileInfo = { size: workerData.size };
    supportsRandomAccess() { return true; }
    setPosition(position) { this.position = position; }
    async readBuffer(buffer, options) {
      if (options?.position) this.position = options.position;
      const length = await this.peekBuffer(buffer, options);
      this.position += length;
      return length;
    }
    async peekBuffer(buffer, options) {
      const normalized = this.normalizeOptions(buffer, options);
      const length = Math.min(this.fileInfo.size - normalized.position, normalized.length);
      if (!normalized.mayBeLess && length < normalized.length) throw new EndOfStreamError();
      for (let offset = 0; offset < length; offset += workerData.chunkBytes) {
        const chunk = await new Promise(resolve => {
          parentPort.once("message", resolve);
          parentPort.postMessage({ kind: "read", offset: normalized.position + offset,
            length: Math.min(workerData.chunkBytes, length - offset) });
        });
        buffer.set(chunk, offset);
      }
      return length;
    }
  }
  let result;
  try { result = await fileTypeFromTokenizer(new RangeTokenizer()); }
  catch { result = undefined; }
  parentPort.postMessage({ kind: "result", result: result ?? null });
})();
`;
const requireDependency = createRequire(
  typeof __filename === "string" ? __filename : import.meta.url,
);
let precedingDetection: Promise<unknown> = Promise.resolve();
const MAX_OUTSTANDING_DETECTIONS = 12;
const MAX_OUTSTANDING_BYTES = 128 * 1024 * 1024;
let outstandingDetections = 0;
let outstandingBytes = 0;

async function detectInWorker(
  bytes: Buffer,
): Promise<BinaryFileType | undefined> {
  const worker = new Worker(DETECTOR_SOURCE, {
    eval: true,
    execArgv: [],
    env: {},
    workerData: {
      moduleUrl: pathToFileURL(requireDependency.resolve("file-type")).href,
      tokenizerUrl: pathToFileURL(requireDependency.resolve("strtok3/core"))
        .href,
      size: bytes.length,
      chunkBytes: DETECTOR_CHUNK_BYTES,
    },
    resourceLimits: {
      maxOldGenerationSizeMb: 64,
      maxYoungGenerationSizeMb: 16,
    },
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await new Promise<BinaryFileType | undefined>((resolve, reject) => {
      timer = setTimeout(() => {
        reject(
          new TRPCError({
            code: "BAD_REQUEST",
            message: "Не удалось распознать файл",
          }),
        );
      }, 5_000);
      worker.on(
        "message",
        (
          message:
            | { kind: "read"; offset: number; length: number }
            | { kind: "result"; result: BinaryFileType | null },
        ) => {
          if (message?.kind === "result") {
            resolve(message.result ?? undefined);
            return;
          }
          if (
            message?.kind !== "read" ||
            !Number.isSafeInteger(message.offset) ||
            !Number.isSafeInteger(message.length) ||
            message.offset < 0 ||
            message.length < 1 ||
            message.length > DETECTOR_CHUNK_BYTES ||
            message.offset > bytes.length - message.length
          ) {
            reject(
              new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Внутренняя ошибка сервера",
              }),
            );
            return;
          }
          // Never transfer/detach the storage buffer or include its pooled neighbours.
          const chunk = new Uint8Array(
            bytes.subarray(message.offset, message.offset + message.length),
          );
          worker.postMessage(chunk, [chunk.buffer]);
        },
      );
      worker.once("error", () =>
        reject(
          new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Внутренняя ошибка сервера",
          }),
        ),
      );
      worker.once("exit", () =>
        reject(
          new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Внутренняя ошибка сервера",
          }),
        ),
      );
    });
  } finally {
    clearTimeout(timer);
    // Await teardown before releasing the serialized slot, including on timeout.
    await worker.terminate();
    worker.removeAllListeners();
  }
}

/** One active detector with bounded pending requests and retained input bytes. */
export function detectBinaryFileType(
  bytes: Buffer,
): Promise<BinaryFileType | undefined> {
  if (outstandingDetections >= MAX_OUTSTANDING_DETECTIONS ||
      bytes.length > MAX_OUTSTANDING_BYTES - outstandingBytes) {
    return Promise.reject(new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Обработка файлов временно занята" }));
  }
  outstandingDetections += 1;
  outstandingBytes += bytes.length;
  const detection = precedingDetection.then(() => detectInWorker(bytes)).finally(() => {
    outstandingDetections -= 1;
    outstandingBytes -= bytes.length;
  });
  precedingDetection = detection.catch(() => undefined);
  return detection;
}
