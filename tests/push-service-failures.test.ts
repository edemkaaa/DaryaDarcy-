import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as db from "../apps/backend/src/db";
import {
  sendMarketingPostNotification,
  sendServicePushNotification,
} from "../apps/backend/src/push";

const token = "ExponentPushToken[private-fixture]";
const privateFailure = () =>
  new Error(`SELECT token FROM push_tokens: ${token}`);

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("No provider request is allowed after a storage failure");
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("service notification contains a recipient-store failure without logging tokens or SQL", async () => {
  vi.spyOn(db, "getPushTokensForUser").mockRejectedValue(privateFailure());

  await expect(
    sendServicePushNotification({
      userId: 42,
      title: "Fixture",
      body: "Fixture",
    }),
  ).resolves.toBe(0);

  expect(fetch).not.toHaveBeenCalled();
  expect(console.warn).toHaveBeenCalledExactlyOnceWith(
    "[Push] Service notification failed",
  );
});

it("service notification contains an asynchronous audience recheck failure instead of rejecting after commit", async () => {
  vi.spyOn(db, "getPushTokensForUser").mockResolvedValue([token]);
  vi.spyOn(db, "getServicePushTokens")
    .mockResolvedValueOnce([token])
    .mockRejectedValueOnce(privateFailure());

  await expect(
    sendServicePushNotification({
      userId: 42,
      title: "Fixture",
      body: "Fixture",
    }),
  ).resolves.toBe(0);

  expect(fetch).not.toHaveBeenCalled();
  expect(console.warn).toHaveBeenCalledExactlyOnceWith(
    "[Push] Service notification failed",
  );
});

it("marketing notification contains a storage failure without logging recipient data", async () => {
  vi.spyOn(db, "getMarketingPushTokens").mockRejectedValue(privateFailure());

  await expect(
    sendMarketingPostNotification("Fixture", 42, "club"),
  ).resolves.toBeUndefined();

  expect(fetch).not.toHaveBeenCalled();
  expect(console.warn).toHaveBeenCalledExactlyOnceWith(
    "[Push] Marketing notification failed",
  );
});
