# ADR-007: Durable one-off YooKassa test checkout

- **Status:** Accepted for the user-approved backend implementation, not rollout
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

References: [approved plan](../../tasks/plan.md),
[existing settlement decision](0003-billing-identity-durability.md),
[YooKassa idempotence](https://yookassa.ru/developers/using-api/interaction-format),
[payment without card saving](https://yookassa.ru/developers/payment-acceptance/scenario-extensions/recurring-payments/pay-without-saving).
