/** Читающий link проверяет ответы процедур до передачи данным экранам, чтобы успешный HTTP не скрывал повреждённый контракт. */
import { TRPCClientError, type TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "./contract";
import { invalidResponse } from "./errors";
import { validateReadResponse } from "./read-response-contracts";

/** Ответы query проходят runtime-проверку после декодирования; при ошибке наружу выходит безопасный invalid-response без payload. Проверка выполняется до прямого reader и Query cache. */
export const readResponseLink: TRPCLink<AppRouter> =
  () =>
  ({ op, next }) =>
    observable((observer) =>
      next(op).subscribe({
        /** Только после проверки передаём результат дальше в кеш или direct reader; мутации используют свои квитанции. */
        next(result) {
          try {
            if (op.type === "query" && "data" in result.result)
              // Валидация выполняется после декодирования дат и до попадания ответа в общий кеш.
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
