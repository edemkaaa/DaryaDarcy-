# Implementation Plan: Daryadarcy Modular Monorepo

## Goal

Reorganize the current Expo + Express/tRPC repository into a pnpm monorepo that is easy to navigate and safe to develop in. Frontend, backend, database/shared code, deployment assets, and repository tooling receive explicit owners and folders. Runtime behavior, URLs, tRPC procedure names, database schema, and deployment behavior remain unchanged during the move.

## Current Baseline

- `pnpm check`: passes.
- `pnpm build`: passes.
- `pnpm test`: 174 pass, 10 fail, 1 skipped.
  - Eight failures are stale source-text assertions in `__tests__/screens.test.ts`.
  - Two failures are live S3 checks running without S3 credentials.
- The production frontend is Expo Router; `site/` is a separate excluded Vite client with unclear ownership.
- Backend routing and persistence are concentrated in `server/routers.ts`, `server/db.ts`, and `server/platform-db.ts`.

## Target Shape

```text
apps/
  frontend/                 # Expo Router client: web, iOS, Android
  backend/                  # Express/tRPC deployable service
  legacy-web/               # current Vite client, isolated until retired
packages/
  shared/                   # platform-neutral contracts and helpers
  database/                 # Drizzle schema, migrations, connection/repositories
infrastructure/
  deploy/                   # PM2, nginx and server provisioning assets
tooling/
  scripts/                  # repository maintenance/import/deploy helpers
docs/
  decisions/                # architecture decision records
tasks/                      # implementation plan and progress
```

The repository remains a **modular monolith**, not a microservice system. Workspaces provide code ownership and dependency boundaries; the backend still deploys as one service and the frontend stays one universal Expo application.

## Dependency Rules

1. `apps/frontend` may import `packages/shared`, never backend/database runtime.
   Explicit existing tRPC exception: only named type-only AppRouter import from
   backend/routers in either client. Expo app.config.ts alone may load the one
   build-only tooling/scripts/load-env.js helper; application runtime may not.
2. `apps/backend` may import `packages/shared` and `packages/database`.
3. `packages/database` may import `packages/shared`, but never an app.
4. `packages/shared` is platform-neutral and imports no app or database code.
5. `infrastructure` may reference build artifacts and package commands, but application code never imports infrastructure.
6. Existing tRPC namespaces and procedure shapes remain the public compatibility boundary.

## Delivery Slices

### Phase 0 — Reliable safety net

- [x] Make live S3 tests opt-in when credentials are available.
- [x] Remove stale source-text checks that no longer represent product behavior.
- [x] Add architecture/API characterization where a move could break a public contract.
- [x] Acceptance: local tests, type check, and backend build are green without production credentials.

### Phase 1 — Workspace and operational boundaries

- [x] Add the pnpm workspace definition and root orchestration commands.
- [x] Record the architecture decision and migration/rollback rules.
- [x] Move `site/` to `apps/legacy-web` and keep its build working.
- [x] Move `deploy/` to `infrastructure/deploy` and update all references.
- [x] Move repository-only helpers to `tooling/scripts`.
- [x] Acceptance: root commands still work and no old path is required.

### Phase 2 — Backend and database ownership

- [x] Move the service into `apps/backend` without changing HTTP/tRPC behavior.
- [x] Move Drizzle schema/migrations and database ownership into `packages/database`.
- [ ] Split backend code by business domain behind composition facades.
- [ ] Acceptance: backend builds from its workspace and public router contract is unchanged.

### Phase 3 — Frontend ownership

- [x] Move the Expo app, components, hooks, assets and client utilities into `apps/frontend`.
- [x] Give the frontend its own manifest/config while keeping root convenience commands.
- [x] Replace cross-layer imports with `packages/shared` contracts or explicit facades.
- [x] Acceptance: Expo web build, type check, and app route inventory pass.

### Phase 4 — Simplification and enforcement

- [ ] Remove temporary compatibility facades only after all callers migrate.
- [ ] Add automated dependency-boundary checks.
- [ ] Split the largest backend and UI monoliths into domain modules/components.
- [ ] Standardize CI on pnpm and remove the redundant npm lockfile in a dedicated change.
- [ ] Acceptance: tests/check/build pass from the root and each workspace has clear ownership.

## Per-Slice Workflow

