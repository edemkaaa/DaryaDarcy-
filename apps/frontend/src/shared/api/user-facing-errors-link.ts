import { TRPCClientError, type TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "./contract";
import { ApiError, getHttpStatus, getRequestErrorMessage } from "./errors";
import { privateUploadRejectionMessage } from "./upload-errors";

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
          const transportError =
            !error.shape && status ? new ApiError("", status) : null;
          const details = transportError ?? error;
          const message =
            (privateUploadProcedures.has(op.path)
              ? privateUploadRejectionMessage(details)
              : null) ??
            getRequestErrorMessage(
              transportError ? { data: { httpStatus: status } } : error,
            );
          if (transportError) transportError.message = message;
          const retryAfter =
            response instanceof Response
              ? response.headers.get("Retry-After")
              : null;
          const seconds =
            retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : 0;
          observer.error(
            new TRPCClientError<AppRouter>(message, {
              cause: transportError ?? error.cause,
              // Keep only the validated delay, not private response/body metadata.
              meta:
                Number.isSafeInteger(seconds) && seconds > 0
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
