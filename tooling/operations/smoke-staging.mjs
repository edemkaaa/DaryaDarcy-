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
// Closed remains the baseline. Never infer TEST readiness from an open route.
const payments = process.env.STAGING_SMOKE_PAYMENTS || "closed";
assert.ok(
  ["closed", "prodamus-test"].includes(payments),
  "Smoke payment mode must be closed or prodamus-test",
);

async function read(path, status = 200, options = {}) {
  const response = await fetch(new URL(path, base), {
    ...options,
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  assert.equal(response.status, status, `${path}: unexpected HTTP status`);
  console.log(`PASS ${status} ${path}`);
  return response;
}

function emptyPost(path, status) {
  // Invalid input only: never provide an email, sign, cookies or valid order.
  return read(path, status, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base.origin },
    body: "{}",
  });
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
  for (const name of ["smsLogin", "penPals", "shopOnlinePayment", "webPush"]) {
    assert.equal(
      configuration.capabilities?.[name],
      false,
      `${name} must remain disabled`,
    );
  }
  // Uploads are released independently; additive flags do not change this baseline.
  for (const name of [
    "privateContentUploads",
    "privatePostMediaUploads",
    "privatePostVideoUploads",
  ]) {
    assert.equal(
      typeof configuration.capabilities?.[name],
      "boolean",
      `${name} must be a boolean`,
    );
  }
  const feedQuery = new URLSearchParams({
    input: JSON.stringify({ json: { limit: 1 } }),
  });
  const feed = await (
    await read(`/api/trpc/feed.listPaginated?${feedQuery}`)
  ).json();
  assert.ok(
    Array.isArray(feed.result?.data?.json?.posts) &&
      feed.result.data.json.posts.length <= 1,
    "Feed must return a bounded SQL page",
  );
  await read("/api/admin/launch-settings", 401);
  await read("/api/trpc/admin.stats", 401);
  await read("/api/prodamus/return", 503);
  await emptyPost("/api/prodamus/webhook", 503);
  // Guest auth runs before the disabled shop capability. No product is sent.
  await emptyPost("/api/trpc/shop.createCheckout", 401);
  if (payments === "closed") {
    await read("/api/trpc/club.createCheckout", 503);
    await read("/api/prodamus/test/webhook", 503);
  } else {
    await read("/api/trpc/club.createCheckout", 405);
    await read("/api/prodamus/test/webhook", 405);
    const unsigned = await emptyPost("/api/prodamus/test/webhook", 400);
    assert.equal(await unsigned.text(), "invalid test notification");
    assert.equal(unsigned.headers.get("set-cookie"), null);
    assert.match(unsigned.headers.get("cache-control") || "", /no-store/);
    const invalid = await emptyPost("/api/trpc/club.createCheckout", 400);
    assert.equal(invalid.headers.get("set-cookie"), null);
    assert.match(invalid.headers.get("cache-control") || "", /no-store/);
  }
  console.log(
    `Staging ${payments} guest/SQL/access smoke passed; no purchases or provider calls.`,
  );
} catch {
  console.error(
    "Staging smoke failed; do not publish/promote this deployment.",
  );
  process.exitCode = 1;
}