1. Add or update a test that describes the boundary being preserved and observe the expected failure when applicable.
2. Make one mechanical/structural change.
3. Run the focused verification, then the relevant root checkpoint.
4. Review the diff for API drift, authorization drift, secrets, circular dependencies, and stale paths.
5. Commit the slice independently before starting the next one.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Expo/Metro path resolution breaks after moving the app | Move config with the app and verify the web bundle before removing old paths |
| Backend aliases resolve in TypeScript but not at runtime | Verify both `tsx` startup/build and the bundled server artifact |
| tRPC contract changes during router extraction | Runtime characterization of namespaces/procedures and compatibility composition |
| Database imports form cycles | Enforce app → database → shared dependency direction |
| Deployment scripts silently retain old paths | Search repository-wide and run script syntax/config checks after the move |
| Legacy Vite app is mistaken for production | Isolate it as `apps/legacy-web` and document it as frozen pending product decision |
| Structural changes mix with security/payment fixes | Keep behavior changes in separate follow-up commits |

## Explicit Non-Goals

- No microservices.
- No framework rewrite.
- No payment/auth behavior changes in structural commits.
- No visual redesign.
- No deletion of the legacy web client until its ownership is confirmed.

## Backend launch follow-up — 2026-10-02

The user has now requested a backend audit and implementation. The structural
non-goals above still apply to structural commits; security repairs get separate
behavior-changing commits. The existing unfinished refactor tasks are retained.

Recommendation: keep Express/tRPC, TypeScript, Drizzle/MySQL and the frontend
contract. Replace unsafe business flows incrementally, not the entire service.
See `docs/decisions/0002-backend-evolution.md` and
`docs/audits/backend-2026-10-02.md` for evidence and remaining release blockers.

### Immediate repair scope

1. Browser return is navigation only; webhook authentication precedes all mutations.
   Explicit non-success and missing payment statuses cannot grant access. Demo
   signatures do not grant production access. Verify with `pnpm test tests/billing-webhook.test.ts`.
2. Preserve `club.claimPending` as a read-only compatibility check; never activate
   a pending checkout. Checkout email is not proof of identity and never issues a
   session. Blocked account cannot create checkout. Verify with
   `pnpm test tests/billing-checkout.test.ts`.
3. Centralize access policy: blocked staff have no privileges; blocked users and
   unpublished posts cannot bypass restrictions through public detail endpoints.
   Verify with `pnpm test tests/access-policy.test.ts`.
4. Checkpoint: `pnpm test`, `pnpm check`, `pnpm build`, review diff and API contracts.

### Subsequent vertical slices (not claimed implemented)

- Billing transaction: isolated pooled DB connection; lock user/payment, stable
  provider payment key, amount/currency/domain/subscription validation, duplicate
  and concurrent replay tests against disposable MySQL. No in-memory deduplication.
- Identity: email ownership verification, setup/reset token hashing + expiry +
  single use, existing password preserved. Stop privilege inference from unverified
  email. Requires migration design before adding tables.
- Email: durable outbox committed with payment; retry, unique event and manager
  resend. Do not email plaintext passwords; use a one-time setup link.
- Subscription: provider-confirmed cancellation/retry; paid expiry preserved;
  durable provider identity for renewals; admin block revokes sessions/access.
- Content: public teaser/protected body, safe photos with EXIF removal and MIME
  verification, draft attachments, one-year comment retention, seasonal config.
- Launch switches: SMS and shop online payment off for web launch; manager orders.
  Pen pals and web push kept out of first release unless explicitly selected.
- Release: sandbox provider end-to-end, migrations backup/rollback, mail failure
  cases, security headers/CORS, load test, deployment smoke test. No production
  deployment or migrations during this local audit.

Modules: `identity` → `billing` → `email-delivery`; `identity` → `content-access`
→ `content-media`; `admin-operations` consumes these modules, never vice versa.
Module boundaries and full launch scope remain a proposal for review, not approval
of a framework rewrite or optional paid-video integration.

### Approved next implementation scope

User approved B04/B05/B06/B07 on 2026-10-02. Additive schema migrations are prepared
and rehearsed on disposable local MySQL only. No deployment, production migration,
external emails or live subscription changes are authorized by this local work.

- Isolated pooled connections; atomic receipts + entitlement under a user lock.
  A stable provider payment ID is required; same ID/different business payload is
  rejected. Price snapshot stored at checkout. Unknown renewal profile denied.
- Provider profile captured from a verified initial monthly payment; renewal uses
  that binding, not a client user ID or an email-only guess.
- Single-use hashed password tokens; optional encrypted token payload in outbox
  to survive delivery failure; expiry, supersession and atomic consumption. Token
  links never returned by public HTTP or logged. Reset invalidates older sessions.
- Payment and access-email event commit together. Worker uses bounded leases,
  backoff, retry and unique message IDs. SMTP is at-least-once, not exactly-once.
- Cancellation persists request before provider call; only provider-confirmed
  success marks it cancelled; worker retries uncertain failures and preserves
  paid expiry. Blocked users cannot log in or access protected media/API.

