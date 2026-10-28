import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
} from "vitest";
import superjson from "superjson";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { ClubCheckoutService } from "../apps/backend/src/billing/club-checkout.service";
import { SessionService } from "../apps/backend/src/identity/session.service";
import type { User } from "../packages/database/src/schema";

let app: Awaited<ReturnType<typeof createBackendApplication>>, base: string;
let actor: User | null = null;
let now = Date.now();
beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "");
  app = await createBackendApplication();
  await app.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${app.getHttpServer().address().port}/api/trpc/`;
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  now += 16 * 60_000;
  vi.setSystemTime(now);
  actor = null;
  vi.spyOn(app.get(SessionService), "optionalUser").mockImplementation(
    async () => actor,
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
afterAll(async () => {
  await app.close();
  vi.unstubAllEnvs();
});
const send = (ip: string) =>
  fetch(base + "club.createCheckout", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
    body: superjson.stringify({ email: "fixture@example.test" }),
  });

it("limits an authenticated account across different IPs before provider calls, then allows recovery after the window", async () => {
  actor = {
    id: 70091,
    sessionVersion: 0,
    role: "user",
    blockedAt: null,
  } as User;
  const provider = vi
    .spyOn(app.get(ClubCheckoutService), "createCheckout")
    .mockResolvedValue({ url: "https://fixture.example.test/pay", user: null });
  for (let i = 0; i < 5; i++)
    expect((await send(`198.51.100.${i + 1}`)).status).toBe(200);
  const refused = await send("198.51.100.10");
  expect(refused.status).toBe(429);
  expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
  expect(provider).toHaveBeenCalledTimes(5);
  vi.setSystemTime(now + 15 * 60_000 + 1);
  expect((await send("198.51.100.11")).status).toBe(200);
});

it("counts every guest procedure in a batch rather than just the HTTP envelope", async () => {
  const provider = vi
    .spyOn(app.get(ClubCheckoutService), "createCheckout")
    .mockResolvedValue({ url: "https://fixture.example.test/pay", user: null });
  const replies: any[] = [];
  for (const size of [20, 11]) {
    const body = Object.fromEntries(
      Array.from({ length: size }, (_, i) => [
        i,
        superjson.serialize({ email: `fixture${i}@example.test` }),
      ]),
    );
    const response = await fetch(
      base + Array(size).fill("club.createCheckout").join(",") + "?batch=1",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": "203.0.113.40",
        },
        body: JSON.stringify(body),
      },
    );
    const data = await response.json();
    expect(Array.isArray(data), JSON.stringify(data)).toBe(true);
    replies.push(...data);
  }
  expect(replies.filter((x: any) => x.result)).toHaveLength(30);
  expect(
    replies.filter((x: any) => x.error?.json?.data?.httpStatus === 429),
  ).toHaveLength(1);
  expect(provider).toHaveBeenCalledTimes(30);
});
