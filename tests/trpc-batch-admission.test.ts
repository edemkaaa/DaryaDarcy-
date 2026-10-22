import { afterAll, beforeAll, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { createBackendApplication } from "../apps/backend/src/_core/application";

let application: INestApplication;
let base: string;

beforeAll(async () => {
  application = await createBackendApplication();
  await application.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${(application.getHttpServer().address() as AddressInfo).port}`;
});
afterAll(async () => application?.close());

function batch(names: string[]) {
  return fetch(`${base}/api/trpc/${names.join(",")}?batch=1`);
}

it("rejects more than 20 operations before executing a public batch", async () => {
  const response = await batch(Array(21).fill("feed.tags"));
  expect(response.status).toBe(400);
});

it("rejects repeated full-feed reads in one batch", async () => {
  const response = await batch(["feed.list", "feed.list"]);
  expect(response.status).toBe(400);
});

it("preserves ordinary short batches", async () => {
  const response = await batch(["feed.tags", "feed.tags"]);
  expect(response.status).toBe(200);
  expect(await response.json()).toHaveLength(2);
});
