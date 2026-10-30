import { TRPCClientError, type TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "./contract";
import { invalidResponse } from "./errors";
import { validateReadResponse } from "./read-response-contracts";

/** Runs after SuperJSON decoding and before either direct readers or Query cache. */
export const readResponseLink: TRPCLink<AppRouter> =
  () =>
  ({ op, next }) =>
    observable((observer) =>
      next(op).subscribe({
        next(result) {
          try {
            if (op.type === "query" && "data" in result.result)
              validateReadResponse(op.path, result.result.data, op.input);
          } catch {
            // Do not attach the payload, Zod issues, or private server metadata.
            const cause = invalidResponse();
            observer.error(
              new TRPCClientError<AppRouter>(cause.message, { cause }),
            );
            return;
          }
          observer.next(result);
        },
        error: (error) => observer.error(error),
        complete: () => observer.complete(),
      }),
    );
