/** Возврат от провайдера запускает проверку серверного результата, а не выдаёт доступ по параметрам браузерного адреса. */
import { z } from "zod";
import {
  ApiError,
  getRequestErrorMessage,
  invalidResponse,
} from "@/shared/api/errors";
import { runApiRequest } from "@/shared/api/request-lifecycle";
import { apiUrl } from "@/shared/config/api";
import { parseRetryAfter } from "@/shared/api/retry-after";

const referencePattern =
  /^club-test-[1-9]\d*-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.[1-9]\d{9}\.[a-f0-9]{64}$/;
const resultSchema = z.union([
  z
    .object({
      state: z.enum(["unknown", "pending"]),
      nextAction: z.null(),
      emailStatus: z.null(),
    })
    .strict(),
  z
    .object({
      state: z.literal("succeeded"),
      nextAction: z.enum(["setup", "login"]),
      emailStatus: z.enum(["pending", "sent", "unavailable"]),
    })
    .strict(),
]);
export type ProdamusReturnResult = z.infer<typeof resultSchema>;

/** Reuse the existing club return budget: six serial checks, at most 30 seconds. */
export async function pollProdamusReturnResult(
  token: string,
  caller: AbortSignal,
): Promise<ProdamusReturnResult> {
  const budget = new AbortController();
  const deadline = setTimeout(() => budget.abort(), 30_000);
  const signal = AbortSignal.any([caller, budget.signal]);
  try {
    for (let attempt = 0; ; attempt++) {
      const result = await readProdamusReturnResult(token, signal);
      signal.throwIfAborted();
      if (result.state !== "pending" || attempt === 5) return result;
      await new Promise<void>((resolve, reject) => {
        const cancel = () => {
          clearTimeout(timer);
          reject(signal.reason);
        };
        const timer = setTimeout(() => {
          signal.removeEventListener("abort", cancel);
          resolve();
        }, 2500);
        signal.addEventListener("abort", cancel, { once: true });
      });
    }
  } finally {
    clearTimeout(deadline);
  }
}

/** Only identifies an order for a read; the server verifies signature and expiry. */
export function readProdamusReturnToken(hash: string): string | null {
  const prefix = "#paymentReturn=";
  if (!hash.startsWith(prefix)) return null;
  const token = hash.slice(prefix.length);
  return token.length <= 192 && referencePattern.exec(token)?.[0] === token
    ? token
    : null;
}

/** No login, settlement, resend or provider request. Cookies are forbidden by this route. */
export async function readProdamusReturnResult(
  token: string,
  signal: AbortSignal,
): Promise<ProdamusReturnResult> {
  if (readProdamusReturnToken(`#paymentReturn=${token}`) !== token)
    throw invalidResponse();
  return runApiRequest(
    apiUrl("/api/prodamus/test/result"),
    {
      method: "POST",
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      headers: {
        "Content-Type": "application/json",
        // The validated order UUID keeps every retry in the existing quota.
        "Idempotency-Key": token.split(".")[0].slice(-36),
      },
      body: JSON.stringify({ token }),
      signal,
    },
    async (response) => {
      if (!response.ok) {
        const retry = parseRetryAfter(response.headers.get("Retry-After"));
        const retryAfterSec =
          retry !== undefined && retry <= 60 ? retry : undefined;
        throw new ApiError(
          getRequestErrorMessage({ data: { httpStatus: response.status } }),
          response.status,
          retryAfterSec,
        );
      }
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw invalidResponse();
      }
      const parsed = resultSchema.safeParse(body);
      if (!parsed.success) throw invalidResponse();
      return parsed.data;
    },
  );
}
