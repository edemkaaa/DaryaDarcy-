# Spec: first email binding for a legacy member

## Status and objective

10 October 2026: the human approved the feature after the admin scope review.
Admin selects an existing legacy account without email; its owner confirms the
address through a single-use email link. Keep the same user ID, openId, phone,
password, session version and subscription. Never merge accounts or replace an
existing address. An occupied address is a conflict, not a merge instruction.

The human also approved the detailed schema/migration plan below. Implementation
includes the identity prerequisites, request/proof, confirmation, delivery,
retention and default-disabled HTTP transport; migrations
0027/0028 have been exercised only in owned disposable MySQL fixtures. No working
database migration, real mail or deployment. Binding is still unfinished.

## Scope and assumptions

- Use the existing admin role; moderators, ordinary users and guests cannot
  request a binding. Do not introduce a manager role or grant more permissions.
- Eligible recipient: ordinary user with a legacy phone, no email, not blocked,
  deleted or awaiting deletion. Administrator manually checks account ownership
  and payment; a confirmation link proves control of email, not that identity.
- The confirmation does not issue a session, set/reset a password or grant access.
  Existing login/recovery remains the path to entering the account afterward.
- Link expires after 24 hours. Opening a GET alone never confirms anything;
  the recipient must explicitly submit the confirmation.
- Default-disabled rollout until real SQL/concurrency/worker verification. Do not
  expose an active frontend form on a server lacking the agreed contract.

## HTTP contract (A4, receipt/status finalized before handlers)

All routes use no-store, bounded JSON validation and safe errors. Admin requests
use the existing session and same-origin checks; confirmation uses the proof,
not a caller-supplied user ID or authenticated browser identity.

- `POST /api/admin/member-email-bindings`: `{userId, email, requestKey}`.
  Stable key for one intent. 202 returns `{requestKey, state}`. A new pending
  request means recorded and mail queued, not delivered or bound. A replay
  returns its stored state (including terminal outcomes), never queues again;
  reject key reuse with another payload. Inspect GET for delivery details.
- `GET /api/admin/member-email-bindings/:requestKey`: admin-only inspection
  after an uncertain response. Return pending/confirmed/expired/cancelled and
  queued/sent/unavailable delivery state; never a proof or encrypted token.
  Exact response: `{requestKey, userId, state, delivery, expiresAt, completedAt}`.
  Dates are UTC ISO strings; completedAt is null while pending. State is the
  persisted lifecycle state, not a GET-triggered expiry mutation. Past expiresAt
  makes a pending proof unusable even before maintenance marks it expired.
  Sent means SMTP acceptance, not inbox receipt, and remains true after terminal
  cleanup. Otherwise only a pending, unexpired, undiscarded outbox with cipher
  is queued (including retry/lease); missing or unusable delivery is unavailable.
  Any currently active administrator can inspect; request creation remains
  actor-bound for replay. Check current role/session/lifecycle before lookup,
  including a missing key. Missing/purged request returns 404. Read never
  changes an account, queues mail, renews a proof or performs maintenance.
- `GET /api/auth/email-binding#token=...`: confirmation page. No identity write.
  Proof only in fragment/memory, removed from the address bar; no referrer.
  The backend returns an empty 302 to the configured PUBLIC_APP_URL origin at
  `/email-binding`. It never derives a target from Host, query or PUBLIC_AUTH_URL.
  The browser retains the fragment through the redirect; the server never sees it.
  Queries are rejected with generic 400, invalid configuration/default-disabled
  gate returns generic 503. No cookie, DB lookup/write or mail operation occurs.
  Existing cross-site Fetch Metadata policy still rejects webmail navigation;
  a narrowly reviewed document-navigation exception is a separate open gate.
- `POST /api/auth/email-bindings/confirm`: `{token}`. Reject malformed, expired,
  consumed or superseded proofs, unavailable recipient and occupied address.
  Successful confirmation changes only email, consumes the proof and audits it
  in one transaction. 200 returns exactly `{ok:true}`; 400 is generic for invalid,
  expired, occupied or already-used proof. A retry never moves an address to
  another account and must not imply that a lost successful reply did not commit.

