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
never a terminal result. The initial foundation was internal; the subsequent
HTTP slice adds `club.reconcileCheckout` as a mutation with undefined input and
strict state-only output. Its key stays in the header. Reject batching so one
header cannot ambiguously cover multiple operations. Existing cross-site/body
bounds, no-store and generic errors apply; GET cannot invoke this mutation.
This is not connected to the UI or deployed. Bounded polling and terminal-safe
browser lifecycle remain required before enablement.
No schema or dependency changes.

### Read-only browser return caller

The return caller reads the existing validated browser record without email,
writer locks, key generation or any storage write. One atomic read is sufficient
for this snapshot; all new reservations still require the exclusive Web Lock.
Absent evidence returns `null` without HTTP. Corrupt or inaccessible evidence
fails closed and is preserved, never treated as a canceled purchase.

`reconcileClubTestCheckout` sends only a POST with undefined input and the saved
UUID header through the canonical tRPC transport. It strictly validates the
state-only reply and fences both the captured session and optional caller abort.
After the response it rechecks that the saved key still matches: another tab's
replacement, removal or corruption cannot apply an old result to a new purchase.
It never retries, rotates, creates, logs in or clears evidence, including after
success/cancellation. A polling UI and an explicit server-verified next purchase
remain separate, unwired gates. Browser tests here cover Chromium only; Safari
and actual provider acceptance still require the later full-flow checks.

### Bounded browser return polling

A check campaign is bound to one saved UUID and one captured session. It checks
immediately, waits five seconds **after completion**, and performs at most six
requests within a 30-second total budget. Only `pending` continues; `unknown`,
terminal states and missing evidence stop. Errors, including 429, stop without
automatic retry. The later UI must respect the quota cooldown for explicit
checks and abort when hidden/unmounted; this helper does not start itself.

Caller/session cancellation and a changed saved UUID cannot switch the campaign
to another purchase. Timers and abort listeners are cleaned up. If the total
budget expires after a pending observation, keep only that last known pending
result; never invent success/cancellation or release an intent. A first-request
timeout remains an error. Browser fixture acceptance exercises the actual caller
and HTTP transport against local synthetic replies, not a real payment provider.

### Result check ownership

The feature-owned result controller starts nothing at construction. An explicit
`check` runs one existing finite polling campaign, and concurrent checks are
ignored. Report absence distinctly; bind observed states to the saved UUID,
show pending as still checking during the campaign and release checking on its
finite end without inventing a terminal result. A caller cancellation or
identity change yields paused, not a payment error; disposal aborts and prevents
later callbacks. Neither operation erases or replaces browser evidence.

A 429 stores the canonical validated delay as an absolute retry deadline in
the controller. Refuse explicit checks before that deadline and do not schedule
a retry on expiry. Missing/invalid delay falls back to the approved 60-second
window; this is client presentation/control, not a new server quota. The future
screen owns visibility/retained-tab cancellation and disposal, and must keep this
controller while temporarily hidden so cooldown is not lost. This foundation
does not mount a screen, grant access or enable checkout. Server and provider
proof remain mandatory, as do Safari/full-flow and existing rollout gates.

### Explicit next-intent reservation

Replacing browser evidence is an explicit operation, not a consequence of a
return URL, old UI observation, timeout or elapsed time. The caller supplies the
previously observed UUID and a validated new selection. Under the same exclusive
origin-wide Web Lock, require that exact saved UUID, issue a fresh canonical
`club.reconcileCheckout` POST, validate strict state-only proof and permit only
`succeeded` or `canceled`. Compare the whole stored record again before writing,
so non-cooperating writes cannot silently replace evidence during verification.

Capture session/caller cancellation before hashing and fence it before dispatch
and storage replacement. Lock acquisition is bounded to five seconds; the
canonical transport bounds the server request. Missing/corrupt/stale evidence,
pending/unknown, malformed replies, API errors (including quota refusal), abort,
storage/crypto failures and UUID collision refuse replacement. Preserve safe
transport status for the later quota-aware UI; never expose private browser errors.

Reserve and read back the new UUID/hash before any future payment dispatch. A
readback failure must not roll the durable record back to the prior key: a retry
recovers the newly saved intent through the ordinary selection-bound caller.
Two real Chromium tabs prove one winner and one stale refusal with only one
server check. This operation itself creates no payment/order/account and remains
unwired; the explicit next-purchase dispatch and result UI are still separate
gates. Actual provider and Safari acceptance are not established by local fixtures.

The subsequent `createNextClubTestCheckout` caller composes this reservation
with the canonical keyed `club.createCheckout` POST. It captures cancellation
before the old check and fences that signal and the newly saved UUID again
before dispatch. It never retries, clears evidence or rolls back to the terminal
key on failure/timeout. An ordinary explicit retry uses the new saved intent and
the same canonical selection; it does not run the next-purchase operation again
with the obsolete old UUID. These callers remain unwired to the club screen and
do not enable TEST checkout or change legacy checkout behavior.

### Return-check quotas

The canonical user-facing tRPC error link preserves a positive safe-integer
delta-seconds `Retry-After` as allowlisted scalar `meta.retryAfterSec`. It does
not forward provider response/header/body metadata, accept malformed/negative/
fractional values or schedule retries. The quota endpoint emits delta seconds,
not HTTP dates. This repairs lost cooldown information without changing any
server quota, authentication, batching or transport deadline.

The user approved 12 attempts per intent and 60 per resolved client IP in a
60-second window. Apply the HTTP policy before input/service execution, after
rejecting batching. The IP bucket counts malformed/missing UUIDs and disallowed
input in parsed JSON (not parser failures); an IP refusal cannot consume another
intent's allowance. Valid UUIDs
use a lowercase hash bucket shared across IPs. No raw capability key is retained
in the counter or returned in the generic tRPC 429 response. `Retry-After` gives
the remaining positive number of seconds, while no-store and no-session remain.
Refusals do not extend the window or start/rotate/cancel a purchase.

Reuse the existing bounded fixed-window limiter rather than add Redis for a
single test API process. Its windows start with the first counted attempt, not
calendar minutes; counters expire after 60 seconds, with lazy cleanup and
fail-closed capacity at 10000 live entries shared with existing limiter callers.
This is neither a persistent nor a multi-process quota: restarting resets
counters. Before scaling require a shared atomic store. Before rollout verify
the real proxy chain: use Express-resolved IP only, never raw forwarded headers,
and do not broaden trust-proxy here. The current Docker edge is not loopback,
so the existing API configuration conservatively groups requests by that peer
until a separately reviewed proxy policy is in place. Webhook settlement,
checkout creation, authentication and CORS are unchanged.

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
