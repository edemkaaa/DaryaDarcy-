# ADR-002: Evolve backend, replace unsafe domain flows

- **Status:** Proposed for full launch; immediate security repairs requested
- **Date:** 2026-10-02

## Context

Existing Express/tRPC and Drizzle can implement the launch requirements. Backend
builds and 183 local tests pass, but those tests do not cover billing trust
boundaries. routers.ts (1013 lines), db.ts (1617), platform-db.ts (708) combine
policy, orchestration and persistence. Passing tests are not security approval.

## Decision

Keep the stack and schema until an explicit migration is designed. Preserve API
names and safe response shapes, not insecure side effects. First repair the
known payment/auth bypasses with red/green regression tests. Then extract each
domain behind a typed contract and replace its business flow with verified
transactions. Deploy as one service; no microservices or second backend.

## Alternatives considered

Full rewrite: cleaner start, but recreates integrations, data compatibility and
release tooling; cannot safely compare behavior without missing billing tests.
Rejected as default. Reconsider if deeper audit establishes incompatible data
model or platform constraints, not because a file is large.

Cosmetic file splitting: helps navigation but preserves insecure rules. Not
sufficient. Structural moves and behavior fixes stay separately reviewable.

## Consequences

Compatibility methods may change unsafe semantics: claimPending becomes status
only, checkout never authenticates by email, browser return never fulfils an
order. Passwordless legacy users need a verified setup/reset flow before launch.
Fail-closed webhook handling can reject legacy recurring payloads without an
explicit paid status; capture real sandbox fixtures before rollout.

Payment idempotency must be durable in MySQL. Current single shared connection
cannot safely host concurrent request transactions; replace it with isolated
pool connections before transaction-based settlement. Never promise exactly-once
email delivery across SMTP; use unique outbox events and retry semantics.

## Migration and rollback

No production changes in this audit. Each repair is independently committed and
tested. Do not roll back to known access bypasses to resolve an integration issue;
pause checkout and reconcile pending provider payments instead. Schema migrations
need backup, rehearsal, constraints and documented rollback before execution.
