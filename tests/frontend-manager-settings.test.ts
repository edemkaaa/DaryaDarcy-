import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryObserver } from "@tanstack/react-query";
import { apiCall, ApiError } from "../apps/frontend/src/shared/api/auth";
import { createAppQueryClient } from "../apps/frontend/src/shared/api/query-client";
import {
  PUBLIC_LAUNCH_KEY,
  publicConfigurationOptions,
} from "../apps/frontend/src/domain/launch/public-configuration";
import {
  parseManagerOrderSettings,
  parsePublicAppearance,
} from "../apps/frontend/src/domain/launch/settings";

vi.mock("../apps/frontend/src/shared/api/auth", async (original) => ({
  ...(await original<typeof import("../apps/frontend/src/shared/api/auth")>()),
  apiCall: vi.fn(),
}));
const read = vi.mocked(apiCall);
const appearance = { startsOn: "11-20", backgroundUrl: null, bannerUrl: null };
const configuration = () => ({
  revision: 7,
  season: "winter",
  appearance,
  managerEmail: "daryadarcyapp@yandex.ru",
  orderMethod: "email-client",
});
beforeEach(() => read.mockReset());

describe("manager order settings", () => {
  it("reads the configured recipient without a local fallback", () => {
    expect(parseManagerOrderSettings(configuration())).toEqual({
      revision: 7,
      managerEmail: "daryadarcyapp@yandex.ru",
      orderMethod: "email-client",
    });
    expect(
      parseManagerOrderSettings({
        ...configuration(),
        managerEmail: "orders+shop@different.example.test",
      }).managerEmail,
    ).toBe("orders+shop@different.example.test");
  });
  it.each([
    undefined,
    null,
    "",
    "not-an-email",
    " manager@example.test",
    "manager@example.test,other@example.test",
    "manager@example.test?subject=changed",
    "manager@example.test\r\nBcc:other@example.test",
    "manager.@example.test",
    "x".repeat(320) + "@example.test",
  ])("rejects an absent or invalid recipient %#", (managerEmail) => {
    expect(() =>
      parseManagerOrderSettings({ ...configuration(), managerEmail }),
    ).toThrow(ApiError);
  });
  it.each([undefined, "server", "mailto", "", null])(
    "does not guess an unsupported order method %#",
    (orderMethod) => {
      expect(() =>
        parseManagerOrderSettings({ ...configuration(), orderMethod }),
      ).toThrow(ApiError);
    },
  );
  it("requires a valid configuration revision", () => {
    expect(() =>
      parseManagerOrderSettings({ ...configuration(), revision: -1 }),
    ).toThrow(ApiError);
  });
});

it("shares one pending read between Club and order settings and retains the full response", async () => {
  const client = createAppQueryClient();
  let resolve!: (value: unknown) => void;
  read.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const club = new QueryObserver(client, {
    ...publicConfigurationOptions(),
    select: parsePublicAppearance,
  });
  const unsubscribeClub = club.subscribe(() => {});
  const orders = new QueryObserver(client, {
    ...publicConfigurationOptions(),
    select: parseManagerOrderSettings,
  });
  const unsubscribeOrders = orders.subscribe(() => {});
  try {
    expect(club.getCurrentResult().isLoading).toBe(true);
    expect(orders.getCurrentResult().isLoading).toBe(true);
    expect(read).toHaveBeenCalledTimes(1);
    const value = configuration();
    resolve(value);
    await vi.waitFor(() =>
      expect(orders.getCurrentResult().isSuccess).toBe(true),
    );
    expect(club.getCurrentResult().data?.season).toBe("winter");
    expect(orders.getCurrentResult().data?.managerEmail).toBe(
      value.managerEmail,
    );
    expect(client.getQueryData(PUBLIC_LAUNCH_KEY)).toEqual(value);
    expect(read).toHaveBeenCalledWith("/api/launch-config", {
      signal: expect.any(AbortSignal),
    });
  } finally {
    unsubscribeClub();
    unsubscribeOrders();
    client.clear();
  }
});

it("keeps valid Club appearance available when manager settings are invalid", async () => {
  const client = createAppQueryClient();
  read.mockResolvedValue({ ...configuration(), managerEmail: "" });
  const club = new QueryObserver(client, {
    ...publicConfigurationOptions(),
    select: parsePublicAppearance,
  });
  const orders = new QueryObserver(client, {
    ...publicConfigurationOptions(),
    select: parseManagerOrderSettings,
  });
  try {
    await club.refetch();
    orders.updateResult();
    expect(club.getCurrentResult().isSuccess).toBe(true);
    expect(orders.getCurrentResult().isError).toBe(true);
    expect(orders.getCurrentResult().data).toBeUndefined();
  } finally {
    client.clear();
  }
});

it("reads order settings independently of a malformed seasonal image", async () => {
  const client = createAppQueryClient();
  read.mockResolvedValue({ ...configuration(), appearance: null });
  const orders = new QueryObserver(client, {
    ...publicConfigurationOptions(),
    select: parseManagerOrderSettings,
  });
  try {
    const result = await orders.refetch();
    expect(result.isSuccess).toBe(true);
    expect(result.data?.managerEmail).toBe(configuration().managerEmail);
  } finally {
    client.clear();
  }
});

it("reports a failed refresh and recovers with an explicit retry without automatic repeats", async () => {
  const client = createAppQueryClient();
  read
    .mockResolvedValueOnce(configuration())
    .mockRejectedValueOnce(new ApiError("Unavailable", 503))
    .mockResolvedValueOnce({
      ...configuration(),
      revision: 8,
      managerEmail: "new@example.test",
    });
  const orders = new QueryObserver(client, {
    ...publicConfigurationOptions(),
    select: parseManagerOrderSettings,
  });
  try {
    expect((await orders.refetch()).isSuccess).toBe(true);
    expect((await orders.refetch()).isError).toBe(true);
    expect(read).toHaveBeenCalledTimes(2);
    const recovered = await orders.refetch();
    expect(recovered.isSuccess).toBe(true);
    expect(recovered.data?.managerEmail).toBe("new@example.test");
    expect(read).toHaveBeenCalledTimes(3);
  } finally {
    client.clear();
  }
});

it("keeps the last confirmed Club appearance when selection rejects a later response", async () => {
  const client = createAppQueryClient();
  read
    .mockResolvedValueOnce(configuration())
    .mockResolvedValueOnce({ ...configuration(), season: "unknown" });
  const club = new QueryObserver(client, {
    ...publicConfigurationOptions(),
    select: parsePublicAppearance,
  });
  try {
    const confirmed = await club.refetch();
    const rejected = await club.refetch();
    expect(rejected.isError).toBe(true);
    expect(rejected.data).toEqual(confirmed.data);
  } finally {
    client.clear();
  }
});
