import { TRPCClientError, type TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "./contract";
import {
  ApiError,
  getHttpStatus,
  getRequestErrorMessage,
  invalidResponse,
} from "./errors";
import { privateUploadRejectionMessage } from "./upload-errors";
import { parseRetryAfter } from "./retry-after";

const privateUploadProcedures = new Set([
  "admin.uploadPrivateContentFile",
  "admin.privateContentFileStatus",
  "admin.uploadPrivateAttachment",
  "admin.privateAttachmentStatus",
  "club.uploadPrivateCommentPhoto",
  "club.privateCommentPhotoStatus",
]);

/** Preserve machine-readable status while keeping server internals out of every screen's message. */
export const userFacingErrorsLink: TRPCLink<AppRouter> =
  () =>
  ({ next, op }) =>
    observable((observer) =>
      next(op).subscribe({
        next: (result) => observer.next(result),
        complete: () => observer.complete(),
        error: (error) => {
          const response = error.meta?.response;
          // Body-size limits and disabled routes can reply before tRPC runs.
          const status =
            getHttpStatus(error) ??
            (response instanceof Response && !response.ok
              ? response.status
              : undefined);
          const seconds =
            (response instanceof Response
              ? parseRetryAfter(response.headers.get("Retry-After"))
              : undefined) ??
            (error.cause instanceof ApiError
              ? error.cause.retryAfterSec
              : undefined);
          const transportError = error.shape
            ? null
            : status
              ? new ApiError("", status, seconds)
              : response instanceof Response
                ? invalidResponse()
                : null;
          const details = transportError ?? error;
          const message =
            (privateUploadProcedures.has(op.path)
              ? privateUploadRejectionMessage(details)
              : null) ??
            getRequestErrorMessage(
              transportError?.kind === "http"
                ? { data: { httpStatus: status } }
                : (transportError ?? error),
            );
          if (transportError) transportError.message = message;
          observer.error(
            new TRPCClientError<AppRouter>(message, {
              cause: transportError ?? error.cause,
              // Keep only the validated delay, not private response/body metadata.
              meta:
                seconds !== undefined &&
                Number.isSafeInteger(seconds) &&
                seconds > 0
                  ? { retryAfterSec: seconds }
                  : undefined,
              result: error.shape
                ? { error: { ...error.shape, message } }
                : undefined,
            }),
          );
        },
      }),
    );
