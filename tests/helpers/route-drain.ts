import type { BrowserContext, Page, Route } from "@playwright/test";

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

/** Page fallback handlers share route state with the context interceptor. */
export async function removePageRoutes(
  page: Page,
  proxy: { drain(): Promise<void> },
) {
  await proxy.drain();
  await page.unrouteAll({ behavior: "wait" });
}

export async function drainBrowserRoutes(
  context: BrowserContext,
  proxy: { drain(): Promise<void> },
) {
  // Removing a page handler can continue an outstanding context request too.
  // Drain before either layer is removed, then drain newly forwarded work again.
  await proxy.drain();
  for (const page of context.pages()) await removePageRoutes(page, proxy);
  await proxy.drain();
  await context.unrouteAll({ behavior: "wait" });
}