Strict response schemas reject additional fields. Admin errors:
400 invalid input, 401/403 no authority, 404 unavailable request/account, 409
address/account/intent conflict, 429 throttled, 503 unavailable. Public proof
errors reveal neither account details nor email ownership.

The new routes remain closed unless `MEMBER_EMAIL_BINDING_ENABLED=true` explicitly
enables them after rollout review; disabled routes return 503 without opening the
database or authenticating. Route-controlled errors use `{error:"Запрос недоступен."}`;
the existing global browser-origin rejection retains its legacy 403 format and
does not gain a CORS exemption. JSON is required (415 otherwise); existing bounded
parsers retain 16 KiB for auth / 256 KiB for admin and safe 400/413 errors. All
responses are no-store, including unauthorized status reads. Request creation
uses the existing mail-action limit pattern (20/actor/hour in a separate binding
bucket); proof submission uses the existing completion pattern (20/IP/15 minutes,
separate binding bucket). Existing endpoint quotas/proxy trust are unchanged.
429 includes Retry-After; authenticated status inspection does not spend a
mail-action attempt. These in-memory limits have the same single-process scope
as existing auth limits; multi-instance rollout remains a separate review gate.

## Approved data and concurrency design

- Separate binding requests from password tokens: request key/payload hash,
  actor/recipient IDs, normalized email, proof hash, expiry and completion state.
  Never reuse password-reset/setup tokens to confirm email.
- Durable email delivery in the existing worker/outbox architecture, with a
  purpose-specific kind, encrypted delivery proof, leasing, bounded retry and
  queued-vs-delivered reporting. Missing encryption configuration fails closed.
- Unique normalized non-empty email identity on users. An occupied-address
  SELECT alone does not arbitrate concurrent binding and registration/checkout.
  Preflight existing normalized duplicates and incompatible data; refuse rollout
  without altering, deleting, merging or silently normalizing old accounts.
- Before adding uniqueness, harden the existing `upsertUser`: its current
  MySQL ON DUPLICATE KEY UPDATE applies to any unique key, not just openId.
  An email collision must not update the other account. Preserve intentional
  same-openId updates, reject cross-identity collisions, test all callers.
- Use current locked recipient reads for request/confirmation, consistent lock
  ordering and the unique constraint for concurrent different requests. No
  check-then-insert claim, no automatic retry with a newly generated intent.
- Audit request/confirmation without raw email, token or cipher in log/details.
  Clear the delivery cipher after send/discard. Scrub request email/proof material
  after confirmation, expiry or cancellation. Retain only intent hash, actor/
  recipient IDs and outcome for 30-day retry inspection, then purge the request.
  Account deletion must scrub/cancel pending email PII in the same transaction.

