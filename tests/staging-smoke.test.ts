import { execFile } from "node:child_process";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vitest";

const execute = promisify(execFile);
type Probe = {
  method: string;
  path: string;
  body: string;
  cookie?: string;
  sign?: string;
};
type BrokenReply = {
  method: string;
  path: string;
  status: number;
  body?: string;
  headers?: Record<string, string>;
};

/** Запускает настоящий smoke CLI против собственного HTTP-double и записывает все probes; никакого обращения к рабочему стенду нет. */
async function runSmoke(
  deployment: "closed" | "prodamus-test",
  mode?: string,
  broken?: BrokenReply,
  capabilities: Record<string, unknown> = {},
) {
  const requests: Probe[] = [];
  const server = createServer(async (req, res) => {
    const pathname = new URL(req.url!, "http://fixture.local").pathname;
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    requests.push({
      method: req.method!,
      path: req.url!,
      body: Buffer.concat(chunks).toString(),
      cookie: req.headers.cookie,
      sign: req.headers.sign as string | undefined,
    });
    res.setHeader("Content-Type", "application/json");
    if (
      broken &&
      req.method === broken.method &&
      (req.url === broken.path || pathname === broken.path)
    ) {
      res.writeHead(broken.status, broken.headers);
      res.end(broken.body ?? "unexpectedly accepted");
      return;
    }
    switch (pathname) {
      case "/":
        res.setHeader("Content-Type", "text/html");
        res.end("<html><body>synthetic staging</body></html>");
        return;
      case "/api/auth/me":
        res.setHeader("Cache-Control", "no-store");
        res.end('{"user":null}');
        return;
      case "/api/launch-config":
        res.end(
          JSON.stringify({
            orderMethod: "email-client",
            capabilities: {
              smsLogin: false,
              penPals: false,
              shopOnlinePayment: false,
              webPush: false,
              privateContentUploads: false,
              privatePostMediaUploads: false,
              privatePostVideoUploads: false,
              ...capabilities,
            },
          }),
        );
        return;
      case "/api/trpc/feed.listPaginated":
        res.end('{"result":{"data":{"json":{"posts":[],"nextCursor":null}}}}');
        return;
      case "/api/admin/launch-settings":
      case "/api/trpc/admin.stats":
      case "/api/trpc/shop.createCheckout":
        res.statusCode = 401;
        break;
      case "/api/trpc/club.createCheckout":
      case "/api/prodamus/test/webhook":
        res.statusCode =
          deployment === "closed" ? 503 : req.method === "GET" ? 405 : 400;
        res.setHeader("Cache-Control", "no-store");
        res.end(
          req.url === "/api/prodamus/test/webhook"
            ? "invalid test notification"
            : "invalid checkout",
        );
        return;
      default:
        res.statusCode = 503;
    }
    res.end("blocked");
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  try {
    let code = 0,
      stdout = "",
      stderr = "";
    try {
      ({ stdout, stderr } = await execute(
        process.execPath,
        [resolve("tooling/operations/smoke-staging.mjs")],
        {
          env: {
            PATH: process.env.PATH,
            STAGING_SMOKE_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
            ...(mode === undefined ? {} : { STAGING_SMOKE_PAYMENTS: mode }),
          },
          timeout: 5000,
        },
      ));
    } catch (error) {
      const failure = error as { code: number; stdout: string; stderr: string };
      code = failure.code;
      stdout = failure.stdout;
      stderr = failure.stderr;
    }
    return { code, stdout, stderr, requests };
  } finally {
    server.closeAllConnections();
    await new Promise<void>((done, reject) =>
      server.close((error) => (error ? reject(error) : done())),
    );
  }
}

/** Сохраняет закрытые платежи базовым режимом smoke без дополнительных настроек. */
it("retains the closed-payment deployment as the default baseline", async () => {
  const result = await runSmoke("closed");
  expect(result.code).toBe(0);
  expect(result.stderr).toBe("");
});

/** Проверяет ограниченное чтение одной карточки вместо снятого неограниченного списка ленты. */
it("uses a single-card paginated read instead of the retired unbounded feed", async () => {
  const result = await runSmoke("closed");
  expect(result.code).toBe(0);
  expect(result.requests.some((r) => r.path === "/api/trpc/feed.list")).toBe(
    false,
  );
  const pages = result.requests.filter((r) =>
    r.path.startsWith("/api/trpc/feed.listPaginated?"),
  );
  expect(pages).toHaveLength(1);
  expect(
    JSON.parse(
      new URL(pages[0].path, "http://fixture.local").searchParams.get("input")!,
    ),
  ).toEqual({ json: { limit: 1 } });
});

/** Допускает приватные загрузки и новые capabilities, сохраняя проверки остальных запретов доступа. */
it("accepts private uploads and additive capabilities without skipping the remaining access checks", async () => {
  const result = await runSmoke("prodamus-test", "prodamus-test", undefined, {
    privateContentUploads: true,
    privatePostMediaUploads: true,
    privatePostVideoUploads: true,
    futureCapability: true,
  });
  expect(result.code).toBe(0);
  expect(result.stdout).toContain("smoke passed");
  expect(result.requests.some((r) => r.path === "/api/trpc/admin.stats")).toBe(
    true,
  );
  expect(
    result.requests.some((r) => r.path === "/api/prodamus/test/webhook"),
  ).toBe(true);
});

/** По-прежнему отклоняет исключённые функции даже при включённых приватных загрузках. */
it.each(["smsLogin", "penPals", "shopOnlinePayment", "webPush"])(
  "still rejects the excluded %s capability when private uploads are enabled",
  async (capability) => {
    const result = await runSmoke("prodamus-test", "prodamus-test", undefined, {
      privateContentUploads: true,
      privatePostMediaUploads: true,
      privatePostVideoUploads: true,
      [capability]: true,
    });
    expect(result.code).toBe(1);
    expect(result.stdout).not.toContain("smoke passed");
  },
);

/** Не считает отсутствующие и неверно типизированные private capabilities готовностью выпуска. */
it.each([
  ["privateContentUploads", undefined],
  ["privatePostMediaUploads", undefined],
  ["privatePostVideoUploads", undefined],
  ["privateContentUploads", "true"],
  ["privatePostMediaUploads", null],
  ["privatePostVideoUploads", 1],
])(
  "rejects a missing or malformed %s capability (%s)",
  async (capability, value) => {
    const result = await runSmoke("prodamus-test", "prodamus-test", undefined, {
      [String(capability)]: value,
    });
    expect(result.code).toBe(1);
    expect(result.stdout).not.toContain("smoke passed");
  },
);

/** В явном TEST проверяет только неподписанные пустые отказы без создания заказа и платёжного callback. */
it("accepts the explicit TEST deployment without preparing a purchase or signed callback", async () => {
  const result = await runSmoke("prodamus-test", "prodamus-test");
  expect(result.code).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.requests.filter((r) => r.method === "POST")).toEqual([
    {
      method: "POST",
      path: "/api/prodamus/webhook",
      body: "{}",
      cookie: undefined,
      sign: undefined,
    },
    {
      method: "POST",
      path: "/api/trpc/shop.createCheckout",
      body: "{}",
      cookie: undefined,
      sign: undefined,
    },
    {
      method: "POST",
      path: "/api/prodamus/test/webhook",
      body: "{}",
      cookie: undefined,
      sign: undefined,
    },
    {
      method: "POST",
      path: "/api/trpc/club.createCheckout",
      body: "{}",
      cookie: undefined,
      sign: undefined,
    },
  ]);
});

/** Отклоняет фактический режим платежей, не совпадающий с ожидаемым smoke baseline. */
it.each([
  { deployment: "closed" as const, mode: "prodamus-test" },
  { deployment: "prodamus-test" as const, mode: undefined },
])(
  "refuses an unexpected payment deployment ($deployment / $mode)",
  async ({ deployment, mode }) => {
    expect((await runSmoke(deployment, mode)).code).toBe(1);
  },
);

/** Неизвестный платёжный режим отклоняется ещё до первого HTTP-запроса. */
it("rejects unknown payment modes before making any request", async () => {
  const result = await runSmoke("closed", "live");
  expect(result.code).toBe(1);
  expect(result.requests).toEqual([]);
});

/** Повреждённые формы, разрешённые запрещённые маршруты, cookie и кешируемые отказы не должны завершаться smoke passed. */
it.each<BrokenReply & { name: string }>([
  {
    name: "paginated feed returns the old array shape",
    method: "GET",
    path: "/api/trpc/feed.listPaginated",
    status: 200,
    body: '{"result":{"data":{"json":[]}}}',
  },
  {
    name: "paginated feed ignores the requested bound",
    method: "GET",
    path: "/api/trpc/feed.listPaginated",
    status: 200,
    body: '{"result":{"data":{"json":{"posts":[{"id":1},{"id":2}],"nextCursor":null}}}}',
  },
  {
    name: "live callback enabled",
    method: "POST",
    path: "/api/prodamus/webhook",
    status: 200,
  },
  {
    name: "shop checkout enabled",
    method: "POST",
    path: "/api/trpc/shop.createCheckout",
    status: 200,
  },
  {
    name: "unsigned callback accepted",
    method: "POST",
    path: "/api/prodamus/test/webhook",
    status: 200,
  },
  {
    name: "empty checkout accepted",
    method: "POST",
    path: "/api/trpc/club.createCheckout",
    status: 200,
  },
  {
    name: "browser return enabled",
    method: "GET",
    path: "/api/prodamus/return",
    status: 200,
  },
  {
    name: "guest admin access",
    method: "GET",
    path: "/api/trpc/admin.stats",
    status: 200,
  },
  {
    name: "signature failure has success body",
    method: "POST",
    path: "/api/prodamus/test/webhook",
    status: 400,
    body: "success",
    headers: { "Cache-Control": "no-store" },
  },
  {
    name: "unsigned callback issues a session",
    method: "POST",
    path: "/api/prodamus/test/webhook",
    status: 400,
    body: "invalid test notification",
    headers: {
      "Cache-Control": "no-store",
      "Set-Cookie": "synthetic-session=1",
    },
  },
  {
    name: "checkout validation is cacheable",
    method: "POST",
    path: "/api/trpc/club.createCheckout",
    status: 400,
  },
])("fails instead of reporting readiness when $name", async (broken) => {
  const result = await runSmoke("prodamus-test", "prodamus-test", broken);
  expect(result.code).toBe(1);
  expect(result.stdout).not.toContain("smoke passed");
});

/** Не следует redirect и не обращается к его адресу при проверке webhook. */
it("rejects a redirect without requesting the redirect destination", async () => {
  const result = await runSmoke("prodamus-test", "prodamus-test", {
    method: "GET",
    path: "/api/prodamus/test/webhook",
    status: 302,
    headers: { Location: "/unexpected-target" },
  });
  expect(result.code).toBe(1);
  expect(result.requests.some((r) => r.path === "/unexpected-target")).toBe(
    false,
  );
});
