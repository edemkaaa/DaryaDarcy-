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
- [x] N04: Manual club grants serialize with settlement and account retention;
  distinct simultaneous grants accumulate every day with distinct order IDs.
  Preserve API/default duration; validate days and reject blocked/deleted users.
  Verify: real MySQL concurrency/expiry/recipient/bounds tests, full suite and API
  contract/types/boundaries/docs/build. Retried HTTP intent idempotency not added.
  Six original failures → all 12 focused cases pass, including 10 simultaneous
  grants with independent order IDs and all added days preserved. Full suite:
  524 pass / 2 skip; types/280-file boundaries/docs/API build/52-test verify pass.
  Module billing/grants.ts owns the transaction; router/facade signatures unchanged.

## Backend continuation: video publication boundaries — 2026-10-02

- [x] N05: Hidden videos cannot be fetched by public ID or streamed through the
  YouTube proxy; unknown catalog IDs never invoke downloader/upstream transport.
  Verify: real HTTP/MySQL list/detail/stream/Range/cache-revocation fixtures,
  internal hidden-video dedup, full suite/types/contract/boundaries/docs/API build.
  Public S3/YouTube originals and already-open streams stay outside this guarantee.
  Four original assertion failures → all 8 HTTP/MySQL cases pass. Parallel fixture
  ID collision separately reproduced and fixed only in guarded test setup.
  Full suite on reused and freshly provisioned MySQL: 533 pass / 2 skip;
  types/280-file boundaries/docs/API build/52-test verify pass. B08 stays open.

## Backend continuation: scheduled publication ownership — 2026-10-02

- [x] N06: Scheduled workers return only their own committed publications;
  concurrent workers do not duplicate announcement inputs, and an admin's
  withdrawal while a row is locked is not returned as a publication.
  Verify: real MySQL locks/concurrency/rollback/date and eligibility matrix,
  full suite/types/contract/boundaries/docs/API build. Push outbox/retries and
  manual confirmScheduledPost announcement ownership remain separate work.
  Two actual assertion failures on the original worker → all 4 MySQL scenarios
  pass, including two worker batches, next tick, withdrawal and trigger rollback.
  Full suite: 537 pass / 2 skip; types/280-file boundaries/docs/API build and
  52-test verify pass. No real push or schema change; release checkpoint stays open.

## Backend continuation: manual publication ownership — 2026-10-02

- [x] N07: admin.confirmPost announces only its own committed draft/scheduled
  transition, never an already-published retry or scheduler-owned publication.
  Preserve early confirmation/date rules and HTTP result. Verify real authenticated
  HTTP/MySQL repeats/concurrency/scheduler/rollback/role and missing-row cases,
  full suite/types/boundaries/docs/build. No push-outbox or updatePost guarantee.
  Four original assertion failures → all 10 real authenticated HTTP/MySQL cases
  pass. Legacy published/false visibility is still repairable; repeat HTTP result
  remains {success:true}. Full suite: 547 pass / 2 skip, types/281-file boundaries/
  docs/API build/52-test verify pass. Fixtures for global scheduler suites are
  mutually exclusive, while their actual concurrent workers remain real.

## Backend continuation: atomic post editing — 2026-10-02

- [x] N08: Post edits and replacement videos commit/rollback together; edit
  publication shares ownership with manual/scheduled paths and uses saved text.
  Verify real HTTP/MySQL partial failure/decoded filenames/optional vs empty video
  lists/non-video preservation/concurrency/date and missing-row regressions,
  full suite/types/contract/boundaries/docs/API build. createPost, uploadMedia,
  optimistic revisions, full request idempotency and push outbox remain separate.
  Nine genuine regression failures on the original route → 24 real HTTP/MySQL
  cases and 6 route unit cases pass. Full suite: 561 pass / 2 skip; types,
  283-file boundaries, docs, API build and 52-test verify pass.
- [ ] Investigate one transient parallel registration failure (both race
  requests returned 500); MySQL's error counters record deadlocks at the same
  time, but the precise cause is not established. Five subsequent full runs
  pass without changes to registration. Do not treat this as repaired or hide
  it with test retries. Reproduce with SQL diagnostics on a fresh test database.
  Investigation 2026-10-03: 11 full runs on a new disposable database and
  8 paired registration/retention runs pass. Statement history captures no
  registration deadlock; global error counters also rise during successful runs.
  Those counters alone do not establish the endpoint failure's cause. Still open.
  Recurred during N11 on 2026-10-05: both responses were 500. InnoDB's latest
  deadlock was an earlier content-test cleanup, not this registration attempt.
  A subsequent diagnostic full run with statement history enabled passed;
  do not call registration fixed or enable automatic test retries.

## Backend continuation: atomic post creation — 2026-10-03

- [x] N09: New post and initial videos commit or roll back together. Preserve
  numeric response, normalization/status/date rules and permissions; announce
  only after commit. Check real HTTP/MySQL failures/pending visibility and
  scheduler behaviour, then full suite/types/boundaries/docs/build/regressions.
  Legacy teasers, standalone uploads, HTTP idempotency and push outbox stay open.
  Four real regression failures on the old path → all 35 HTTP/MySQL content
  cases pass, including 11 new creation cases. Full suite: 572 pass / 2 skip;
  types, 284-file boundaries, docs, API build and 52-test verify pass.

## Backend continuation: safe MySQL backups — 2026-10-05