Acceptance tests: real MySQL concurrent duplicates/different payments, rollback
on queue failure, token replay/expiry, worker leases/retry, provider rejection and
timeout. Public HTTP tests use local server and mocked SMTP/provider only.

## Repository navigation cleanup — 2026-10-02

User requested a readable repository, including Markdown and miscellaneous files.
This extends the existing structural cleanup; unfinished backend/release work above
is preserved, not replaced or marked complete.

1. Group current docs by architecture/development/operations/audits/compliance;
   move handover snapshots, design experiments and the old product checklist to
   an explicitly historical archive. Keep content, license files and open tasks.
   Acceptance: only the entry README remains as root Markdown, all moved files
   are accounted for, relative links and source references follow the new paths.
2. Replace the template backend guide with a short accurate guide; add a docs
   entry point and current workflow, distinguish current instructions from archive.
   Acceptance: onboarding finds commands, module owners, active tasks and release
   blockers without reading historical chat-like reports.
3. Separate one-off legacy tools from normal commands without changing directory
   depth/root resolution. Do not execute deployment/migration/remote tools.
   Acceptance: every package/CI entry point resolves, legacy tools are indexed
   and marked unreviewed, no runtime asset or secret is deleted/moved into Git.
4. Add a small local-link check and CI gate; verify fixture failures first.
   Acceptance: missing local links in maintained docs fail, external links are
   not fetched; local tests/types/boundaries/API/web and legacy builds pass.

No release, push, production mutation, dependency upgrade or runtime behavior
change belongs to this cleanup. No old ADR or unfinished plan is discarded.

Cleanup verified locally: root README + docs navigation, all 1070 pre-existing
tracked files accounted for, 253 relocations, no runtime asset/licence changes.
Tools remain at the same depth; pnpm command names are preserved. Added a local
Markdown-target checker with failing fixtures before implementation and a CI gate.
The QR developer tool now writes its generated PNG to ignored tmp/, not the root;
historical npm lock/QR and the old server/audit templates remain recoverable.
469 tests passed / 2 skipped on disposable MySQL; types/boundaries, all three
builds (API/legacy/Expo), 52-test verify and frozen install passed locally.
Deployment scripts retain legacy environment assumptions and require separate
review. Migration history, production/sandbox/mail/device/private-media release
blockers above remain open; no remote CI, deploy, payment, email or S3 operation.

## Repository hygiene follow-up — 2026-10-02

User approved the follow-up inspection findings. Work stays on staging; no push,
default-branch change or deployment is included. Preserve unfinished release tasks.

1. Repair the previously broken web-public path: move manifest/privacy into the
   frontend and fail packaging when either required resource is missing. This is
   an explicit build repair, separate from behavior-preserving file organization.
   Verify: isolated packaging tests fail first, then pass; both web builds retain
   exact public-resource bytes and the existing mobile icon.
2. Archive historical deployment screenshots/backup reports without losing bytes.
   Keep lifecycle policy active; ignore generated reports, distinguish snapshots
   from operational configuration. Do not execute or modernize remote S3 tools.
3. Remove the empty root placeholder and update Cursor paths/pnpm instructions.
   Verify documentation links, boundaries, types, local suite and build checks;
   record skipped database coverage and unresolved release blockers accurately.

Follow-up verified locally: three packaging regressions first failed as expected,
then passed; both web exports contain unchanged manifest/privacy/mobile icon.
Six files relocated without content loss; only the empty root .gitkeep removed.
Historical artifacts separated from active policy and ignored generated reports.
Cursor guidance uses monorepo paths/pnpm and explicit release authorization.
409 tests passed / 65 skipped without MySQL; types/boundaries/docs/API/Vite/Expo
and 52-test verify passed. Default remote branch is still dev; staging remains
the current-work branch. No push, remote operation or release gate was performed.
Legacy Vite font warning and S3/SSH path mismatch remain documented follow-ups.

## Current-team ownership cleanup — 2026-10-02

User explicitly requested deletion of unnecessary editor/generator/one-off files,
not another archive relocation. Deployment is excluded from this deletion scope.

- Remove Cursor rules, Expo reset/template, old audit generator/command, archived
  npm lock/QR, spent visual-generation notes and unreferenced legacy diagnostics.
- Preserve application code, tests, SQL history, open tasks, requirements, ADRs,
  audit evidence, CI, licences and all deployment/SSH/backup/migration helpers.
- Check remaining references before deletion; update navigation rather than leave
  dead links. Deleted tracked files remain recoverable from the preceding commit.
