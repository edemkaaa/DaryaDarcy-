/** Сигнал операции проходит через tRPC до транспорта, чтобы уход с экрана отменял ожидание его результата. */
import { TRPCClientError, type TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "./contract";
import { ApiError } from "./errors";

/** Каждый observer прекращается по своему signal, даже если общий batch-fetch ещё нужен другим операциям; unsubscribe снимает подписку. */
export const operationAbortLink: TRPCLink<AppRouter> =
  () =>
  ({ op, next }) =>
    observable((observer) => {
      /** Создаём узнаваемую отмену без HTTP-отказа, чтобы интерфейс не счёл её доказательством отсутствия серверной записи. */
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
      /** Прекращаем только свою доставку результата и подписку; общий HTTP-batch управляет сроком остальных операций самостоятельно. */
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
