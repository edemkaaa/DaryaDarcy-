import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { request, type RequestOptions } from "node:http";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { publicAccessUrl } from "../apps/backend/src/identity/urls";
let application: INestApplication, base: string;
// Node fetch overwrites Sec-Fetch-Mode with "cors". Send the browser's actual
// navigation metadata over HTTP instead of accidentally testing a fetch.
/** Передаёт настоящие navigation metadata через node:http, поскольку fetch сам заменяет Sec-Fetch-Mode и исказил бы проверку браузерного перехода. */
function requestWithBrowserMetadata(
  path: string,
  options: RequestOptions,
  body?: string,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const req = request(`${base}${path}`, options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("error", reject);
      res.on("end", () => {
        const headers = new Headers();
        for (let index = 0; index < res.rawHeaders.length; index += 2) {
          headers.append(res.rawHeaders[index], res.rawHeaders[index + 1]);
        }
        resolve(
          new Response(Buffer.concat(chunks).toString("utf8"), {
            status: res.statusCode,
            headers,
          }),
        );
      });
    });
    req.on("error", reject);
    req.end(body);
  });
}
/** Поднимает локальный API на случайном порту без рабочей базы и внешних отправителей. */
beforeAll(async () => {
  application = await createBackendApplication();
  await application.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${(application.getHttpServer().address() as AddressInfo).port}`;
});
/** Закрывает локальное приложение после проверки переходов. */
afterAll(async () => {
  await application.close();
});
/** Возвращает изменённые адреса и режим окружения между сценариями. */
afterEach(() => vi.unstubAllEnvs());
/** Проверяет безопасный переход старой почтовой ссылки только на frontend password-страницу без сессии и активного содержимого. */
it.each(["/api/auth/password", "/api/auth/password/"])(
  "redirects old email links from %s without issuing a session",
  async (path) => {
    vi.stubEnv("PUBLIC_APP_URL", "https://club.example.test");
    const response = await requestWithBrowserMetadata(path, {
      headers: {
        "Sec-Fetch-Site": "cross-site",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Dest": "document",
        Cookie: "app_session=invalid-test-session",
      },
    });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://club.example.test/password",
    );
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    const page = await response.text();
    expect(page).not.toContain("<script");
    expect(response.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(response.headers.get("content-security-policy")).toContain(
      "default-src 'none'",
    );
  },
);
/** Проверяет, что исключение для email-navigation не открывает cross-site iframe, fetch, формы и другие API-маршруты. */
it.each([
  {
    name: "iframe",
    path: "/api/auth/password",
    method: "GET",
    mode: "navigate",
    dest: "iframe",
  },
  {
    name: "fetch",
    path: "/api/auth/password",
    method: "GET",
    mode: "cors",
    dest: "empty",
  },
  {
    name: "missing mode",
    path: "/api/auth/password",
    method: "GET",
    mode: "",
    dest: "document",
  },
  {
    name: "missing destination",
    path: "/api/auth/password",
    method: "GET",
    mode: "navigate",
    dest: "",
  },
  {
    name: "page form submission",
    path: "/api/auth/password",
    method: "POST",
    mode: "navigate",
    dest: "document",
  },
  {
    name: "password completion",
    path: "/api/auth/password/complete",
    method: "POST",
    mode: "navigate",
    dest: "document",
  },
  {
    name: "password request",
    path: "/api/auth/password/request",
    method: "POST",
    mode: "navigate",
    dest: "document",
  },
  {
    name: "nested password path",
    path: "/api/auth/password/complete",
    method: "GET",
    mode: "navigate",
    dest: "document",
  },
  {
    name: "another API document",
    path: "/api/auth/me",
    method: "GET",
    mode: "navigate",
    dest: "document",
  },
])("still rejects cross-site $name", async ({ path, method, mode, dest }) => {
  const response = await requestWithBrowserMetadata(
    path,
    {
      method,
      headers: {
        "Sec-Fetch-Site": "cross-site",
        "Sec-Fetch-Mode": mode,
        "Sec-Fetch-Dest": dest,
        Cookie: "app_session=invalid-test-session",
        ...(method === "POST"
          ? { "Content-Type": "application/x-www-form-urlencoded" }
          : {}),
      },
    },
    method === "POST" ? "token=synthetic-test-token" : undefined,
  );
  expect(response.status).toBe(403);
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(response.headers.get("access-control-allow-origin")).toBeNull();
});
/** Проверяет запрет CORS для чужого origin даже на password-document. */
it("does not grant foreign origins CORS access to the password document", async () => {
  const response = await requestWithBrowserMetadata("/api/auth/password", {
    headers: {
      Origin: "https://foreign.example.test",
      "Sec-Fetch-Site": "cross-site",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Dest": "document",
    },
  });
  expect(response.status).toBe(403);
  expect(response.headers.get("access-control-allow-origin")).toBeNull();
});
/** Проверяет использование только настроенного frontend origin без доверия query-next, query-token и старому auth-origin. */
it("redirects to the configured frontend without trusting query or legacy auth origins", async () => {
  vi.stubEnv("PUBLIC_APP_URL", "https://club.example.test");
  vi.stubEnv("PUBLIC_AUTH_URL", "https://api.example.test");
  const response = await fetch(
    `${base}/api/auth/password?next=https://foreign.example.test&token=ignored-query-token`,
    { redirect: "manual" },
  );
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe(
    "https://club.example.test/password",
  );
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
});
/** Проверяет безопасный 503 для недопустимой production-конфигурации без отражения credentials. */
it.each([
  "javascript:alert(1)",
  "ftp://localhost",
  "http://club.example.test",
  "https://user:PRIVATE_PASSWORD@club.example.test",
])("fails safely for an unsafe configured frontend %s", async (url) => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("PUBLIC_APP_URL", url);
  const response = await fetch(`${base}/api/auth/password`);
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("PRIVATE_PASSWORD");
});
/** Проверяет канонические frontend setup/login URL без переноса configured path/query и с токеном только во fragment. */
it("uses the frontend for setup and login without retaining configured paths or queries", () => {
  vi.stubEnv("PUBLIC_APP_URL", "https://club.example.test/unused?tracking=1");
  vi.stubEnv("PUBLIC_AUTH_URL", "https://api.example.test/unused?tracking=1");
  const token = "A".repeat(43);
  expect(publicAccessUrl(token).toString()).toBe(
    `https://club.example.test/password#token=${token}`,
  );
  expect(publicAccessUrl().toString()).toBe("https://club.example.test/login");
});
/** Проверяет HTTP только для local development и отказ иной локальной схемы. */
it("supports local HTTP in development, but never another local scheme", () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("PUBLIC_APP_URL", "http://localhost:8081");
  vi.stubEnv("PUBLIC_AUTH_URL", "http://127.0.0.1:3000");
  expect(publicAccessUrl("local-test-token").protocol).toBe("http:");
  vi.stubEnv("PUBLIC_APP_URL", "ftp://localhost");
  expect(() => publicAccessUrl("local-test-token")).toThrow(
    "Invalid public access URL",
  );
});
/** Проверяет запрет credentials в mail-link origin без раскрытия их значения. */
it("rejects credentials in the mail-link origin without exposing their value", () => {
  vi.stubEnv("PUBLIC_APP_URL", "https://club.example.test");
  vi.stubEnv(
    "PUBLIC_APP_URL",
    "https://member:PRIVATE_PASSWORD@api.example.test",
  );
  expect(() => publicAccessUrl("local-test-token")).toThrow(
    "Invalid public access URL",
  );
});
