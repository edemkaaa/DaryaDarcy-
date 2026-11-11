/** Проверяем безопасную начальную HTML-разметку результата TEST checkout без браузерных побочных эффектов. */
import { expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ClubTestCheckoutResult } from "../apps/frontend/src/features/club/checkout-result";
import { createTRPCClient } from "../apps/frontend/src/shared/api/trpc";

/** Два SSR-прохода должны совпасть, не запускать timer/fetch и не объявлять доступ открытым. */
it("server rendering is deterministic without document, storage, timers or HTTP", () => {
  const fetcher = vi.fn();
  const timer = vi.spyOn(globalThis, "setTimeout");
  vi.stubGlobal("fetch", fetcher);
  try {
    const props = { client: createTRPCClient() };
    const markup = renderToStaticMarkup(
      createElement(ClubTestCheckoutResult, props),
    );
    expect(markup).toContain('role="status"');
    expect(markup).toContain("Тестовая оплата");
    expect(markup).toContain("Проверить статус");
    expect(markup).not.toMatch(/подтверждена|доступ открыт/);
    expect(
      renderToStaticMarkup(createElement(ClubTestCheckoutResult, props)),
    ).toBe(markup);
    expect(fetcher).not.toHaveBeenCalled();
    expect(timer).not.toHaveBeenCalled();
  } finally {
    timer.mockRestore();
    vi.unstubAllGlobals();
  }
});

/** Даже готовая session-prop не заменяет браузерную проверку: fieldset остаётся disabled до hydration. */
it("TEST purchase form starts disabled until a browser check, with no storage, timer or HTTP on SSR", () => {
  const fetcher = vi.fn();
  const timer = vi.spyOn(globalThis, "setTimeout");
  vi.stubGlobal("fetch", fetcher);
  try {
    const props = {
      client: createTRPCClient(),
      purchase: { sessionReady: true, accountEmail: null },
    };
    const markup = renderToStaticMarkup(
      createElement(ClubTestCheckoutResult, props),
    );
    expect(markup).toContain('aria-label="Тестовая покупка клуба"');
    expect(markup).toContain('<fieldset disabled="">');
    expect(markup).toContain('value=""');
    expect(markup).toContain("Создать тестовую заявку");
    expect(
      renderToStaticMarkup(createElement(ClubTestCheckoutResult, props)),
    ).toBe(markup);
    expect(fetcher).not.toHaveBeenCalled();
    expect(timer).not.toHaveBeenCalled();
  } finally {
    timer.mockRestore();
    vi.unstubAllGlobals();
  }
});
