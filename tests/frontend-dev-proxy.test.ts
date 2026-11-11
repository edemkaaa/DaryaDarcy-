/** Проверяем локальную Next proxy-политику на объектах Request/Response без обращения к указанному upstream. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../apps/frontend/src/proxy";

const upstream = "https://daryadarcy.dev.reeskeen.ru";
/** Задаём development и синтетический удалённый upstream только для преобразования заголовков. */
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("API_PROXY_TARGET", upstream);
});
/** Возвращаем окружение после сценария. */
afterEach(() => vi.unstubAllEnvs());

/** Строит NextRequest с отдельными Host, Origin и допзаголовками для проверки доверенных границ. */
function request(
  origin?: string,
  host = "127.0.0.1:8081",
  extra: Record<string, string> = {},
) {
  const headers = new Headers({ host, ...extra });
  if (origin !== undefined) headers.set("origin", origin);
  return new NextRequest(`http://${host}/api/auth/login`, {
    method: "POST",
    headers,
  });
}

/** Точный локальный origin заменяется только внутренним request-header для upstream. */
it.each(["127.0.0.1:8081", "localhost:8081", "[::1]:8081"])(
  "forwards the local Origin for %s",
  (host) => {
    const response = proxy(request(`http://${host}`, host));
    expect(response.headers.get("x-middleware-request-origin")).toBe(upstream);
    expect(response.headers.get("origin")).toBeNull();
  },
);
/** Cookie и Content-Type остаются на стороне запроса; ответ не выдаёт Set-Cookie из фикстуры. */
it("retains cookies and request headers without exposing them as response headers", () => {
  const response = proxy(
    request("http://127.0.0.1:8081", undefined, {
      cookie: "app_session_id=synthetic",
      "content-type": "application/json",
    }),
  );
  expect(response.headers.get("x-middleware-request-cookie")).toBe(
    "app_session_id=synthetic",
  );
  expect(response.headers.get("x-middleware-request-content-type")).toBe(
    "application/json",
  );
  expect(response.headers.get("set-cookie")).toBeNull();
});
/** Чужой origin, иной порт, неверная форма и path вместо origin дают 403/no-store. */
it.each([
  "https://outside.example.test",
  "http://localhost:8081",
  "http://127.0.0.1:9000",
  "null",
  "malformed",
  "http://127.0.0.1:8081/not-an-origin",
])("rejects a foreign or invalid Origin: %s", (origin) => {
  const response = proxy(request(origin));
  expect(response.status).toBe(403);
  expect(response.headers.get("cache-control")).toBe("no-store");
});
/** Sec-Fetch-Site закрывает cross-site запрос без заголовка Origin. */
it("rejects cross-site browser requests even without an Origin", () => {
  expect(
    proxy(request(undefined, undefined, { "sec-fetch-site": "cross-site" }))
      .status,
  ).toBe(403);
});
/** Development-режим не должен сделать публичный Host доверенным локальным. */
it("does not enable the remote development proxy on a public Host", () => {
  expect(
    proxy(request("http://outside.example.test", "outside.example.test"))
      .status,
  ).toBe(403);
});
/** При отсутствии origin не добавляем его искусственно. */
it("allows same-origin reads without adding an Origin", () => {
  expect(
    proxy(request()).headers.get("x-middleware-request-origin"),
  ).toBeNull();
});
/** Специальная local origin-подмена не должна включаться в production/test. */
it.each(["production", "test"])(
  "keeps the deployed behavior in %s",
  (environment) => {
    vi.stubEnv("NODE_ENV", environment);
    const response = proxy(request("https://outside.example.test"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-request-origin")).toBeNull();
  },
);
/** Пустой либо локальный target сохраняет прежнюю обработку запроса. */
it.each(["", "http://127.0.0.1:3000"])(
  "keeps existing behavior for an unset/local target: %s",
  (target) => {
    vi.stubEnv("API_PROXY_TARGET", target);
    const response = proxy(request("http://127.0.0.1:8081"));
    expect(response.headers.get("x-middleware-request-origin")).toBeNull();
  },
);