- Verify protected-file hashes, package commands, docs links, boundaries, types,
  tests and local builds. No push, deployment or external operation is included.

Ownership cleanup verified: 37 tracked files removed, stale command/navigation
cleaned, local Cursor settings ignored. No new editor/agent rules introduced.
815 protected runtime/deploy/CI/lock files are byte-identical; package entry points
resolve. Frozen install, docs/boundaries/types/API/Vite/Expo and verify passed;
409 tests passed / 65 skipped without MySQL. Deleted files remain in Git history
at 9c39659. Current requirements, audit evidence and unfinished tasks are intact.

## Backend continuation: notification access — 2026-10-02

User chose to continue the existing backend plan. Extend B07's immediate block
enforcement to native notification audiences, without adding Web Push or changing
login/registration flows. Existing open billing/media/release work stays open.

- Reproduce blocked recipients and consent events with equal-second timestamps
  using real disposable MySQL. Assert recipients, not query/source text.
- Exclude blocked, missing-user, disabled and anonymous tokens from delivery
  audiences; preserve subscription and marketing-consent gates. Use event ID as
  the tie-breaker so the last recorded consent wins within the same second.
- Verify focused regressions, complete disposable-MySQL suite, API contract,
  boundaries, types and API build; document remaining native-device acceptance.
  Do not send real push/email, modify production, deploy or push this new work.

N01 verified on disposable MySQL: 14 expected failures before repair, all 15
focused regressions now pass; full suite 487 pass / 2 skip. Recipient queries
join users and check the current block status; consent ties use descending ID.
SQL joins use the existing primary key, no schema/role/API/dependency change.
Types/boundaries/docs/API build and 52-test verify pass. Remaining release gates
and native-device acceptance stay open; messages already handed off are not recalled.

Next thin slice N02: repair the existing push sender's false success count. A
network/HTTP failure or per-message error must not count as accepted. Validate
the external Expo ticket response and preserve the 100-message batch limit and
audience filtering. No retry queue, receipt polling, token cleanup, new service
or Web Push implementation belongs to this slice. Test only mocked transport;
provider acceptance is not device delivery. Reference: Expo sending documentation.

N02 verified: the old sender failed 13 of 17 transport regressions; all 17 now
pass. Only valid successful Expo tickets count as accepted, with partial rejection,
invalid JSON, HTTP/network errors and later batches covered. Logs do not include
provider response bodies or recipient tokens. Full disposable-MySQL suite:
504 pass / 2 skip; types/boundaries/docs/API build and 52-test verify pass.
No external sends, retry queue, receipt polling, token cleanup or deployment.

## Backend continuation: account retention — 2026-10-02

N03 extends existing B08 maintenance, not a new deletion/authentication flow.
The current worker performs profile/comment/activity scrubbing as independent
commits before anonymizing users; late failure can erase part of a live account.
It also reads subscription eligibility before taking the billing owner lock.

- Reproduce a late cleanup failure, concurrent workers and a renewal committed
  while maintenance waits, using only guarded disposable MySQL fixtures.
- Lock/re-read each candidate in a per-account transaction, check the latest
  paid expiry there and keep every existing scrub operation in that transaction.
  Preserve the current 30-day eligibility rule, anonymized labels and public API.
- Verify success/rollback/isolation and existing active/grace-period exclusions,
  then run the full suite/types/boundaries/docs/API build before a local commit.
  No production maintenance, financial-data purge, S3 deletion, new retention
  policy, auth flow or deployment. Audit/backup/legal retention remains open.

N03 focused verification: 3 expected assertion failures on the original worker,
then all 8 real-MySQL scenarios pass with rollback, renewal and concurrent worker
checks. Helpers accept the same transaction executor; exported signatures stay
unchanged. Test push fixture is disabled and removed at teardown so parallel
audience tests do not see unrelated tokens. Full suite: 512 pass / 2 skip;
types/boundaries/API build and 52-test verify pass. No live data was deleted.

N04 continues B04/B07: manual admin grants use a read/compute/write sequence
outside the billing owner lock and timestamp-derived order IDs. Reproduce lost
days/colliding grants on disposable MySQL, then serialize grants on the same
owner as settlement/retention. Preserve admin.grantClub input/output and default
31 days; validate the internal duration, refuse blocked/anonymized recipients,
and assign each distinct grant its own unique order. Verify concurrency, expiry
stacking, recipient exclusions and the full suite before the next local commit.
This does not add role permissions or an auth flow, send mail, cancel providers
or make retries of one admin request idempotent; request-id support is separate.

