import type { ScopedOperation } from "@/shared/browser/operation-scope";
import { ApiError, getHttpStatus, invalidResponse } from "@/shared/api/errors";
import { privateUploadRejectionMessage } from "@/shared/api/upload-errors";

export type PrivateUploadStatus = (
  input: { idempotencyKey: string },
  signal: AbortSignal,
) => Promise<unknown>;

/** Read-only probe before a new upload intent. It never resolves an older write. */
export async function checkPrivateUploadAvailability(
  status: PrivateUploadStatus,
  operation: ScopedOperation,
): Promise<void> {
  operation.assertCurrent();
  try {
    const result = await status(
      { idempotencyKey: `availability:${crypto.randomUUID()}` },
      operation.signal,
    );
    operation.assertCurrent();
    if (
      !result ||
      typeof result !== "object" ||
      Object.keys(result).length !== 1 ||
      (result as { state?: unknown }).state !== "notRecorded"
    )
      throw invalidResponse();
  } catch (error) {
    operation.assertCurrent();
    const message = privateUploadRejectionMessage(error);
    if (message) throw new ApiError(message, getHttpStatus(error));
    throw error;
  }
}
