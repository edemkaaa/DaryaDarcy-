import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClubCheckoutMode } from "../apps/frontend/src/features/club/checkout-mode";
import { createTRPCClient, trpc } from "../apps/frontend/src/shared/api/trpc";

afterEach(() => vi.unstubAllEnvs());
function render() {
  const queryClient = new QueryClient();
  try {
    return renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(trpc.Provider, {
          client: createTRPCClient(),
          queryClient,
          children: createElement(
            ClubCheckoutMode,
            null,
            createElement("button", null, "Legacy purchase"),
          ),
        }),
      ),
    );
  } finally {
    queryClient.clear();
  }
}

it.each([undefined, "", "false"])(
  "public flag %s preserves the legacy screen",
  (flag) => {
    vi.stubEnv("NEXT_PUBLIC_CLUB_TEST_CHECKOUT", flag);
    expect(render()).toBe("<button>Legacy purchase</button>");
  },
);
it.each(["TRUE", "true ", "1", "yookassa", "null"])(
  "invalid public flag %s refuses both payment modes",
  (flag) => {
    vi.stubEnv("NEXT_PUBLIC_CLUB_TEST_CHECKOUT", flag);
    const markup = render();
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Оплата временно недоступна");
    expect(markup).not.toContain("Legacy purchase");
    expect(markup).not.toContain("Проверить статус");
  },
);
it("explicit TEST build flag selects only the read-only result screen without browser access or requests", () => {
  vi.stubEnv("NEXT_PUBLIC_CLUB_TEST_CHECKOUT", "true");
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  try {
    const markup = render();
    expect(markup).toContain("Тестовая оплата");
    expect(markup).toContain("Проверить статус");
    expect(markup).not.toContain("Legacy purchase");
    expect(fetcher).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});
