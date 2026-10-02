# Daryadarcy Modular Monorepo

## Phase 0 — Safety net

- [x] Make S3 integration tests credential-aware.
- [x] Remove stale source-text test expectations.
- [x] Capture public backend/router contracts.
- [x] Green checkpoint: test, type check, backend build.

## Phase 1 — Repository boundaries

- [x] Create workspace/ADR/package skeleton.
- [x] Move legacy Vite client to `apps/legacy-web`.
- [x] Move deployment assets to `infrastructure/deploy`.
- [x] Move repository helpers to `tooling/scripts`.
- [x] Green checkpoint: root commands and both current builds.

## Phase 2 — Backend and data

- [x] Move backend to `apps/backend`.
- [x] Move schema/migrations to `packages/database`.
- [ ] Extract domain routers and repositories.
  HTTP policy, billing, identity, launch configuration and comment repositories
  separated; club and moderation routers extracted without API changes;
  feed, articles and notification routers extracted with unchanged compiled handlers;
  legacy unused comment accessors removed; all tRPC namespaces now have domain
  modules, the root composes only. Remaining work: split db.ts/platform-db.ts
  repositories and large admin internals.
- [ ] Green checkpoint: API contract, tests, check, backend build.

## Phase 3 — Frontend

- [x] Move Expo application to `apps/frontend`.
- [x] Isolate shared contracts in `packages/shared`.
- [x] Verify web/iOS/Android configuration paths.
- [x] Green checkpoint: Expo web build, tests, check.

## Phase 4 — Enforcement

- [x] Add dependency-boundary checks (263 source files, narrow type/build exceptions).
- [ ] Remove temporary facades and stale paths.
- [ ] Split remaining oversized modules.
- [ ] Run final correctness, architecture, security, and performance review.

## Backend safety / launch follow-up — 2026-10-02

- [x] B01: Return/webhook trust boundary; unsigned, invalid/demo and failed events
  never grant or cancel. Files: prodamus.ts, billing-webhook.test.ts.
- [x] B02: Checkout is not login; claimPending only reports verified access;
  blocked email rejected. Files: routers.ts, db.ts, billing-checkout.test.ts.
- [x] B03: Blocked staff/public post details obey a shared access policy.
  Files: trpc.ts, routers.ts, access-policy.test.ts.
- [x] Checkpoint: full tests, type check, API build and evidence-backed review.
  215 passed / 3 skipped; check/build/diff-check pass. This is not release approval.
  Prototype pollution in webhook parser additionally reproduced and repaired.
- [ ] B04: Atomic/idempotent billing + amount/currency/provider identity validation.
  Acceptance: sequential/concurrent duplicate extends once, mismatched sum rejected.
  Verify: isolated MySQL integration tests + sandbox notification fixtures.
  Local club implementation and real-MySQL tests done; sandbox and legacy
  reconciliation pending. Shop remains outside this stage and must stay off at launch.
- [ ] B05: Email verification/setup/reset; no email-inferred staff privileges.
  Acceptance: expired/reused token rejected, existing password untouched.
  Verify: identity HTTP tests + migration rehearsal.
  Backend links/versioned sessions/explicit staff roles done locally;
  Frontend recovery entry and strict SMS capability switch checked locally;
  insert-only registration + atomic consent/setup outbox, email proof before
  password/login and explicit frontend consent checked on local HTTP/MySQL.
  staff preflight and production migration rehearsal pending.
  Read-only migration preflight added: detects orphan 0017–0019, changed hashes,
  unknown/gapped DB history; explicit connection only, no auto-apply. Migration
  0024 email/outbox indexes checked on disposable MySQL with lock-scope tests.
- [ ] B06: Transactional email outbox and resend.
  Acceptance: crash/retry loses no event, duplicate payment queues one message.
  Verify: worker failure/recovery integration tests.
  Atomic club outbox, leased workers, discarded status and audited staff resend
  implemented locally; real SMTP/device/operator acceptance pending.
- [ ] B07: Provider-confirmed cancellation and immediate block enforcement.
  Acceptance: failed provider response cannot report cancellation success;
  paid expiry retained. Verify: sandbox cancellation + all access-path tests.
  Durable request/confirmation, real local HTTP provider errors and retry checked;
  live sandbox profiles and legacy blacklist reconciliation pending.
