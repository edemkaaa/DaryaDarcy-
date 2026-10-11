import type { Route } from "@playwright/test";

// Keep interception registered until all forwarded responses have completed.
// unrouteAll(wait) alone can remove the server interceptor when the first of
// several active callbacks completes, continuing the remaining browser request.
export function trackRouteHandler(handle: (route: Route) => Promise<void>) {
  const pending = new Set<Promise<void>>();
  return {
    async handler(route: Route) {
      const task = handle(route);
      pending.add(task);
      try {
        await task;
      } finally {
        pending.delete(task);
      }
    },
    async drain() {
      while (pending.size) await Promise.all([...pending]);
    },
  };
}
