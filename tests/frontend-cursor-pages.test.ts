import { describe, expect, it } from "vitest";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import {
  appendCursorPage,
  type CursorChain,
  cancelInactiveCursorQuery,
} from "../apps/frontend/src/shared/api/cursor-pages";
const head: {
  items: { id: number; text?: string }[];
  nextCursor: string | null;
} = { items: [{ id: 1, text: "old" }], nextCursor: "next" };
const chain: CursorChain<typeof head> = {
  pages: [head, { items: [{ id: 2 }], nextCursor: null }],
  pageParams: [null, "next"],
};
describe("bounded cursor chains", () => {
  it("does not cancel a shared head still observed by another screen", async () => {
    const client = new QueryClient();
    const key = ["shared-cursor-test"];
    let release!: (value: number) => void,
      aborted = false;
    const held = new Promise<number>((resolve) => {
      release = resolve;
    });
    const options = {
      queryKey: key,
      queryFn: ({ signal }: { signal: AbortSignal }) => {
        signal.addEventListener("abort", () => {
          aborted = true;
        });
        return held;
      },
    };
    const first = new QueryObserver(client, options),
      second = new QueryObserver(client, options);
    const one = first.subscribe(() => {}),
      two = second.subscribe(() => {});
    one();
    cancelInactiveCursorQuery(client, key);
    await Promise.resolve();
    expect(aborted).toBe(false);
    release(7);
    await client.fetchQuery(options);
    expect(client.getQueryData(key)).toBe(7);
    two();
    client.clear();
  });
  it("does not accept a repeated boundary, preventing automatic loops", () => {
    expect(() =>
      appendCursorPage({ pages: [head], pageParams: [null] }, "next", {
        items: [{ id: 2 }],
        nextCursor: "next",
      }),
    ).toThrow();
    expect(() =>
      appendCursorPage(chain, "next", { items: [], nextCursor: null }),
    ).toThrow();
  });
});
