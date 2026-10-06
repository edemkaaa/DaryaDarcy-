import { afterEach, expect, it, vi } from "vitest";
import {
  QueryObserver,
  focusManager,
  onlineManager,
} from "@tanstack/react-query";
import { createAppQueryClient } from "../apps/frontend/src/shared/api/query-client";
import { subscribeSessionChecks } from "../apps/frontend/src/shared/api/session-events";
import { ApiError } from "../apps/frontend/src/shared/api/errors";

afterEach(() => {
  onlineManager.setOnline(true);
  focusManager.setFocused(undefined);
  vi.useRealTimers();
});

it("reuses fresh data and refetches after an explicit invalidation", async () => {
  const client = createAppQueryClient();
  const queryFn = vi.fn(async () => ["POST"]);
  const options = { queryKey: ["posts"], queryFn };
  try {
    await client.fetchQuery(options);
    await client.fetchQuery(options);
    expect(queryFn).toHaveBeenCalledTimes(1);
    await client.invalidateQueries({ queryKey: ["posts"] });
    await client.fetchQuery(options);
    expect(queryFn).toHaveBeenCalledTimes(2);
  } finally {
    client.clear();
  }
});

it("keeps inactive data for five minutes, then releases it", async () => {
  vi.useFakeTimers();
  const client = createAppQueryClient();
  try {
    await client.fetchQuery({
      queryKey: ["posts"],
      queryFn: async () => ["POST"],
    });
    await vi.advanceTimersByTimeAsync(4 * 60_000);
    expect(client.getQueryData(["posts"])).toEqual(["POST"]);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(client.getQueryData(["posts"])).toBeUndefined();
  } finally {
    client.clear();
  }
});

it("stale content stays cached when focus or the connection returns", async () => {
  const client = createAppQueryClient();
  const queryFn = vi.fn(async () => ["POST"]);
  await client.fetchQuery({ queryKey: ["posts"], queryFn });
  const observer = new QueryObserver(client, {
    queryKey: ["posts"],
    queryFn,
    staleTime: 0,
    refetchOnMount: false,
  });
  const unsubscribe = observer.subscribe(() => {});
  client.mount();
  try {
    focusManager.setFocused(false);
    onlineManager.setOnline(false);
    focusManager.setFocused(true);
    onlineManager.setOnline(true);
    // Resume callbacks run through the QueryClient's asynchronous event listeners.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(observer.getCurrentResult().data).toEqual(["POST"]);
    expect(observer.getCurrentResult().isFetching).toBe(false);
  } finally {
    unsubscribe();
    client.unmount();
    client.clear();
  }
});

it.each([401, 403])(
  "protected query rejection still asks for a session check: %s",
  async (status) => {
    const client = createAppQueryClient();
    const verify = vi.fn();
    const unsubscribe = subscribeSessionChecks(verify);
    const queryFn = vi.fn(async () => {
      throw new ApiError("denied", status);
    });
    try {
      await expect(
        client.fetchQuery({ queryKey: ["private"], queryFn }),
      ).rejects.toThrow("denied");
      expect(verify).toHaveBeenCalledExactlyOnceWith(status);
      expect(queryFn).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
      client.clear();
    }
  },
);

it("a failed mutation is never retried automatically", async () => {
  const client = createAppQueryClient();
  const mutationFn = vi.fn(async () => {
    throw new ApiError("unavailable", 503);
  });
  try {
    const mutation = client.getMutationCache().build(client, { mutationFn });
    await expect(mutation.execute(undefined)).rejects.toThrow("unavailable");
    expect(mutationFn).toHaveBeenCalledTimes(1);
  } finally {
    client.clear();
  }
});
