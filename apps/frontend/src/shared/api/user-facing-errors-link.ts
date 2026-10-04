import { TRPCClientError, type TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "./contract";
import { getRequestErrorMessage } from "./errors";

/** Preserve machine-readable status while keeping server internals out of every screen's message. */
export const userFacingErrorsLink: TRPCLink<AppRouter> =
  () =>
  ({ next, op }) =>
    observable((observer) =>
      next(op).subscribe({
        next: (result) => observer.next(result),
        complete: () => observer.complete(),
        error: (error) => {
          const message = getRequestErrorMessage(error);
          observer.error(
            new TRPCClientError<AppRouter>(message, {
              cause: error.cause,
              result: error.shape
                ? { error: { ...error.shape, message } }
                : undefined,
            }),
          );
        },
      }),
    );