N04 verified: 6 of 12 focused cases failed on the original helper, all 12 pass
after repair. Calculation/write now lives in billing/grants.ts, not additional
branches in the oversized db.ts; the existing facade and router contract remain.
Full disposable-MySQL suite: 524 pass / 2 skip, 280-file boundaries, types/docs/API
build and 52-test verify pass. Public grant retries and legacy paid-write helpers
are not claimed repaired; neither is the overall billing/release checkpoint.

## Backend continuation: video publication boundaries — 2026-10-02

N05 extends B08's published-content gate to the existing public video paths.
Hypothesis: videos.getById returns an unpublished row, and /api/yt/:id resolves
arbitrary/hidden YouTube IDs without checking the catalog. Trust boundary:
anonymous HTTP ID → database publication flag → external downloader/stream;
assets are unpublished metadata/URLs and API host resources.

- Reproduce both paths using real local HTTP and disposable MySQL. Replace only
  external child-process/media transport; denied IDs must cause neither call.
- Require published=true for public details and for YouTube streaming before
  resolution, including cache hits. Keep published public videos playable and
  internal YouTube dedup able to see hidden entries. No auth/role changes.
- Verify direct/list/stream/revocation/Range paths, then the full suite, API
  contract, types, boundaries, docs and API build before a local commit.
  No actual video downloads, S3 writes, provider changes, Web Push, production
  cleanup or deploy. Existing public S3 links are not revoked by this API fix.

N05 verified: four actual boundary failures before repair, then all 8 real HTTP/
MySQL scenarios pass. A separate failing ID-allocation regression established a
parallel test cleanup collision; guarded fixtures now keep auto IDs >=1000000.
Full suite on reused and new disposable MySQL: 533 pass / 2 skip; types, 280-file
boundaries, docs, API build and 52-test verify pass. No provider/media download,
production schema change or release approval.

## Backend continuation: scheduled publication ownership — 2026-10-02

N06 extends the publication-before-announcement boundary. Hypothesis: independent
SELECT/UPDATE let two workers return the same publication, or return a draft
withdrawn while the worker waits. Assets: unpublished text and announcement
audiences. Boundary: scheduled row → committed publication → notification input.

- Reproduce with real MySQL row locks, two workers and a concurrent withdrawal;
  verify rollback and due/future/null/published status exclusions.
- Claim and publish the same selected rows transactionally; skip temporarily
  locked rows until the next tick. Preserve existing text/target/date contracts.
- Verify each returned ID corresponds to this worker's committed transition,
  then full suite/types/boundaries/docs/API build before a local commit.
  No actual push, schema migration, manual admin-confirm rewrite or deploy.
  Crash-safe notification delivery/outbox remains separate; not exactly-once push.

N06 verified: two assertion failures reproduced duplicate returned IDs and a
withdrawn draft in announcement input. All 4 real-MySQL scenarios now pass.
FOR UPDATE SKIP LOCKED claims current due rows; only those IDs are updated in
the same transaction and returned after commit. Dates/target/status exclusions
are preserved. Full suite: 537 pass / 2 skip, types/280-file boundaries/docs/API
build/52-test verify pass. Batch size/index/load profiling and a durable push
outbox remain open; admin manual-confirm semantics were not changed.

## Backend continuation: manual publication ownership — 2026-10-02

N07 extends N06 to admin.confirmPost. Hypothesis: the unconditional write and
subsequent read announce an already-published post on every retry; manual and
scheduled workers may both announce the same transition. Boundary: authenticated
admin intent → committed post transition → marketing notification input.

- Reproduce via real authenticated local HTTP/MySQL; fake only external push.
- Return the committed announcement snapshot only to the writer that transitions
  draft/scheduled to published under the post lock. Keep early manual confirmation,
  current publication-date semantics and HTTP {success:true}, including no-ops.
- Check repeat/concurrent/manual-scheduler requests, rollback, missing rows and
  unchanged anonymous/member/blocked-staff restrictions. No auth/role changes.
- Run the complete local suite/types/boundaries/docs/build before committing.
  No actual push, production DB, migration, provider changes or deployment.
  Draft→published via updatePost and crash-safe push outbox remain separate work.

N07 verified: four expected assertion failures before repair; all 10 real JWT/
HTTP/MySQL cases pass after. content/publication.ts owns the row-lock transaction,
returning only the successful writer's id/text/target snapshot after commit.
db.confirmScheduledPost's internal return type is now PostPublication|undefined;
the only production consumer was updated, with unchanged tRPC input/output.
Early confirmation, backdated publication and repair of legacy hidden flags are
preserved. Global scheduler suites share test-only fixture ownership, not fake
worker locks. Full suite: 547 pass / 2 skip; types/281-file boundaries/docs/API
build/52-test verify pass. updatePost concurrency and durable push remain open.

