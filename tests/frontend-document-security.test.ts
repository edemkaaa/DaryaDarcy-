/** Документный proxy/CSP проверяется локально через NextRequest без браузера и сервера. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../apps/frontend/src/proxy";
import { documentSecurityHeaders } from "../apps/frontend/src/shared/security/document-headers";

/** Имитируем production и same-origin API для независимых policy assertions. */
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
});
/** Возвращаем env. */
afterEach(() => vi.unstubAllEnvs());

/** Входные nonce/CSP не доверены: каждый документ получает новый 128-bit nonce, совпадающий у request/response policy. */
it("overwrites an attacker-supplied nonce and gives each document a fresh policy", () => {
  /** Синтетический запрос содержит намеренно поддельные security headers. */
  const request = () =>
    new NextRequest("https://app.example.test/login", {
      headers: {
        "x-nonce": "attacker-selected",
        "Content-Security-Policy": "script-src 'unsafe-inline'",
      },
    });
  const first = proxy(request());
  const second = proxy(request());
  const nonce = first.headers.get("x-middleware-request-x-nonce")!;
  expect(Buffer.from(nonce, "base64")).toHaveLength(16);
  expect(nonce).not.toBe("attacker-selected");
  expect(second.headers.get("x-middleware-request-x-nonce")).not.toBe(nonce);
  const csp = first.headers.get("Content-Security-Policy")!;
  expect(csp).toBe(
    first.headers.get("x-middleware-request-content-security-policy"),
  );
  expect(csp).toContain(`'nonce-${nonce}'`);
  expect(csp.match(/(?:^|; )script-src ([^;]+)/)?.[1]).not.toContain(
    "'unsafe-inline'",
  );
  expect(csp).not.toContain("'unsafe-eval'");
  expect(csp).toContain("script-src-attr 'none'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(first.headers.get("X-Frame-Options")).toBe("DENY");
  expect(first.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(first.headers.get("Referrer-Policy")).toBe(
    "strict-origin-when-cross-origin",
  );
  expect(first.headers.get("Cache-Control")).toContain("no-store");
});

/** API/media не получают документную CSP и nonce от frontend proxy. */
it.each(["/api/auth/password", "/api/trpc/auth.me", "/media/video.mp4"])(
  "leaves the upstream security policy in charge of %s",
  (path) => {
    const response = proxy(new NextRequest(`https://app.example.test${path}`));
    expect(response.headers.get("Content-Security-Policy")).toBeNull();
    expect(response.headers.get("x-middleware-request-x-nonce")).toBeNull();
  },
);

/** Из API URL берётся только origin; iframe/media allowlist сохраняется отдельно от connect-src. */
it("allows only the configured API origin while supporting existing media players", () => {
  const csp = documentSecurityHeaders(
    "synthetic-nonce",
    false,
    "https://api.example.test/v1",
  )["Content-Security-Policy"];
  expect(csp).toContain("connect-src 'self' https://api.example.test;");
  expect(csp).toContain(
    "https://vk.com https://vk.ru https://vkvideo.ru https://www.youtube.com",
  );
  expect(csp).toContain("media-src 'self' https: blob:");
  expect(csp).not.toContain("ws:");
  expect(csp).not.toContain("/v1");
});

/** WebSocket и unsafe-eval разрешены лишь dev-политикой. */
it("enables development tooling only in development", () => {
  const csp = documentSecurityHeaders("synthetic-nonce", true)[
    "Content-Security-Policy"
  ];
  expect(csp).toContain("'unsafe-eval'");
  expect(csp).toContain("connect-src 'self' ws: wss:");
});

/** Password document не использует общий API origin/iframe/forms и выдаёт no-referrer/no-store. */
it.each(["/password", "/password/"])(
  "isolates the password document policy at %s",
  (path) => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://unrelated.example.test");
    const response = proxy(new NextRequest(`https://app.example.test${path}`));
    const csp = response.headers.get("Content-Security-Policy")!;
    expect(csp).toContain("connect-src 'self';");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("form-action 'none'");
    expect(csp).toContain("default-src 'none'");
    expect(csp).not.toContain("unrelated.example.test");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  },
);

/** Исполняемый scheme или credentials в операторской настройке останавливают построение CSP. */
it.each(["javascript:alert(1)", "https://user:password@api.example.test"])(
  "rejects unsafe configured API origins: %s",
  (value) =>
    expect(() => documentSecurityHeaders("synthetic", false, value)).toThrow(),
);
