import { afterAll, beforeAll, expect, it } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { TRPCError } from "@trpc/server";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { publicProcedure, router } from "../apps/backend/src/_core/trpc";
let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  app.use("/api/trpc", createExpressMiddleware({
    router: router({
      broken: publicProcedure.query(() => { throw new Error("SQL failed params: PRIVATE_HASH_SENTINEL private@example.test"); }),
      invalid: publicProcedure.query(() => { throw new TRPCError({ code: "BAD_REQUEST", message: "Некорректные настройки" }); }),
    }),
    createContext: ({ req, res }) => ({ req, res, user: null }),
  }));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
it("does not return internal SQL/credentials or stack traces to API callers", async () => {
  const response = await fetch(`${base}/api/trpc/broken`);
  expect(response.status).toBe(500);
  const body = await response.text();
  expect(body).not.toMatch(/SQL failed|PRIVATE_HASH_SENTINEL|private@example|api-error-privacy|stack/);
});
it("preserves actionable validation errors without exposing a stack", async () => {
  const response = await fetch(`${base}/api/trpc/invalid`);
  expect(response.status).toBe(400);
  expect(await response.text()).toContain("Некорректные настройки");
});
