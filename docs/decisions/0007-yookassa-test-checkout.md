# ADR-007: Durable one-off YooKassa test checkout

- **Status:** Accepted for backend and the approved staging baseline update;
  payment enablement/acceptance not completed
- **Date:** 2026-10-07

## Context

The user supplied a verified test payment shop and approved a one-off club test,
without storing a card or automatic charges. Prodamus remains disabled on the
isolated stand. Existing receipts prevent duplicate access grants but do not
preserve a YooKassa create intent or its unknown outcome after a network failure.

## Decision

Use a disabled-by-default, test-only adapter with fixed HTTPS API origin, validated
test shop/payment responses, bounded requests and generic errors. Explicitly send
`save_payment_method: false` and `capture: true`. Do not collect or retain card data.

Persist immutable intent before dispatch, atomically claim its key, bind the
provider payment and preserve that evidence through retries/restarts. Reject
payload changes. Never resend an unresolved create outside the provider's
24-hour idempotence window. A known payment is reconciled with authenticated GET.

The caller sends a UUID in `Idempotency-Key`; tRPC input/output schemas and
generated frontend types remain unchanged. The same key must survive retries
and reloads; a missing key fails before dispatch in test mode only.

Webhook bodies and browser returns cannot grant access. Verify the fetched test
payment against its persisted intent, then reuse the existing atomic receipt,
entitlement and access-email outbox transaction with a distinct provider namespace.
Do not create a recurring profile or repurpose Prodamus subscription cancellation.

## Alternatives considered

A fresh random key per HTTP attempt: duplicates create operations after failure.
An in-memory intent cache: loses evidence on restart. Trusting callback metadata
alone: does not establish the persisted provider/order binding. Opening all API
Internet egress: expands access for a process holding DB/SMTP credentials; rejected.
Replacing the provider globally: changes production behavior outside this test.

## Consequences

An additive migration and real disposable-MySQL acceptance are required. Caller
must preserve an intent key through retries and clearly label a one-off test
purchase. Stage enablement needs a separately reviewed payment-only egress path,
backup, migration preflight, cabinet webhook setup and real sandbox acceptance.
Rollback preserves intent/receipt evidence; do not delete tables to roll back code.

### Browser intent boundary

The test caller reserves one unresolved club purchase per browser origin using
versioned `localStorage`, under an exclusive [Web Lock](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API).
The record contains only its UUID and a SHA-256 selection fingerprint; email,
confirmation URLs and payment credentials are not stored. The fingerprint is
derived personal data, not anonymization or authorization. Normalize email and
the default plan before hashing. Bound lock waiting to five seconds.

Unlike optional UI preferences, unreadable/unwritable storage, missing secure
browser capabilities and corrupt/unknown schemas must fail closed before dispatch.
Validate the saved record and read back a new write. Do not replace evidence on
selection changes, elapsed time, retries, browser return parameters or sign-out.
The backend remains authoritative for expiry, identity and payment settlement.

No automatic rotation or reset API is provided. An explicit next purchase needs
server-verified terminal state first; implementing that lifecycle and connecting
the caller to the UI remain separate gates. Storage cleared externally,
another browser profile/device and XSS are outside this origin-local guarantee.
Native browser tests exercise the real production helper and Web Locks across
two tabs and reload; they do not prove provider or payment acceptance.

The typed test orchestrator reserves the intent, fences session changes during
preparation, then sends canonical input through the existing client with
`context.idempotencyKey`. The shared transport puts explicitly keyed mutations
on a single `httpLink` request, validates a UUID before sending its header and
rejects keys on reads. Unkeyed calls retain batching, credentials, cancellation,
body deadlines and error normalization. Keys never enter URLs or request bodies.

A club checkout carrying a key must refuse a missing/disabled YooKassa test
mode instead of falling back to Prodamus. Otherwise a deployment flag loss could
change provider and enable the legacy monthly recurring flow. Regression tests
prove refusal before recipient/order creation with Prodamus configured; the
unkeyed legacy contract remains unchanged. This is not a checkout-enable flag.

### Server return reconciliation foundation

A separate service operation looks up the UUID's hashed intent in the configured
test shop, with its persisted order and recipient. It performs no account/order
creation, lease acquisition, provider POST or capture. Missing/unbound records
return `unknown`: absence is not cancellation and cannot authorize a new browser
intent. The UUID can convey only minimal purchase state, not account access;
do not log it or put it in URLs. A different signed-in actor or blocked recipient
is refused before provider lookup, and the stored email/selection binding is
checked again. Guest checking does not authorize by email or create a session.

Bound payments use authenticated GET and the existing complete proof/atomic
settlement boundary. Only `state` is returned; no email, user/order IDs, amount,
checkout URL or credentials. `waiting_for_capture` stays pending, without capture.
Success is reported after the receipt/access/outbox commit, not merely after the
provider response. Outages, mismatches and settlement failures are retriable errors,
never a terminal result. This foundation is not exposed through tRPC or the UI
yet: a separately reviewed POST mutation, bounded polling and terminal-safe browser
lifecycle remain required before enablement. No schema or dependency changes.

### Payment network boundary

The opt-in [overlay](../../infrastructure/deploy/teamassist/compose.yookassa.yaml)
places API on an additional **internal** `payment-control` network, never the
external network. A separate, bounded, secret-free nginx stream gateway owns
outbound access and the internal `api.yookassa.ru` DNS alias. It forwards only TLS
with that SNI to fixed `api.yookassa.ru:443`; explicit external resolvers avoid
resolving the alias back to itself. Node retains certificate verification; the
gateway neither decrypts traffic nor retries upstream connections. DNS and the
provider certificate remain trust dependencies, not arbitrary caller input.

The [native checks](../../tests/yookassa-egress.native.test.mjs) exercise the pinned
nginx image against the real unauthenticated provider and prove rejected
wrong/missing SNI, plaintext and direct caller Internet access. This validates
the egress boundary, not credentials, checkout, settlement or delivery. Keep the
overlay opt-in until the caller and staging release gates pass.

### Existing staging baseline, 7 October

The test stand was created directly from the canonical 28-table schema and has
no historical Drizzle journal. Do not replay historical ALTER statements or
pretend those files ran. The approved transition uses a narrowly named operator
[upgrader](../../tooling/scripts/staging-baseline-upgrade.ts): pinned full baseline
fingerprint, exact 0026 SQL hash, MySQL/server/DB identity and an owner-only,
hash-bound backup restoration/rehearsal attestation. It permits only the additive
checkout table; repeats inspect its exact shape instead of dropping it.

An actual-time receipt is kept in the protected server release directory, not
backdated in Drizzle. The generic migration preflight and historical SQL remain
unchanged and blocked for production. This is intentionally not a general-purpose
baseline adoption or migration-repair flag. Evidence and rollback limitations
are in the [staging guide](../operations/teamassist-staging.md#юkassa-переход-тестовой-базы-7-октября).

References: [approved plan](../../tasks/plan.md),
[existing settlement decision](0003-billing-identity-durability.md),
[YooKassa idempotence](https://yookassa.ru/developers/using-api/interaction-format),
[payment without card saving](https://yookassa.ru/developers/payment-acceptance/scenario-extensions/recurring-payments/pay-without-saving).
