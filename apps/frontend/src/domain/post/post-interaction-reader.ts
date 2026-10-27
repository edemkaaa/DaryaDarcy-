import {
  interactionBatches,
  requirePostInteractions,
  type PostInteractions,
} from "./post-interaction-data";
import { invalidResponse } from "@/shared/api/errors";

export type PostInteractionSnapshot = PostInteractions & {
  readVersion: number;
};
type Group = { controller: AbortController; entries: Entry[] };
type Entry = {
  id: number;
  signal: AbortSignal;
  resolve: (value: PostInteractionSnapshot) => void;
  reject: (error: unknown) => void;
  abort: () => void;
  group?: Group;
};

/** One cache entry per post, one wire request per batch of newly needed IDs. */
export function createPostInteractionReader(
  load: (ids: number[], signal: AbortSignal) => Promise<unknown>,
) {
  const entries = new Set<Entry>();
  let scheduled: ReturnType<typeof setTimeout> | undefined;
  let readVersion = 0;
  const release = (entry: Entry) => {
    entries.delete(entry);
    entry.signal.removeEventListener("abort", entry.abort);
  };
  const run = async (group: Group, ids: number[]) => {
    try {
      const data = requirePostInteractions(
        await load(ids, group.controller.signal),
        ids,
      );
      group.controller.signal.throwIfAborted();
      const version = ++readVersion;
      for (const entry of group.entries) {
        if (!entries.has(entry)) continue;
        release(entry);
        entry.resolve({
          likedIds: data.likedIds.includes(entry.id) ? [entry.id] : [],
          savedIds: data.savedIds.includes(entry.id) ? [entry.id] : [],
          readVersion: version,
        });
      }
    } catch (error) {
      for (const entry of group.entries) {
        if (!entries.has(entry)) continue;
        release(entry);
        entry.reject(error);
      }
    }
  };
  const flush = () => {
    scheduled = undefined;
    const queued = [...entries].filter((entry) => !entry.group);
    for (const ids of interactionBatches(queued.map((entry) => entry.id))) {
      const selected = new Set(ids);
      const group: Group = {
        controller: new AbortController(),
        entries: queued.filter((entry) => selected.has(entry.id)),
      };
      for (const entry of group.entries) entry.group = group;
      void run(group, ids);
    }
  };
  return {
    read(id: number, signal: AbortSignal): Promise<PostInteractionSnapshot> {
      if (signal.aborted) return Promise.reject(signal.reason);
      if (!Number.isSafeInteger(id) || id <= 0)
        return Promise.reject(invalidResponse());
      return new Promise((resolve, reject) => {
        const entry: Entry = {
          id,
          signal,
          resolve,
          reject,
          abort: () => {
            if (!entries.has(entry)) return;
            release(entry);
            reject(
              signal.reason ??
                new DOMException("Операция отменена", "AbortError"),
            );
            const group = entry.group;
            if (group && group.entries.every((item) => !entries.has(item)))
              group.controller.abort();
            if (entries.size === 0 && scheduled !== undefined) {
              clearTimeout(scheduled);
              scheduled = undefined;
            }
          },
        };
        entries.add(entry);
        signal.addEventListener("abort", entry.abort, { once: true });
        // Retry timers run in separate tasks. A short collection window also
        // batches those reads instead of issuing one procedure per post.
        if (scheduled === undefined) scheduled = setTimeout(flush, 5);
      });
    },
    cancel() {
      for (const entry of entries) entry.abort();
    },
  };
}
