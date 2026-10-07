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
