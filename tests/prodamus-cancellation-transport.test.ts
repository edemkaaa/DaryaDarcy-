import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Profile } from "../apps/backend/src/billing/cancellation";
import { cancelProdamusSubscription } from "../apps/backend/src/prodamus";

const secret = "cancellation-transport-fixture-only";
const profile: Profile = {
  profileKey: "fixture-profile",
  userId: 42,
  domain: "127.0.0.1",
  subscriptionId: "7",
  profileId: "23",
  email: "fixture@example.test",
  amountMinor: 79000,
  cancelRequestedAt: null,
  cancelledAt: null,
  attempts: 0,
  nextAttemptAt: new Date("2026-10-08T00:00:00Z"),
  leaseId: null,
  leaseUntil: null,
};

type RequestRecord = { method: string | undefined; path: string; body: string };
let merchant: Server;
let destination: Server;
let merchantOrigin: string;
let destinationOrigin: string;
let status: number;
let responseBody: string;
let location: string | undefined;
let merchantRequests: RequestRecord[];
let forwardedRequests: RequestRecord[];

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No local port");
  return `http://127.0.0.1:${address.port}`;
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });
}

beforeAll(async () => {
  destination = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk.toString();
    forwardedRequests.push({
      method: request.method,
      path: request.url!,
      body,
    });
    response.end("success");
  });
  destinationOrigin = await listen(destination);
  merchant = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk.toString();
    merchantRequests.push({ method: request.method, path: request.url!, body });
    // A same-origin redirect must not replace the configured endpoint either.
    if (request.url === "/unconfigured-success") {
      response.end("success");
      return;
    }
    response.statusCode = status;
    if (location) response.setHeader("Location", location);
    response.end(responseBody);
  });
  merchantOrigin = await listen(merchant);
});

afterAll(async () => {
  await Promise.all([close(merchant), close(destination)]);
});

beforeEach(() => {
  status = 200;
  responseBody = "success";
  location = undefined;
  merchantRequests = [];
  forwardedRequests = [];
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("PRODAMUS_SECRET", secret);
  vi.stubEnv("PRODAMUS_SUBSCRIPTION_ID", "7");
  vi.stubEnv("PRODAMUS_PAYFORM_URL", merchantOrigin);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("native Prodamus cancellation transport", () => {
  it.each([301, 302, 303, 307, 308])(
    "does not follow a %i response or confirm another origin's success",
    async (redirectStatus) => {
      status = redirectStatus;
      location = `${destinationOrigin}/untrusted-success`;
      const confirmed = await cancelProdamusSubscription(profile);
      expect({ confirmed, forwarded: forwardedRequests.length }).toEqual({
        confirmed: false,
        forwarded: 0,
      });
      expect(merchantRequests).toHaveLength(1);
      expect(console.warn).toHaveBeenCalledExactlyOnceWith(
        "[prodamus] setActivity failed",
      );
    },
  );

  it("does not accept success from an unconfigured same-origin path", async () => {
    status = 307;
    location = `${merchantOrigin}/unconfigured-success`;
    expect(await cancelProdamusSubscription(profile)).toBe(false);
    expect(merchantRequests).toHaveLength(1);
    expect(forwardedRequests).toHaveLength(0);
  });

  it.each([false, true])(
    "preserves the independently signed cancellation request (manager=%s)",
    async (manager) => {
      responseBody = "  success\n";
      expect(await cancelProdamusSubscription({ ...profile, manager })).toBe(
        true,
      );
      expect(merchantRequests).toHaveLength(1);
      const [request] = merchantRequests;
      const activeField = manager ? "active_manager" : "active_user";
      const canonical = manager
        ? '{"active_manager":"0","profile":"23","subscription":"7"}'
        : '{"active_user":"0","profile":"23","subscription":"7"}';
      const signature = createHmac("sha256", secret)
        .update(canonical, "utf8")
        .digest("hex");
      expect(request.method).toBe("POST");
      expect(request.path).toBe("/rest/setActivity/");
      expect(Object.fromEntries(new URLSearchParams(request.body))).toEqual({
        subscription: "7",
        profile: "23",
        [activeField]: "0",
        signature,
      });
      expect(forwardedRequests).toHaveLength(0);
      expect(console.warn).not.toHaveBeenCalled();
    },
  );

  it.each([
    [200, "not-success"],
    [200, ""],
    [204, ""],
    [500, "success"],
  ])("does not confirm status %i / body %j", async (code, body) => {
    status = code;
    responseBody = body;
    expect(await cancelProdamusSubscription(profile)).toBe(false);
    expect(merchantRequests).toHaveLength(1);
    expect(forwardedRequests).toHaveLength(0);
  });

  it.each([
    { domain: "other.example.test" },
    { subscriptionId: "8" },
    { profileId: "" },
  ])("retains profile binding before any request: %j", async (fields) => {
    expect(await cancelProdamusSubscription({ ...profile, ...fields })).toBe(
      false,
    );
    expect(merchantRequests).toHaveLength(0);
    expect(forwardedRequests).toHaveLength(0);
  });

  it("retains the production prohibition on plain HTTP", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await cancelProdamusSubscription(profile)).toBe(false);
    expect(merchantRequests).toHaveLength(0);
    expect(forwardedRequests).toHaveLength(0);
  });
});
