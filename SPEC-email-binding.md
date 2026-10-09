# Spec: first email binding for a legacy member

## Status and objective

10 October 2026: the human approved the feature after the admin scope review.
Admin selects an existing legacy account without email; its owner confirms the
address through a single-use email link. Keep the same user ID, openId, phone,
password, session version and subscription. Never merge accounts or replace an
existing address. An occupied address is a conflict, not a merge instruction.

The detailed schema/migration plan below awaits human approval. No production
implementation, database migration, real mail dispatch or deployment yet.

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

## Proposed contract

All routes use no-store, bounded JSON validation and safe errors. Admin requests
use the existing session and same-origin checks; confirmation uses the proof,
not a caller-supplied user ID or authenticated browser identity.

- `POST /api/admin/member-email-bindings`: `{userId, email, requestKey}`.
  Stable key for one intent. 202 means recorded and mail queued, not delivered
  or bound. Replay the same intent; reject key reuse with another payload.
- `GET /api/admin/member-email-bindings/:requestKey`: admin-only inspection
  after an uncertain response. Return pending/confirmed/expired/cancelled and
  queued/sent/unavailable delivery state; never a proof or encrypted token.
- `GET /api/auth/email-binding#token=...`: confirmation page. No identity write.
  Proof only in fragment/memory, removed from the address bar; no referrer.
- `POST /api/auth/email-bindings/confirm`: `{token}`. Reject malformed, expired,
  consumed or superseded proofs, unavailable recipient and occupied address.
  Successful confirmation changes only email, consumes the proof and audits it
  in one transaction. A retry never moves an address to another account.

Response schemas must be finalized before implementing handlers. Admin errors:
400 invalid input, 401/403 no authority, 404 unavailable request/account, 409
address/account/intent conflict, 429 throttled, 503 unavailable. Public proof
errors reveal neither account details nor email ownership.

## Data and concurrency design requiring approval

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
URL. Docker ping currently times out; never substitute the working database.

Always: tests before implementation, small verified commits, validate authority
again at writes, preserve foreign changes and existing account/payment behavior.
Ask first: schema/migration plan, new auth/roles/quotas, real external delivery,
restart of shared Docker, rollout/push/deployment. Never: commit secrets, log proofs,
silently repair old users, run fixture cleanup on a working database.
