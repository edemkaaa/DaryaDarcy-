import { TRPCError } from "@trpc/server";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

export interface BinaryFileType {
  ext: string;
  mime: string;
}

// Fixed trusted code, never interpolated with caller input. Only bytes cross this
// boundary; dependency resolution belongs to the application, not the request.
const DETECTOR_SOURCE = `
const { parentPort, workerData } = require("node:worker_threads");
(async () => {
  const { fileTypeFromBuffer } = await import(workerData.moduleUrl);
  let result;
  try { result = await fileTypeFromBuffer(workerData.bytes); }
  catch { result = undefined; }
  parentPort.postMessage(result ?? null);
})();
`;
const requireDependency = createRequire(
  typeof __filename === "string" ? __filename : import.meta.url,
);
let precedingDetection: Promise<unknown> = Promise.resolve();

async function detectInWorker(
  bytes: Buffer,
): Promise<BinaryFileType | undefined> {
  // A fresh backing buffer avoids transferring/detaching the storage bytes or
  // cloning unrelated bytes from a pooled Buffer. The caller enforces size limits.
  const copy = new Uint8Array(bytes);
  const worker = new Worker(DETECTOR_SOURCE, {
    eval: true,
    execArgv: [],
    env: {},
    workerData: {
      moduleUrl: pathToFileURL(requireDependency.resolve("file-type")).href,
      bytes: copy,
    },
    transferList: [copy.buffer],
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
      worker.once("message", (result: BinaryFileType | null) =>
        resolve(result ?? undefined),
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

/** A bounded active detector, not an HTTP quota; pending requests keep their own bytes. */
export function detectBinaryFileType(
  bytes: Buffer,
): Promise<BinaryFileType | undefined> {
  const detection = precedingDetection.then(() => detectInWorker(bytes));
  precedingDetection = detection.catch(() => undefined);
  return detection;
}
