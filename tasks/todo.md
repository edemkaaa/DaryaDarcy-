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

## Repository hygiene follow-up — 2026-10-02

- [x] C01: Canonical frontend public resources; packaging fails on missing files.
  Verify: red/green isolated packaging tests and both web builds with byte checks.
  Three fixture tests failed for the intended omissions before the repair, then
  passed. Legacy Vite and Expo exports passed; public-resource bytes preserved.
- [x] C02: Preserve historical deployment artifacts in the audit archive; ignore
  generated reports and document active configuration versus old snapshots.
  Four artifacts moved with exact byte comparison against Git originals. Lifecycle
  policy unchanged; both old/current report output paths ignored, archive tracked.
  Existing S3/SSH root/path mismatch documented; repair remains separate work.
- [x] C03: Remove empty root placeholder; align Cursor guidance with monorepo and
  explicit deployment authorization; verify links/types/boundaries/local tests.
  Local checkpoint: 409 tests passed / 65 skipped without a test MySQL. Types,
  279-file boundaries, 40-document links, API/Vite/Expo builds and 52-test verify
  passed. Legacy Vite font warning remains. Root .gitkeep removed (recoverable in
  Git); source, licences and unfinished backend tasks preserved. No push/deploy.

## Current-team ownership cleanup — 2026-10-02

- [x] C04: Delete irrelevant editor/generator/one-off artifacts, remove stale
  commands/links and ignore local Cursor settings. Preserve deployment and its
  helper closure, current requirements/audits, CI, runtime sources and open tasks.
  Verify: protected-file hashes, reference scan, docs/boundaries/types/tests/builds.
  Removed 37 tracked files, including Cursor rules, unused Expo reset, old report
  generator/command, archived npm lock/QR and spent notes/diagnostic scripts.
  Protected-file digest confirms 815 runtime/deploy/CI/lock files unchanged.
  Frozen install, 37-document links, 279-file boundaries, types, API/Vite/Expo
  builds and 52-test verify passed; final local suite 409 pass / 65 skip without
  test MySQL. Vite font warning remains. Removed files recoverable from 9c39659;
  no push, external operation or release approval.

## Backend continuation: notification access — 2026-10-02

- [x] N01: Blocked accounts excluded from every push delivery audience; latest
  consent resolves equal-second events deterministically. Extends B07.
  Verify: failing real-MySQL regressions, permitted/denied recipient matrix,
  grant/revoke ties, full local suite/types/boundaries/API build and contract.
  Confirmed both defects with real MySQL: 14 of 15 focused cases failed before
  the fix; all 15 pass after. Full disposable-MySQL suite: 487 pass / 2 skip;
  types/boundaries/docs/API build/52-test verify pass. No schema/API changes or
  external notifications. Already-queued messages/device acceptance remain out
  of this local guarantee; B07 and the overall release checkpoint stay open.
- [x] N02: Push failures cannot be reported as successful submissions. Validate
  HTTP/JSON/ticket outcomes, preserve audience filtering and 100-message chunks.
  Verify: failing transport fixtures, partial batches, full suite/types/API build.
  Confirmed 13 failing cases before repair; all 17 transport regressions pass.
  Full disposable-MySQL suite: 504 pass / 2 skip; types/boundaries/docs/API build
  and 52-test verify pass. Only provider acceptance is counted, not device delivery.
  Real devices, receipts/retries and stale-token cleanup remain separate work.

## Backend continuation: account retention — 2026-10-02

- [x] N03: Account anonymization is atomic and rechecks eligibility under the
  billing owner lock. Late failure rolls back all profile/comment/activity edits;
  concurrent workers count once; a committed renewal prevents stale deletion.
  Verify: real-MySQL failure/renewal/concurrency tests, existing 30-day and active
  subscription rules, full suite/types/boundaries/docs/API build. No live purge.
  Three failures reproduced before repair; all 8 real-MySQL cases pass after.
  Full suite: 512 pass / 2 skip; types/boundaries/API build/52-test verify pass.
  Financial/audit/backup/S3 and old mail/link retention remain separate work;
  B08 and release checkpoint remain open, not complete erasure or release approval.
