/** Сигнал операции проходит через tRPC до транспорта, чтобы уход с экрана отменял ожидание его результата. */
import { TRPCClientError, type TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "./contract";
import { ApiError } from "./errors";

/** A batch's fetch lives until all operations abort; each result still belongs to its own signal. */
export const operationAbortLink: TRPCLink<AppRouter> =
  () =>
  ({ op, next }) =>
    observable((observer) => {
      const error = () =>
        new TRPCClientError<AppRouter>("Запрос отменён.", {
          cause: new ApiError(
            "Запрос отменён.",
            0,
            undefined,
            false,
            "cancelled",
          ),
        });
      if (op.signal?.aborted) {
        observer.error(error());
        return;
      }
      const subscription = next(op).subscribe(observer);
      const abort = () => {
        observer.error(error());
        subscription.unsubscribe();
      };
      op.signal?.addEventListener("abort", abort, { once: true });
      if (op.signal?.aborted) abort();
      return () => {
        op.signal?.removeEventListener("abort", abort);
        subscription.unsubscribe();
      };
    });