- [ ] B08: Media validation, closed-body access and comment retention.
  Acceptance: non-image rejected, EXIF removed, protected body unavailable publicly.
  Verify: file fixtures and API authorization tests.
  Photo slice checked: avatar/post/comment JPEG/PNG/WebP decode and re-encode,
  metadata removal, server-owned filenames, 4 MiB/20 MP/concurrent decoder limits.
  13 photo scenarios pass; full local suite 236 pass / 32 skip (DB not provisioned),
  check/build/diff-check pass. Private legacy assets and retention still pending.
  Content/retention slice checked: published status enforced in feed/club/saved
  queries and discussion API; comments retained 365 days, bounded transactional
  cleanup also removes likes/reports and detaches newer replies.
  Disposable-MySQL checkpoint: 271 passed / 3 skipped, check/build/diff-check pass.
  Existing public storage links are NOT revoked by this API repair; migration and
  any optional protected-video implementation remain explicit release decisions.
  URL-import SSRF repaired: no external server-side download; accept only exact
  configured S3 origin + bucket. File upload/provider embeds remain separate paths.
  Eight spoofed/internal URL scenarios checked; full MySQL suite 292 pass / 3 skip.
- [ ] B09: First-release capabilities and seasonal/manager configuration.
  Acceptance: disabled SMS/shop payment/pen-pal routes cannot be called directly.
  Verify: capability matrix API tests and admin configuration roundtrip.
  Server guards checked for SMS, pen-pal discovery/matching and all legacy shop
  entry points (checkout/redirect/webhook/queued mail). Privacy withdrawal remains
  available. Shop cannot be enabled by an environment flag before durable repair.
  Seasonal/manager configuration and client wiring are still pending.
  Configuration slice checked locally: four seasonal sets/annual Moscow dates,
  fixed winter default, managerEmail, administrator-only revisioned/audited writes.
  Tests include concurrent edits, blocked actor, invalid dates/URLs and real JWT
  HTTP admin/public roundtrip. Migration 0023 rehearsed only on disposable MySQL.
  Client wiring/order submission still pending; contact config is not sent mail.
- [ ] Release checkpoint: sandbox E2E, migrations rehearsal, mail/load/security
  checks and approved rollout. Optional HLS/web push require separate scope review.
  Browser/API repair checked: explicit credentialed Origin allowlist, cross-site
  rejection before handlers, provider signature/return boundaries exempt, native
  JSON compatibility, no-sniff/referrer/framing headers and canonical client IP.
  Reverse proxy trust restricted to loopback; remote proxy topologies need review.
  GitLab/GitHub verification pipelines added with disposable MySQL, guarded test
  database URLs, frozen installs, boundaries/types/tests/API/web/post-build checks.
  Local equivalent: 341 passed / 3 skipped, both builds and regression pass.
  YAML parsed; remote runner execution has NOT been performed. No auto deployment.

## Repository navigation cleanup — 2026-10-02

- [x] R01: Group documents and archive historical notes without losing files/tasks.
  Verify: move inventory, relative links and tracked reference scan.
- [x] R02: Concise entry README/docs index/current backend and workflow guides.
  Verify: manual onboarding walk-through and link check.
- [x] R03: Separate one-off legacy tools; preserve normal command paths.
  Verify: command/import inventory and local build commands; no remote script run.
- [x] R04: Local-doc links tested and checked in CI; final types/tests/build review.
  Verify: failing fixtures → passing check, API/web/legacy builds, clean diff.
  Cleanup checkpoint: all 1070 original tracked files accounted for; 253 paths
  relocated, root Markdown reduced to README only. Current docs separated from
  archival snapshots; active tasks and runtime assets/licences preserved.
  Tools grouped into scripts/assets/data/operations/legacy at the same depth.
  Package command paths resolved; 99 JS/60 Python/4 shell files syntax-checked
  without executing remote operations. Frozen install passed without lock changes.
  Link checker: red fixtures first, then unit/isolated-Git CLI coverage; 40 current
  documents pass. CI gate added; remote pipelines have not been executed.
  Final local disposable-MySQL suite: 469 passed / 2 skipped. Types, 279-file
  boundaries, API build, legacy Vite build, main Expo web build and 52-test verify
  passed. Legacy font warning remains; no deployment or release approval.