## Backend continuation: atomic post editing — 2026-10-02

N08 covers admin.updatePost's separate post/video writes and stale announcement
pre-read. Boundary: authenticated edit → persisted post/media visibility → push
input. Reproduce partial saves, lost old videos and duplicate transitions with
real HTTP/MySQL, faking only external push. Save the post and optional replacement
videos under the same post lock/transaction used by confirmation and scheduling.

- Keep normalization, partial-update semantics, dates, HTTP {success:true} and
  non-video attachments. videos omitted keeps them, [] explicitly clears videos.
- Announce only this transaction's new explicit publication, using saved text
  and target; repeated corrections are not new publications. Rollback all writes
  on a failed media insert/filename decode. Missing IDs cannot create orphan media.
- Verify persistence/rollback/concurrent edits/confirmation/scheduler and existing
  role restrictions, then full suite/types/contract/boundaries/docs/API build.
  No new auth/upload policy, production DB/migration, S3 or actual notification.
  createPost, standalone uploadMedia writes, edit revision conflicts, request
  idempotency keys and durable push outbox remain separate work.

N08 verified: nine genuine assertion/request failures on the original route,
then all 24 real authenticated HTTP/MySQL cases and 6 route unit cases pass.
post-editor.ts owns locking/atomic post-and-video edits, and post-videos.ts
shares the existing video writer without a new URL/MIME policy. Media-only
edits avoid empty SQL SET; explicit null/backdated dates, decoded filenames,
documents and HTTP {success:true} stay compatible. Parallel edits retain one
complete matching post/video revision, not mixed attachments. Announcements
use normalized saved text (including empty text) and follow commit.

Full suite: 561 pass / 2 skip; types, 283-file boundaries, docs, API build and
52-test verify pass. One earlier full run had two 500 responses in the concurrent
registration test; MySQL deadlock counters have matching timestamps, but no
precise cause is established. Five later full runs pass without registration
changes. Keep that investigation open, without retries or an asserted fix.
No production/provider/deploy changes. Last whole transaction wins; optimistic
revision checking, request idempotency and crash-safe push remain open.

## Backend continuation: atomic post creation — 2026-10-03

N09: admin.createPost must commit the new post and its initial videos together.
Boundary: authenticated creation → visible persisted post/media → notification.
Keep existing normalization/status/date/tag rules and numeric post ID response.
Reuse the canonical video writer inside one transaction, without changing the
legacy single-row creator used for article teasers or the standalone upload API.
Reproduce second-media insert and filename decoding failures before the fix;
verify no partial post/media or announcement. Observe a pending real MySQL
transaction to check that readers/scheduler cannot see an unfinished creation.
Check published/draft/scheduled cases and unchanged access rules; then full suite,
types, boundaries, docs, API build and regression checks. No external push, schema
change in production, deployment, revision policy or HTTP idempotency promise.

N09 verified: four genuine old-path failures for post/media rollback and pending
published/scheduled visibility. All 35 real HTTP/MySQL cases (11 new creation
cases) pass after the fix. Pending insertion is observed through a real test-only
MySQL lock, not a repository mock or arbitrary sleep. The scheduler skips an
unfinished scheduled create and publishes it only on the next post-commit tick.
Published creation announces once after commit; draft and scheduled creates do
not. Numeric response, dates, normalized text, video names/order and permissions
remain compatible. Production uses post-creator.ts and the canonical video writer;
legacy teaser creation is intentionally unchanged. Full suite: 572 pass / 2 skip;
types/284-file boundaries/docs/API build/52-test verify pass. No production writes,
notifications, migrations or deployment. Failed inserts can leave ID gaps; no
request idempotency or crash-safe notification guarantee is claimed.

Registration investigation remains open: before N09, 11 full runs on a new
disposable database and 8 registration/retention pair runs passed without a
registration change. MySQL statement history captures no actual registration
deadlock, while global deadlock counters also rise during successful runs.
The earlier timing correlation is not sufficient to identify the root cause.

## Backend continuation: safe MySQL backups — 2026-10-05

N10: Credentials belong in a temporary owner-only MySQL option file, never argv
or raw logged errors. Keep real processes/streams/filesystem in regression tests;
replace only the database executable for deterministic failures. Four original
assertion failures prove password exposure, sensitive stderr, leftover partial
files and success before the dump exits. Two further failures prove a failed job
suppresses the next day's attempts and explicit parallel calls duplicate work.

