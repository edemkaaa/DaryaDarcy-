import type { BrowserContext, Page, Route } from "@playwright/test";

// Keep interception registered until all forwarded responses have completed.
// unrouteAll(wait) alone can remove the server interceptor when the first of
// several active callbacks completes, continuing the remaining browser request.
export function trackRouteHandler(handle: (route: Route) => Promise<void>) {
  // Учитывает все выполняющиеся route callbacks: снятие interception не должно выпустить запросы на настоящий сервер.

  const pending = new Set<Promise<void>>();
  return {
    async handler(route: Route) {
      // Регистрирует конкретный forwarded Promise до ожидания и убирает его даже при отказе.

      const task = handle(route);
      pending.add(task);
      try {
        await task;
      } finally {
        pending.delete(task);
      }
    },
    async drain() {
      // Ждёт опустошения множества, включая работу, добавившуюся во время предыдущего await.

      while (pending.size) await Promise.all([...pending]);
    },
  };
}

/** Page fallback handlers share route state with the context interceptor. */
export async function removePageRoutes(
  page: Page,
  proxy: { drain(): Promise<void> },
) {
  // Сначала дожидается прокси-ответов, затем снимает fallback конкретной страницы.

  await proxy.drain();
  await page.unrouteAll({ behavior: "wait" });
}

export async function drainBrowserRoutes(
  context: BrowserContext,
  proxy: { drain(): Promise<void> },
) {
  // Снимает оба уровня перехвата только после двух барьеров ожидания, предотвращая случайный выход запросов наружу.

  // Removing a page handler can continue an outstanding context request too.
  // Drain before either layer is removed, then drain newly forwarded work again.
  await proxy.drain();
  for (const page of context.pages()) await removePageRoutes(page, proxy);
  await proxy.drain();
  await context.unrouteAll({ behavior: "wait" });
}
