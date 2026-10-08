import { expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ClubTestCheckoutResult } from "../apps/frontend/src/features/club/checkout-result";
import { createTRPCClient } from "../apps/frontend/src/shared/api/trpc";

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