Finalize the private gzip by rename only after successful process close and
stream completion; use Node's gzip stream to remove a second process lifecycle.
Remove exact owned temporary files, sanitize configuration/dump errors, mark
the interval only after successful local output and share the in-process job.
Check the real MySQL option parser and dump/restore of an isolated fixture, then
full disposable-MySQL tests, types, lint, boundaries, contract, docs and API build.
No working database, external storage, deployment or dependency upgrade.

Next thin slices: N11 adds request-key idempotency for createPost, N12 adds a
transactional publication push outbox. Neither is implemented by N10. Existing
release gates remain: dependencies, migration history, provider sandbox, SMTP,
private legacy files and approved rollout. Backup timeouts, abandoned-file
reconciliation, S3 upload retry and cross-process coordination remain separate.

## N11 contract and verification — 2026-10-05

Add optional ASCII idempotencyKey (16–128 characters) to admin.createPost;
keep its numeric response and legacy unkeyed semantics. Scope the durable key
to the authenticated actor and operation, never a client-supplied user ID.
Hash the validated request, excluding the key and generated server timestamps;
object-property ordering must not change the hash. Same key/different payload
returns CONFLICT before another post or announcement. Authorization still runs
on every replay; deleted/edited posts are not resurrected or reverted.

An additive 0025 table claims the key by a unique atomic upsert and commits its
post ID with post/media in one transaction. Concurrent duplicates wait for the
row lock under MySQL's configured timeout; rollback allows a safe new attempt.
No key expiry: late retries remain protected; review retention before deployment.
Only the creator announces after commit. This is not crash-safe push delivery.
First reproduce sequential/concurrent repeats, lost HTTP response and conflicting
payload against the old route. Then verify real HTTP/JWT/MySQL, rollback/media,
actor isolation, key validation, tombstones and unchanged legacy calls; full tests,
types, contract generation, boundaries/docs/build/lint. Rehearse 0025 only on
disposable MySQL. Preserve unresolved 0017–0019 history and do not apply production
migrations. Frontend request-key wiring and publication push outbox stay separate.

N11 verified: four genuine old-route failures (sequential/concurrent repeats,
conflicting payload and lost response); 35 HTTP/JWT/MySQL scenarios pass after.
Twelve simultaneous calls return one ID. A trigger-held transaction proves the
second call waits on the unique request row, and neither post nor key is visible
before commit. Key/payload/media rollback, default/object-order consistency,
array-order conflicts, actor/access isolation and edited/deleted tombstones pass.
Only the first committed creator announces. No frontend retry promise or outbox.

The new cleanup's joined DELETE deadlock with another suite was established by
InnoDB's transaction trace; changed only fixture cleanup to resolve owned IDs
first, matching the existing indexed cleanup pattern. Paired content suites:
77 pass before the two additional array/JSON cases. A full run then reproduced
the existing registration race (500/500), without a new corresponding InnoDB
deadlock; that investigation remains open. Two subsequent diagnostic full runs:
each 589 pass / 2 external skip. Types, lint, API build/contract, boundaries/docs pass.
Native audit remains 0 critical / 33 high / 36 moderate / 4 low. Read-only migration
preflight rejects only the existing untracked 0017–0019 files; no release approval.

## NestJS migration — 2026-10-05 (user-authorized continuation)

M04 is split into transport slices after the verified foundation checkpoint:
M04a password request/completion/setup page and staff resend; M04b sessions,
email registration/login and disabled SMS endpoints; M04c common injectable
session/role policy and diagnosis of the intermittent registration race.
M04a preserves one-use encrypted mail links, session-version invalidation,
account-enumeration-safe 202 responses, quotas, staff audit and nonce CSP.
Move database actions into an injected PasswordService, not a new ORM. Run
existing setup/URL/JWT/MySQL checks through the production Nest factory; external
provider fixtures use a separate loopback mock server. Keep response/error
statuses and no-store headers, including explicit HTTP 200 for Nest POST routes.
Do not claim all identity migration complete after password transport alone.

M04c1: Export SessionService from IdentityModule as the injectable HTTP session
and role policy. Its required/optional authentication must delegate to the real
SDK on every request (database role, block and sessionVersion, Bearer/cookie
precedence); do not cache actors or accept an identity from request JSON. Share
the existing administrator/staff predicates with session/TOTP and native launch/
password transport. Keep tRPC policy/context unchanged until its service wiring
slice. Verify the exported provider with real JWT/MySQL, plus legacy HTTP denials.

