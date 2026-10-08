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

async function runSmoke(
  deployment: "closed" | "prodamus-test",
  mode?: string,
  broken?: BrokenReply,
) {
  const requests: Probe[] = [];
  const server = createServer(async (req, res) => {
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
    if (broken && req.method === broken.method && req.url === broken.path) {
      res.writeHead(broken.status, broken.headers);
      res.end(broken.body ?? "unexpectedly accepted");
      return;
    }
    switch (req.url) {
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
            },
          }),
        );
        return;
      case "/api/trpc/feed.list":
        res.end('{"result":{"data":{"json":[]}}}');
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

it("retains the closed-payment deployment as the default baseline", async () => {
  const result = await runSmoke("closed");
  expect(result.code).toBe(0);
  expect(result.stderr).toBe("");
});

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

it.each([
  { deployment: "closed" as const, mode: "prodamus-test" },
  { deployment: "prodamus-test" as const, mode: undefined },
])(
  "refuses an unexpected payment deployment ($deployment / $mode)",
  async ({ deployment, mode }) => {
    expect((await runSmoke(deployment, mode)).code).toBe(1);
  },
);

it("rejects unknown payment modes before making any request", async () => {
  const result = await runSmoke("closed", "live");
  expect(result.code).toBe(1);
  expect(result.requests).toEqual([]);
});

it.each<BrokenReply & { name: string }>([
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