- [x] N10: Remove database credentials from process arguments/errors; finalize a
  private gzip only after successful dump exit and completed output. Failed jobs
  remove their own partial/config files and can retry on the next scheduled tick;
  concurrent callers share one in-process job. Regression tests reproduce four
  original failures and two scheduling failures; real MySQL 8.4 option parsing
  and dump/restore on a disposable fixture checked. Full suite 554 pass / 2 skip;
  types/lint/API build/contract/boundaries/docs/format pass. Production restore, S3 retry,
  timeout, crash-leftover cleanup and cross-process ownership remain outside N10.
- [x] N11: Server-side createPost request idempotency. Lost response/retry must
  return the original post ID, including concurrent identical requests; reject
  reuse of a key for another payload. Preserve legacy clients without a key.
  Four old-path HTTP assertion failures → 35 real HTTP/JWT/MySQL cases pass,
  including a duplicate observed waiting on the owner's actual transaction.
  Additive migration 0025 rehearsed only on disposable MySQL. Latest full suite:
  589 pass / 2 external skip; types/lint/build/72-procedure contract/397-file
  boundaries/41-document links pass. Earlier full run failed the existing
  registration race, still open above. No production migrations or external push.
- [ ] Wire stable createPost intent keys into the frontend editor and its
  uncertain-response/retry flow, with browser verification. Backend optional
  support alone does not protect today's unkeyed frontend calls.
- [ ] N12: Transactional publication push outbox; worker crash/retry cannot lose
  an announcement. Provider delivery/deduplication limits must remain explicit.

## NestJS migration — 2026-10-05

- [x] M01: Review/pin Nest dependencies; keep pnpm/Vitest/esbuild/Drizzle.
  Acceptance: scripts disabled, one lockfile, baseline suite/types/build preserved.
  Verify: pnpm test with disposable MySQL; pnpm check; pnpm build; native audit.
  Files: apps/backend/package.json, pnpm-lock.yaml, tsconfig.json, ADR-005.
  Dependencies: none; scope: medium.
  Verified: Nest 12.1.2 family, reflect-metadata 0.2.2, RxJS 7.8.2; frozen
  ignore-scripts install. Baseline and post-dependency runs: 589 pass / 2 skip.
  Types/build/lint/API/docs pass; audit unchanged at 33 high/36 moderate/4 low.
- [x] M02: Nest HTTP runtime with native health/capability controllers.
  Acceptance: one HTTP application, unchanged security/parsers/tRPC contracts;
  runtime creation performs no worker/external side effects, close releases port.
  Verify: tests/nest-application.test.ts; pnpm check; pnpm build; full suite.
  Files: runtime factory, app module, system controller, launch module, HTTP tests.
  Dependencies: M01; scope: medium. Executable switch is a separately verified step.
  Real factory starts no jobs/listener; 20 real HTTP checks cover parser/auth/CORS/
  HMAC/logout/tRPC/disabled features/close. Executable switched in M02b below.
- [x] M02b: Use Nest runtime from the existing production/dev executable.
  Acceptance: same host/port/timeouts and routes; actual built artifact starts.
  Verify: built-process loopback smoke; full suite/types/build/contract checks.
  Files: _core/index.ts, backend README, root README, architecture API docs.
  Dependencies: M02; scope: medium.
  Verified: the compiled Node entrypoint includes the Nest modules, serves real
  health/capabilities HTTP, and rejects an occupied production port (3 tests).
  Full MySQL suite: 612 pass / 2 external skip; types/build/lint/API/boundaries/
  documentation pass. A shared-fixture latest-post assertion failed once;
  deterministic owned ordering dates fixed it, without changing production code.
  Workers still use existing intervals; Nest shutdown lifecycle is deferred to M07.
- [x] M03: Native launch settings controller/service, preserving JWT/Drizzle.
  Acceptance: HTTP shapes/statuses, role checks, optimistic revision and audit
  transaction preserved; only one production registration for each endpoint.
  Verify: real Nest HTTP/JWT/MySQL roundtrip/conflict/blocked-user tests.
  Files: launch controller/service/module, runtime factory, existing settings tests.
  Dependencies: M02b; scope: medium.
  Verified: launch routes now belong only to LaunchController/LaunchService;
  unused Express launch adapter removed. Real Nest/JWT/MySQL suite preserves
  save/read/public response shapes, 401/403/415, safe 400, stale-edit 409, audit
  transaction and role/block changes with an existing token. Full suite: 620
  pass / 2 external skip; types/build/lint/72-procedure API/402-file boundaries/
  42-document checks pass. Built Node process also exercises safe settings failure.
- [x] Checkpoint: Nest foundation + launch verified; record actual migration gaps,
  dependency advisories and earlier registration failure before continuing.
  Only foundation + launch are native so far. Identity/password/payment/media
  adapters, tRPC service composition, worker intervals and Drizzle pool ownership
  are transitional. Native audit and release gates remain open; registration
  race was not reproduced in these runs and is NOT declared fixed. No frontend
  code, SQL schema, deployment configuration, production data or remote push changed.
- [ ] M04: Specify and migrate identity adapters/guards; retain sessions/password
  invariants and investigate the existing intermittent registration race.
- [ ] M05: Specify and migrate content service wiring; preserve N07–N11 regressions.
- [ ] M06: Specify and migrate billing service wiring; sandbox/provider acceptance
  remains separate from local tests, no TypeORM/data-model rewrite.
- [ ] M07: Specify and migrate worker lifecycle; implement N12 as its own feature.
- [ ] M08: Specify/migrate remaining API services, remove superseded adapters and
  decompose db.ts without changing contracts. Review every module separately.
- [ ] Final checkpoint: whole Nest runtime/MySQL/frontend flow, release rehearsal,
  audit triage/migration history/provider/SMTP/private-file gates and approved rollout.