M04c2: Native guards protect launch settings and staff access-email resend.
Preserve their different plain-text/JSON auth failures, no-store headers and
content-type-before-auth ordering. Resend retains its stricter PUBLIC_APP_URL
origin check, actor quota and domain transaction/audit checks. Guard exceptions
need a narrow filter: Nest executes guards before controller @Header metadata.
Do not install a global guard or change public registration/SMS/tRPC routes.
Run real HTTP/JWT/MySQL denied-role, revoked-session and untrusted-body cases,
then full tests/types/contracts/build. Registration-race diagnosis is a separate
M04c3 step; passing identity refactor tests does not establish a race repair.

Separate identity repair N13: the inherited password-login flow updated a
blocked user's lastSignedIn before session issuance threw, producing a misleading
HTTP 500. Reproduce through native HTTP/MySQL with a real correct password and a
known old sign-in date. Reject blocked credentials inside passwordUser before any
sign-in update or token mint; public 401 matches other invalid credentials.
Retain the final issuance block check, existing quotas and staff TOTP. Verify
the rejection has no cookie, no JWT and no lastSignedIn write, then the full suite.

The user explicitly requests a plan and its execution, not another approval-only
proposal. Extend this backend plan; preserve all open N12/release/registration
tasks. Work locally on fix/backend-hardening. No push, deployment, working-data
migration, provider request or permission-policy change is authorized.

Assumptions: keep Next.js and all 72 tRPC procedures, existing HTTP paths/statuses,
JWT/cookies, MySQL/Drizzle and approved security policies. NestJS owns composition
and lifecycle; native controllers/services replace HTTP adapters gradually.
Existing tRPC adapters bridge verified domains until their service wiring moves.
Do not replace tRPC with REST or Drizzle with TypeORM in the same migration.

### Capability map and build order

| Module id | Responsibility | Depends on |
| --- | --- | --- |
| http-runtime | Nest bootstrap, security/parsers, HTTP lifecycle | — |
| launch | Health/capabilities, seasonal settings | http-runtime, existing database/identity |
| identity | Registration, session, passwords and authorization | http-runtime, database |
| content | Post/media/edit/publication behaviour | identity, database |
| billing | Checkout, receipts, cancellation | identity, database |
| workers | Existing background jobs and later durable publication delivery | content, billing |
| remaining-api | Profile, club, moderation, pen pals, disabled shop | identity, content |

Build order: dependency/tooling proof → http-runtime → launch → identity → content
→ billing → workers → remaining-api → release rehearsal. Module specs/acceptance
are added before each module, not one speculative rewrite specification.

### First increments

M01: Add reviewed, exact-version Nest core/common/Express adapter, reflect-metadata
and RxJS using the authoritative pnpm lockfile with install scripts disabled.
Use Node 22 and existing Vitest/esbuild. Explicit constructor injection avoids
relying on decorator metadata that esbuild does not emit. Verify current full
disposable-MySQL suite, typecheck and build before introducing the runtime.

M02: Nest owns the real HTTP application; preserve security-before-body parsing,
raw provider webhook bytes, upload auth-before-body, all tRPC context/paths and
numeric results. Move health/capabilities into native Nest controllers. Runtime
factory initializes routes but does not bind a public port, start workers or
load production secrets. The existing executable uses it and retains host/port
and timeout policy. Verify actual network requests through this factory, including
unsafe origins, invalid JSON/size limits, anonymous uploads, HMAC rejection,
disabled features, missing routes, tRPC anonymous access and shutdown.

M03: Move launch settings to native controller + injected service using unchanged
domain transactions/validation. Compare real JWT/MySQL public/admin roundtrip,
roles/blocked sessions, JSON errors, revision conflict and audit effects. Remove
production duplicate route registration only after these checks pass.

Checkpoint after M02/M03: tests/types/lint/API-contract/boundaries/docs/build;
production-bundle startup with isolated configuration and no database/provider
effects, plus worker-free factory/listener close. Executable worker teardown
remains M07; current background intervals are not declared graceful. New dependency
audit and lockfile review. Each verified increment gets
its own commit. Record failures honestly; the existing intermittent registration
race, dependency advisories and migration-history mismatch do not disappear.

### Risks and controls

- Nest's parser defaults or Express adapter can change webhook/body/error semantics:
  disable default parsers and retain tested application middleware; HTTP regression
  gates decide compatibility, not source greps or mocked controllers.
- Two runtimes/duplicate routes conceal incomplete migration: one server/port,
  one composition root, explicit temporary adapters and per-module removal.
- Framework decorators may fail in tests/bundles: prove actual compiled startup,
  use explicit injection and avoid adding a second compiler/CLI unnecessarily.
- Worker teardown and DB lifecycle currently lack clear ownership: migrate them
  in dedicated slices, never start production jobs as an import side effect.
- Payment/auth bugs found along the way: reproduce with tests and fix in separate
  commits; do not revert security repairs or silently change frontend contracts.
