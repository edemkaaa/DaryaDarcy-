/** Общий tRPC middleware нормализует инфраструктурную недоступность, сохраняя явные доменные отказы. */
import { expect, it } from "vitest";
import { ServiceUnavailableException } from "@nestjs/common";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../apps/backend/src/_core/trpc";
import type { TrpcContext } from "../apps/backend/src/_core/context";

/** Пропускаем произвольную ошибку через настоящий publicProcedure caller без HTTP и БД. */
const failure = (error: unknown) =>
  router({
    read: publicProcedure.query(() => {
      throw error;
    }),
  })
    .createCaller({ user: null } as TrpcContext)
    .read();

/** Точное переполнение пула и Nest 503 превращаются в безопасный SERVICE_UNAVAILABLE без внутренних сообщений. */
it.each([
  new Error("Queue limit reached."),
  new Error("PRIVATE_SQL", { cause: new Error("Queue limit reached.") }),
  new ServiceUnavailableException("PRIVATE_INFRA"),
])(
  "preserves temporary infrastructure failure as a safe retryable tRPC error",
  async (error) => {
    await expect(failure(error)).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: "Сервис временно недоступен. Попробуйте позже.",
    });
  },
);
/** Явный TRPCError имеет приоритет над вложенной причиной переполнения. */
it.each([
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "TOO_MANY_REQUESTS",
] as const)(
  "does not reclassify an explicit %s denial even with a nested queue failure",
  async (code) => {
    await expect(
      failure(
        new TRPCError({
          code,
          message: "Domain refusal",
          cause: new Error("Queue limit reached."),
        }),
      ),
    ).rejects.toMatchObject({ code, message: "Domain refusal" });
  },
);
/** Похожая строка, lock timeout и циклический cause не должны ошибочно становиться повторяемым 503. */
it("does not treat an unknown error, SQL timeout or an unrelated message as queue exhaustion", async () => {
  for (const message of [
    "PRIVATE_UNKNOWN",
    "Lock wait timeout exceeded",
    "SELECT 'Queue limit reached.'",
  ]) {
    await expect(failure(new Error(message))).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  }
  const cycle = new Error("cycle");
  cycle.cause = cycle;
  await expect(failure(cycle)).rejects.toMatchObject({
    code: "INTERNAL_SERVER_ERROR",
  });
});