MySQL behavior motivating the upsert prerequisite is documented in its
[INSERT ... ON DUPLICATE KEY UPDATE reference](https://dev.mysql.com/doc/refman/8.0/en/insert-on-duplicate.html).

## Stack, structure and code conventions

Existing pnpm 9 workspace, TypeScript, Nest controllers/services, Drizzle MySQL,
Next/React admin. No dependencies or global CORS/session/proxy/quota changes.
Source: `apps/backend/src/identity/`, `packages/database/src/schema.ts` and ordered
migrations; frontend existing `features/admin/member-email-binding.tsx`.
Tests: Vitest `tests/`, opt-in owned MySQL fixtures, Playwright frontend `e2e/`.
Match existing DI and strict input patterns, for example:

```ts
constructor(@Inject(SessionService) private readonly sessions: SessionService) {}
```

## Ordered slices and acceptance

1. Identity collision prerequisite: RED proves cross-identity data cannot change;
   GREEN keeps same-openId updates and registration/checkout behavior. Review.
2. Request and proof transaction: test no pre-confirmation identity write,
   first-binding eligibility, stable intent replay, conflicts, rollback and races.
   Add reviewed migrations only after schema approval; do not apply to dev DB.
3. Delivery and confirmation: encrypted single-use purpose-specific proof,
   expired/consumed/superseded/blocked/deleted refusal, no GET mutation or session.
   Loopback-only SMTP fixture; no external recipients.
4. Frontend: connect existing design, validate complete replies, pending vs sent
   vs bound, double-click exclusion, unknown-result inspection, session-change
   cancellation and no stale success. Refresh canonical members after confirmation.
5. Review and acceptance: existing auth/payment/admin regression, native real
   SQL with concurrency, compiled native HTTP, browser tests at mobile/desktop.
   Preserve disabled rollout if real SQL evidence is unavailable.

## Verification commands and boundaries

Run from repository root with its Node 22 runtime: `pnpm check`, `pnpm build`,
`pnpm build:frontend`, `pnpm lint`, `pnpm check:api`, `pnpm check:boundaries`,
`pnpm check:docs`, `pnpm exec vitest run --no-file-parallelism` and focused tests.
Browser: `pnpm --filter @daryadarcy/frontend test:e2e -- e2e/member-email-binding.spec.ts`.
SQL only with a newly owned isolated disposable database and validated fixture
URL. Docker recovered before its approved restart was needed. MySQL 8.4 tests
use a new loopback container, tmpfs storage and no persistent volume. Never
substitute the working database. Remove only the run's validated container.

Always: tests before implementation, small verified commits, validate authority
again at writes, preserve foreign changes and existing account/payment behavior.
Ask first: schema/migration plan, new auth/roles/quotas, real external delivery,
restart of shared Docker, rollout/push/deployment. Never: commit secrets, log proofs,
silently repair old users, run fixture cleanup on a working database.

## Current implementation checkpoint

A6c2 adds the default-disabled read-only GET bridge to the existing public
frontend page. Four native HTTP RED failures (404) preceded 19 HTTP/SQL GREEN:
flag, configured target/Host independence, query rejection and invalid config.
Thirteen production browser/native API/MySQL/loopback SMTP cases now pass using
the actual delivered link, without test-only path translation: the redirect
preserves the proof in browser memory, no GET mutates SQL, and only explicit POST
binds email while preserving other identity/access/cookie state. This remains
local transport-proxy acceptance, not deployment acceptance. Cross-site webmail
navigation still returns 403; no CORS or Fetch Metadata relaxation is applied.
A6/Checkpoint A/rollout remain open until that entry boundary is reviewed.

A6c1 verifies a production admin request through native Nest/MySQL and actual
nodemailer delivery to an owned loopback SMTP wire. The recipient uses the proof
parsed from delivered MIME, not a decrypted outbox. Delivery scrubs the cipher
but does not bind email; explicit confirmation on the direct frontend page
preserves every other user field, paid access and unrelated browser cookie.
Repeated delivery does not send again. Thirteen native cases pass, including
one diagnostic that exposes the actual entrypoint blocker: the delivered GET
returns 404, and cross-site document headers return 403. The partial recipient
case explicitly translates the path to `/email-binding` in test code only.
It is not full email-entry/deployment acceptance; A6 and Checkpoint A remain
open pending reviewed GET/navigation routing. No production policy is changed.

A6b2 native acceptance exposed two bugs: session identity initialization remounted
the proof screen after its fragment was removed, and fragment-only reopening did
not remount it. The public route now bypasses session providers (other screens
retain their identity fences), and hashchange explicitly recaptures/clears proof
while aborting prior work without submitting automatically. Three native RED
cases progressed to ten passes plus one reopen RED, then eleven native GREEN.
Native production UI/Nest/MySQL verifies no write on opening, explicit confirmation,
expiry, lost committed reply and consumed reopen without duplicate audit. Recipient
credentials/access and the unrelated administrator browser cookie remain intact.
43 proof/login/session browser regressions and types/lint/active build pass.
The 320px active layout has no overflow. Owned tmpfs database removed only after
full ID/label/mount checks. No external SMTP/provider/deployment/working SQL.
Proof still comes from the fixture outbox; email GET routing, loopback-SMTP
recipient acceptance and A7 remain open. No CORS/origin-policy relaxation.

A6b1 adds a default-disabled Next confirmation screen at `/email-binding` using
the existing login styling. Opening clears the fragment without submitting;
explicit action is single-flight, success requires the strict receipt, and every
uncertain response clears the memory proof and offers ordinary login/admin
inspection rather than automatic replay. No session/password/access is issued.
Two browser RED checks preceded six active + one disabled GREEN browser cases
with mock API; a synthetic unrelated cookie is omitted. Types/lint/boundaries,
active/default builds and 30 proof-client tests pass. Default-off build restored;
320px disabled layout inspected without overflow. This is not native SQL/SMTP
acceptance. The approved email GET remains unregistered in backend, and existing
Fetch Metadata rejects cross-site navigation there. No CORS/origin relaxation
has been made; route/navigation acceptance is required before rollout.

A5c3 is now locally verified through eight production-browser/native Nest/MySQL
cases: request/recovery, expiry, canonical confirmation refresh and revoked admin
authority. The browser transport proxy is not deployment-proxy acceptance, and
the proof comes from a synthetic fixture outbox, not delivered SMTP.

A6a adds a strict explicit proof client and memory-only fragment capture. Two
focused RED tests preceded 30 GREEN tests (one real loopback HTTP), with 679
related client/frontend tests, types/lint/boundaries/default build passing.
No cookie, referrer, account ID, redirects or automatic retries accompany the
proof POST. Only exact HTTP 200 `{ok:true}` confirms; consumed-proof refusal is
ambiguous after a lost reply. Clear history before returning a valid fragment;
failure to clear, malformed, duplicate or oversized fragments fail closed.
This helper is not yet connected to a page. A6b must implement and verify the
read-only GET entry: `/api/**` is routed to backend in deployment, and the
approved confirmation GET is currently unregistered. A6, the full SMTP flow and
A7 remain open; no working database, mail, deployment or rollout change.

A5c2c supersedes the no-resend recovery limitation below: an unknown recovered
intent accepts an explicit re-entry of the original email, validates it and
reuses the same durable key. It never guesses the address or creates a new key;
the existing backend fingerprint rejects a different payload for a recorded
intent. Draft input is keyed to its intent so a new tab's unrelated address is
not prefilled as the original. Email remains memory-only. Generic HTTP refusals,
including 409, cannot prove absence and do not unlock a new intent. An unknown
original address requires manual investigation, not a guessed retry or reset.
Twenty-four active browser cases pass (two initial RED plus one review RED),
with real IndexedDB but mock HTTP. A5c3 native browser/API/SQL acceptance, A6
confirmation and the full loopback-SMTP checkpoint remain open. No rollout.

A5c2b: an explicitly prepared fresh draft is now allowed after an inspected
expired/cancelled intent. The action revalidates the exact intent via GET, then
compare-and-deletes only its local recovery key; it does not send mail. A changed
cross-tab key, failed read or nonterminal state cannot unlock a fresh draft.
Confirmed status refreshes canonical members instead. Twenty-one active browser
cases pass with real IndexedDB and mock HTTP (three new initial RED); native
API/SQL acceptance remains open. A5c2c must address unknown intents without the
original email and HTTP refusals without treating a generic 409 as proof that
an intent never existed. No server flags, worker or deployment changed.

A5c2a supersedes the memory-only limitation below: the opt-in form now reserves
its journal key before POST, checks it before an in-memory retry, and explicitly
restores a saved key via GET after reload. An existing cross-tab reservation
causes inspection, not a POST with the second tab's email. Recovered intents
without their original in-memory email cannot be resent. Storage failure blocks
submission; unknown/404 does not discard the key. Sixteen active browser cases
(three new initial RED) and ten default-disabled cases pass with native IndexedDB
and mock HTTP. A5c2b still owes explicit terminal/refusal reset and safe handling
of a reserved-but-unsent/unknown intent without its email, followed by native
API/SQL acceptance. The rollout gate remains closed; no external mail was sent.

A5c1 prerequisite: a standalone browser IndexedDB journal now durably reserves
one versioned requestKey per actor/member in a readwrite transaction, including
cross-tab races. It stores no email, proof or server outcome, refuses malformed
metadata/storage failures, and uses compare-and-delete for terminal cleanup.
Nine real IndexedDB browser cases pass (six initial RED cases). This journal is
not yet consumed by the form: A5c2 must wire session-bound recovery and explicitly
verified terminal/refusal handling before native API/SQL acceptance. A GET 404
after an unknown POST is not by itself permission to discard the key. Local
metadata is never authorization. No deployment or external mail was performed.

A5b frontend checkpoint: the existing form now has a default-disabled build
opt-in `NEXT_PUBLIC_MEMBER_EMAIL_BINDING_ENABLED=true`, separate from the server
gate. Enabling only the UI cannot enable the backend. Use the same explicit flag
for the local production build and `member-email-binding-active.spec.ts`; run
the original preparation tests against a default-disabled build. The intent is
currently memory-only above the members tab, so closing/reopening the form or
changing admin tabs preserves it, but page reload does not. A5c must complete
PII-free reload/cross-tab recovery, terminal/refusal handling and native browser
acceptance before rollout. Eleven active mock-API browser scenarios are not an
end-to-end email binding certification. No deployed flags were changed.

The approved writer prerequisite now claims/inserts inside a transaction without
changing a duplicate row's fields, locks the requested openId and updates only its
user ID. Missing identity rejects and rolls back; other uniqueness errors propagate
without a partial credential update. Existing input/default/null behavior remains.
Four SQL-boundary RED failures preceded five GREEN checks. These tests double only
the mysql2 transport; they do not prove MySQL constraint or concurrency behavior.
The opt-in SQL suite shadows users in a connection-local temporary table so the
candidate email/phone uniqueness cannot alter shared fixture indexes or rows.
The five native writer cases now pass on an owned disposable MySQL 8.4 database;
the temporary-table setup needed SHOW CREATE TABLE rather than self-shadowing
CREATE TEMPORARY TABLE users LIKE users. No Docker restart was necessary.

Migration 0027 adds a functional unique key on NULLIF(LOWER(TRIM(email)), '')
without changing the visible email field, lookup index or existing collation.
Multiple NULL/empty addresses remain allowed. Two native RED failures first
proved duplicate identities under case/space variants and concurrent requests;
the constraint gives exactly one concurrent winner without changing another
account's credentials. Six same-identity retries keep one account.

Read-only migration preflight now checks email data only when 0027 is pending,
after manifest/history validation. It reuses canonical email normalization and
validation, scans 500 rows per page (including nonpositive legacy IDs), and fails
closed beyond 10,000 pages or on a query error. Incompatible/duplicate data returns
only issue codes; no raw emails or IDs are emitted and no repair is attempted.
Native legacy tests prove rejection leaves rows unchanged and failed unique DDL
does not silently remove duplicates. The CLI keeps the existing history gates.

Rollout still requires separately reviewed real history and data inspection,
backup, MySQL version compatibility and an identity-write maintenance window:
preflight is a point-in-time read, not a lock held through DDL. The DDL independently
refuses duplicates. The existing untracked 0017/0018/0019 manifest gate is unchanged;
do not repair/rewrite those historical files to bypass it. MySQL 8.4 is verified;
other deployment versions are not certified by these fixtures.

The separate durable request/proof/outbox is now implemented as an internal-only
operation; see [ADR-008](docs/decisions/0008-member-email-binding.md). Its input is
strict: a positive signed-INT user ID, normalized valid email up to 320 characters
(raw input bounded to 1024), and a lowercase UUIDv4 request key. The authenticated
actor supplies user ID and session version, never frontend-controlled authority.
The internal receipt contains only `{requestKey, state}`; it is not a mail
delivery receipt. A4 now specifies its transport projection above; strict
transport validators and default-disabled route handlers are now implemented.

Migration 0028 adds dedicated binding and delivery tables, leaving password and
access-mail tables untouched. The request atomically stores a purpose-bound proof
hash, AES-GCM cipher and PII-free audit while leaving every user field unchanged.
Current actor/recipient locks serialize competing first bindings; replay uses
the original payload hash and never recreates proof/mail/audit or requires a key.
A cancelled, scrubbed intent remains cancelled when replayed.

24 expected native RED failures preceded 26 GREEN cases; expanded acceptance now
has 36 real-MySQL cases, including authority revocation, bounded input, rollback,
missing encryption, six concurrent retries and competing administrators. Opening
an address is never an implicit confirmation mechanism; the explicit page is A6.

The request-stage checkpoint required delivery, explicit POST and retention;
those backend slices are now implemented, with HTTP routes default-disabled.
Frontend integration follows. Worker registration and an enabled frontend form
remain outstanding. Requests are not callable from the deployed application.
Pending requests (even expired ones) conservatively prevent another intent until
the cleanup slice handles them. A queued request does not reserve the email:
confirmation rechecks the current recipient and arbitrates ownership through 0027.

A4a recovery checkpoint: the internal status operation returns the exact safe
projection specified above, reads binding/outbox in one snapshot, and checks the
current administrator under a shared user lock before revealing existence.
No address, hash, cipher, delivery error, attempt or lease metadata is returned;
no lifecycle/identity/mail write occurs. Missing delivery fails closed. 21 initial
native RED cases precede 26 GREEN checks; removing the authorization lock fails
the concurrent-revocation test. Combined request/status/confirmation/lifecycle/
delivery regression: 129 pass on owned MySQL and loopback SMTP. The subsequent
A4b transport adds 16 native HTTP/SQL cases, including a compiled production ESM
request/status/confirm/replay scenario. Eight initial route RED failures and
separate same-origin/no-store RED checks preceded GREEN. Both new quota patterns,
current session/role/lifecycle, bounded JSON, safe errors, SQL rollback/retry and
no credential/session/subscription writes are covered. Full serial regression:
3028 pass / 30 opt-in skips; types, backend build, API/boundaries/docs pass. No
working deployment, external mail or browser confirmation-page acceptance is
claimed. Rollout remains disabled; A5/A6/A7 and Checkpoint A are still required.

Previous prerequisite checkpoint: full serial suite with disposable MySQL gives 2878
passed, zero failed, 30 opt-in skipped across 192 files. Types, backend/frontend builds,
lint, unchanged API/boundaries/docs checks pass. Working-server release and
external delivery acceptance remain separate; local SQL evidence is not rollout.
The 72-check native selection also passed again after the full run. Both owned
tmpfs containers have been removed; no shared containers/data were changed.

Request/proof checkpoint: full serial regression on a new owned MySQL fixture gives
2914 passed, zero failed, 30 opt-in skipped across 193 files. All 36 new native cases
passed again after the full run. Fresh types, backend/frontend builds, lint,
unchanged API, boundaries and docs checks pass. Five-axis self-review covers
atomicity/replay, purpose separation, privacy, stable locks and bounded queries.
The run-03 tmpfs container was removed; its disposable data is not recoverable.
Working data and other containers were untouched. Confirmation/delivery/cleanup
are not accepted by these request tests and remain required before rollout.

### Internal confirmation checkpoint — 10 October

`confirmMemberEmailBinding(database, token)` returns true only for a newly committed
first binding. False is generic for malformed/unknown/consumed/terminal proofs,
expiry, unavailable recipient or occupied email; it does not disclose which case
occurred. Database failures throw only sanitized `EmailBindingError("unavailable")`
without a SQL cause. This is an internal contract, not an exposed HTTP response.

The candidate lookup routes only to a user ID. Current user and request are locked
in user → binding → outbox order and the purpose hash, pending state, expiry and
recipient eligibility are rechecked. Confirmation changes only `users.email`,
including preserving `updatedAt`, password, session version and paid access.
The requesting actor in the confirmation audit is intent provenance, not an
authenticated confirmation caller. No new admin-demotion cancellation policy is
introduced; email-control proof and current recipient eligibility authorize this
operation. No session or password link is issued.

The normalized unique index independently arbitrates ownership. A duplicate-entry
loser cancels/scrubs in the same transaction, while other database errors roll back
everything. Expiry is checked again after a potentially blocking email UPDATE;
an expired uncommitted write is undone before the intent is marked expired.
Confirmed, expired and cancelled results scrub pending email/hash/cipher and
delivery leases atomically; intent fingerprint/IDs/outcome remain for inspection.
Existing sentAt is preserved. Terminal outbox entries cannot be sent by the future
worker, which must distinguish historical delivery from terminal disposal.

24 behavioral RED failures preceded GREEN. Expanded acceptance has 35 real-MySQL
cases; a further isolated RED showed expiry during a unique-index wait, now GREEN.
Native contention checks wait for the blocking transaction's connection, not its
secondary-index thread attribution; slower bounded sampling avoids the observed
stale transaction metadata. No production assertion was weakened for the fixture.
Five selected files/90 checks pass, including both directions of password-proof
separation, six-use single winner, different-member address contention, current
recipient revocation while waiting, audit-trigger rollback and privacy cleanup.

Still required before exposure: leased/retrying delivery, automatic expiry and
30-day purge, deletion-transaction scrub, HTTP schemas/status/explicit POST,
fragment-only page and admin form integration. GET remains unregistered rather
than an implicit write. No external mail, working DB migration, push or deployment.

Confirmation checkpoint: full serial suite on owned MySQL gives 2949 passed,
zero failed, 30 opt-in skipped across 194 files. Both request/confirmation suites
were repeated afterward: 71 passed. Types, backend/frontend builds, lint,
unchanged API, boundaries and docs pass. Five-axis self-review checks atomicity,
purpose/privacy boundaries, current locks, bounded queries and no session/access
mutation. Run-04 was removed after ownership inspection; its volatile test data
is not recoverable. Shared containers and working data were untouched.

## Lifecycle and delivery checkpoint — 10 October 2026

Automatic expiry and 30-day terminal retention are implemented as an internal,
bounded maintenance operation, not yet registered with a worker. Account deletion
now cancels pending proofs in its existing transaction, including the encrypted
delivery material and PII-free audit. A failed scrub/audit/final account update
rolls back. Before 0028, absence of both binding tables preserves legacy deletion;
a partial schema refuses the deletion. Cleanup is independent of any UI flag.

The internal mail processor claims candidates in user → binding → outbox lock
order and revalidates current recipient, expiry, ownership and delivery lease.
It follows the existing access-mail operational bounds: twenty candidates per
pass, five-minute lease, twelve attempts, exponential minute-based backoff capped
at one day. Expiry still limits the proof to 24 hours from the original request.
Cipher decryption authenticates the immutable intent and verifies the proof hash.
Only the configured public origin can receive the fragment-only confirmation URL.

SMTP runs outside database transactions. A blocked/deleted account after claim
can receive an already-in-flight email, but confirmation independently rechecks
eligibility and cannot grant a session or access. Only the current lease can
record an acknowledgement; terminal proofs are never resurrected. SMTP acceptance
clears the cipher, not the unconsumed confirmation hash. Failed delivery retains
the same encrypted proof until retry or terminal cleanup.

Delivery is at-least-once: a lost acknowledgement can produce another copy with
the same proof and Message-ID. A stable Message-ID is not a provider deduplication
guarantee. A real loopback SMTP fixture plus MySQL fault injection exercises this
case; an unknown result must not create a new proof or change account credentials.

Remaining before exposure: finalized HTTP schemas/status/explicit POST, fragment
page and existing admin form integration, worker registration, reviewed migration
history/data rollout and actual external delivery acceptance. These local changes
do not enable email binding on the working server or certify payment providers.
