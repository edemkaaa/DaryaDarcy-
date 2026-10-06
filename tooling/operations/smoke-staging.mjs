import assert from "node:assert/strict";

const base = new URL(
  process.env.STAGING_SMOKE_URL || "https://daryadarcy.dev.reeskeen.ru",
);
assert.ok(
  ["127.0.0.1", "localhost", "daryadarcy.dev.reeskeen.ru"].includes(
    base.hostname,
  ),
  "Smoke target must be the isolated staging host or a local tunnel",
);
assert.ok(!base.username && !base.password, "Do not put credentials in URLs");
assert.ok(
  base.protocol === "https:" ||
    (base.protocol === "http:" &&
      base.hostname !== "daryadarcy.dev.reeskeen.ru"),
  "Remote smoke requires HTTPS",
);

async function read(path, status = 200) {
  const response = await fetch(new URL(path, base), {
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  assert.equal(response.status, status, `${path}: unexpected HTTP status`);
  console.log(`PASS ${status} ${path}`);
  return response;
}

try {
  const page = await read("/");
  assert.match(page.headers.get("content-type") || "", /text\/html/);
  assert.match(await page.text(), /<html[\s>]/i);
  const me = await read("/api/auth/me");
  assert.equal((await me.json()).user, null);
  assert.match(me.headers.get("cache-control") || "", /no-store/);
  const configuration = await (await read("/api/launch-config")).json();
  assert.equal(configuration.orderMethod, "email-client");
  assert.deepEqual(configuration.capabilities, {
    smsLogin: false,
    penPals: false,
    shopOnlinePayment: false,
    webPush: false,
  });
  const feed = await (await read("/api/trpc/feed.list")).json();
  assert.ok(
    Array.isArray(feed.result?.data?.json),
    "Feed must return a SQL catalog",
  );
  await read("/api/admin/launch-settings", 401);
  await read("/api/trpc/admin.stats", 401);
  await read("/api/prodamus/return", 503);
  await read("/api/trpc/club.createCheckout", 503);
  console.log(
    "Staging guest/SQL/access smoke passed; no mutations or provider calls.",
  );
} catch {
  console.error(
    "Staging smoke failed; do not publish/promote this deployment.",
  );
  process.exitCode = 1;
}
