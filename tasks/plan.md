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

M04c checkpoint: required/optional session policy and administrative HTTP guards
are native and verified. Narrow exception filtering preserves legacy 401/403/415
formats and no-store even before controller execution; actual bundled Node smoke
also covers both denied staff routes. Registration diagnostics observe the real
service and rethrow unchanged errors, storing only bounded cause codes in test
assertions. Real SQL-trigger/configuration failures prove the diagnostic capture;
twenty simultaneous domain requests commit one account/setup/token/consent, with
nineteen duplicates and unchanged HTTP quotas. The earlier 500/500 remains
unreproduced; no production registration fix or retries are claimed. Latest full
disposable MySQL run: 641 pass / 2 external skip; types, lint, server/Next builds,
72-procedure contract, 406-file boundaries and 42-document links pass. No new
1213/1205 statement recorded during that diagnostic run. Continue domain wiring
after this verified authorization slice while retaining M04c3 as an open issue.

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

M05a specification: ContentReadService owns published post detail, saved-post
visibility/order and interaction aggregation. ContentModule exports the service;
TrpcModule injects it and SessionService into one application-scoped router/context
composition. Router factories retain Zod inputs, middleware and all 72 wire types.
Standalone appRouter/createContext remain for existing callers/tools, but the HTTP
factory must explicitly use the Nest-owned composition without global service
locators, optional service fallbacks or a second HTTP server. Nest creation happens
before mounting tRPC, still before init and after security/raw/body middleware.
Existing queries/Drizzle pool remain transitional; no ORM/schema/frontend change.
Move the unchanged club-access predicate from tRPC to identity/club-access.ts;
tRPC re-exports it for current consumers. Content services must not import the
transport implementation to obtain domain authorization rules.
Verify actual native HTTP/JWT/MySQL for public/club/draft/scheduled/unpublished
detail, bookmark order and paid attachments, live role/block/version/expiry changes,
public auth and protected failures. Characterize current behaviour and mutation-
check paid-content denial before extraction; do not call an intentional mutation
an existing production bug. Built Node smoke covers the new composition as well.

M05b specification: reuse ContentReadService for public article summaries and
article detail/locked previews, keeping field allowlists, [] sections when locked,
publication rules and independent database subscription checks. Preserve exact
inferred API types; no route rename or frontend regeneration without a wire change.
M05 admin creation/edit/publication, videos, reactions, comments and upload wiring
remain later slices; N12 durable announcement delivery is not part of read migration.

M05 read checkpoint: native ContentModule and TrpcModule are in the production
application, with explicit injection at composition only. Post/bookmark/interaction
and article visibility orchestration lives in ContentReadService; tRPC inputs,
middleware, one-server ordering and wire types stay compatible. Fifteen native
HTTP/JWT/MySQL cases characterize real data; deliberate guard bypasses produced
four post and four article failures, restored immediately (mutation checks, not
discoveries of existing production bugs). Compiled Node smoke also invokes feed/
article service reads and protected denial. Latest full suite: 656 pass / 2 external
skip; root/Next types, lint, backend/Next builds, unchanged 72-procedure contract,
411-file boundaries pass. No frontend/schema/dependencies/provider/production or
deployment changes. Admin writes and other content paths remain M05c/later;
registration diagnosis, worker/outbox ownership and release gates remain open.

M05c specification: ContentWriteService owns validated administrative create/edit/
manual-confirm orchestration. ContentModule exports it; TrpcService explicitly
injects it into required createAppRouter/createAdminRouter factory arguments.
Transport schemas move unchanged into content/post-write-input.ts and provide
typed validated inputs without circular imports or duplicated validation. Existing
adminProcedure stays the authorization boundary; actor identity comes from the
fresh server context, never from the payload. Preserve numeric IDs, boolean success,
schema defaults, normalization, partial fields, explicit null dates, transaction
rollback/row locks, idempotency intent and post-commit single-owner announcements.
No schema/ORM/provider/frontend change. Existing transaction helpers and global
pool remain transitional, and N12 durable push delivery is explicitly not solved.
Move existing real HTTP/JWT/MySQL regressions to the production Nest application;
add live moderator/session-revocation denial before all three writes and replay.
Deliberate pre-extraction idempotency bypass must fail the numeric-ID retry check,
then restore immediately; it is a mutation check, not an existing production defect.
Verify full suite, types, builds, compiled Node denials, unchanged API, boundaries
and docs before the save-point commit.

M05c checkpoint: 82 production-factory HTTP/JWT/MySQL write cases pass after
extraction, including the three new live-authorization cases. Focused tests with
standalone adapter and compiled Node smoke: 91 pass. Full suite: 659 pass /
2 external skip; root/Next types, frontend lint, backend and Next production builds,
unchanged 72-procedure/25376-byte contract, 413-file boundaries and 42-document
link checks pass. Review preserved defaults/date/partial-field semantics, validated
intent hash and actual transaction helpers; no new service locator or optional
injection fallback. This checkpoint covers only the three admin post writes, not
all admin/content, durable delivery, SQL ownership or release acceptance.

M05d specification: migrate feed list/pagination/tags and public video list/detail
to the already injected ContentReadService. Keep SQL visibility predicates, media
aggregation, counts, sorting, search/tag semantics, default limit and nullable
offset behavior. Video router becomes an explicitly supplied factory; no global
locator or optional service fallback. Existing query helpers/pool remain until M08,
without a duplicate repository layer. Characterize native HTTP/MySQL catalog
behavior, including hidden/draft/club bodies, pagination and media, and prove
publication protection with a deliberate local mutation restored immediately.
First investigate a separate pagination defect: the schema currently accepts
fractional limits and negative/fractional/unsafe offsets while SQL LIMIT/OFFSET
expects bounded integers. Reproduce HTTP behavior before deciding the fix; if
confirmed, reject at the input boundary in a separate verified commit. No frontend,
payment, upload, worker, provider or production/deployment changes.

M05d separate pagination repair: native HTTP reproduced 500 for limit=1.5 and
cursor=-1/0.5; the unsafe integer cursor was silently accepted. Direct invocation
of the unchanged real Drizzle helper confirms ER_PARSE_ERROR for the three SQL
cases. Input schemas now enforce integer limit and nonnegative safe integer offset;
default 12/nullish semantics and numeric wire types stay unchanged. Four regressions
pass after repair. Full suite 663 pass / 2 external skip, types, lint, backend build
and unchanged API contract pass. The analogous club schema is noted for a later
club slice; it is not declared repaired or reproduced here.

M05d catalog checkpoint: canonical SQL helpers are reused by ContentReadService,
and feed/video transport adapters dispatch through mandatory service factories.
Five added native HTTP/MySQL cases and eight migrated video/stream cases preserve
visibility, ordering, search/tag binding, counts/media, default/null offsets and
external playback boundaries. Intentional target-filter bypass failed the real
page assertion, restored immediately before extraction. Full suite 668 pass /
2 external skip; root/Next types, lint, backend/Next production builds, unchanged
72-procedure/25376-byte API and 413-file boundaries pass. Actual compiled Node
smoke also calls the catalog and verifies invalid pagination HTTP 400. Remaining
content writes, club pagination, SQL/pool ownership, registration diagnosis and
durable announcement delivery remain separate; no release readiness is claimed.

Club pagination repair checkpoint: native HTTP/JWT/MySQL first reproduced three
500 responses (fractional limit, negative/fractional offset) and accepted an unsafe
integer. The club schema now enforces integer limits and nonnegative safe integer
offsets before the unchanged SQL LIMIT/OFFSET helper. Four rejection regressions
and one compatibility case retain optional input/default 20/null cursor/max 200,
publication/target filters and anonymous denial. Full suite 673 pass / 2 external
skip; root/Next types, lint, backend build and unchanged API contract pass. This is
a separate bugfix, not a comment/reaction migration or a release-ready checkpoint.

M05e specification: ContentCommentService owns the existing six discussion
operations (list/add/update/like/delete/report), publication/club-read policy,
comment window and post-commit reply notification. Club router becomes a mandatory
service factory; ContentModule exports the provider and TrpcService explicitly
injects it at composition. Transport schemas/types/errors and middleware stay
unchanged, including subscriber-only list versus authenticated public mutations,
staff delete versus author-only edits, parent same-post validation, photos and
notification payload/preview/self-reply behavior. Existing SQL transactions/locks
remain in content/comments.ts; no new upload, billing or durable push feature.
Post like/save dispatch uses the existing ContentWriteService with the same coerced
input, boolean result and authenticated actor. Keep current toggle SQL semantics;
concurrent post toggles are not silently repaired during a behavior-preserving
extraction and need their own reproduced regression/atomicity slice.
Characterize real native HTTP/JWT/MySQL effects and denied mutations before moving
code, mutation-check the club guard locally and restore it immediately. Verify
compiled startup, exact API types, full tests, types/builds/boundaries/docs before
the checkpoint. No frontend/schema/provider/deployment or permission changes.

M05e checkpoint: fourteen new real native HTTP/JWT/MySQL cases characterize the
same six comment and two post-toggle procedures before/after extraction. An
intentional club-read guard bypass allowed a like after expiry and failed the
assertion; restored before extraction (not an existing production vulnerability).
ContentCommentService owns orchestration and shares the domain access policy;
transport schemas/auth remain at the adapter and existing helpers retain SQL locks.
Actual compiled Node starts with explicit provider injection and verifies anonymous
comment/reaction denials. Full suite 687 pass / 2 external skip; root/Next types,
lint, backend/Next builds, exact 72-procedure/25376-byte API and 415-file boundaries
pass. The first full run hit a fixture-setup deadlock: InnoDB traced an unrelated
manual media insert against the idempotency suite's deliberately stalled media
transaction. A separate test-only commit shares existing fixture ownership among
gated publication suites, with hook timeouts above the bounded DB wait; real
request/worker concurrency remains tested. No production schema/locking fix is
claimed by this isolation repair. Concurrent post toggles, media index/transaction
review, uploads/other admin, SQL/pool ownership, durable delivery, registration
diagnosis and release gates remain open.

Post reaction atomicity specification: native HTTP/JWT/MySQL reproduces lost
switches in even bursts; a real gated insert makes two requests observe absence
and both return true. Keep the existing boolean/coerced-input API and access
middleware, without changing post visibility policy, roles or quotas. One short
SQL transaction locks the existing authenticated actor row before reading the
reaction, then deletes all existing rows for that pair or inserts one, returning
only after commit. The actor row is the stable mutex even when no reaction exists;
do not rely on SELECT-for-update of an absent unindexed reaction or a process-local
lock. Different actors keep independent mutexes; no external work inside the
transaction, no blanket retries or new migration/data cleanup in this slice.
Use a focused content SQL helper rather than growing db.ts; facade signatures and
Nest wiring stay unchanged. Validate deterministic in-flight behavior, even/odd
bursts, independent actors, legacy duplicate disable, rollback and current auth
denials through the real production application. Schema/index review remains
separate, as do unique constraints, invalid post IDs and automatic retry safety:
a toggle remains non-idempotent after an ambiguous network result.

Post reaction atomicity checkpoint: before repair, twenty concurrent requests
returned only nine like enables / seven save enables instead of ten each. Gated
inserts independently reproduced two rows for the same actor/post and two true
responses instead of an enabled/disabled pair with no remaining row. The focused
content/post-reactions.ts helper now acquires the actor lock before reading state;
the existing db.ts facade delegates without changing the API or Nest composition.
Ten added real HTTP/JWT/MySQL regressions pass, including forced overlap, even/odd
bursts, two actors, legacy duplicate removal and rollback/released locks. Focused
suite: 24 pass. Full suite: 697 pass / 2 external skip; root/Next types, lint,
backend/Next builds, unchanged 72-procedure/25376-byte API, 416-file boundaries
and 42-document link checks pass. Review confirms there is no external work in
the transaction, process-local mutex, blind retry, new migration or data cleanup.
The guarantee covers canonical API toggle writers, not arbitrary SQL writers;
per-actor locking is intentionally broader than a single post. Pair indexes/unique
constraints, invalid post IDs, post deletion races and ambiguous network retries
remain separate. Upload/admin wiring, SQL/pool ownership, durable delivery,
registration diagnosis and release acceptance are not marked complete.

M05f specification: migrate only admin.uploadPhoto and admin.uploadMedia into
an explicitly injected ContentUploadService in ContentModule. Preserve procedure
names, schemas/defaults, pre-parser authentication/body limits, current admin-only
policy and fresh session checks. Reuse media/photos.ts without bypassing byte
validation/re-encoding; generic media retains its current base64 decoding, type
folder, name suppression, timestamp key, optional truthy postId association and
duration/default fields. Capture input types from shared schemas, keep router
validation/authorization thin and standalone callers on the same mandatory factory.
Characterize native HTTP/JWT/MySQL with real image processing and SQL, replacing
only external storage. Mutation-check a safety guard and restore before extraction;
verify compiled Node startup, API types, full suite and builds. No new upload
endpoint, provider, quota, MIME policy, retry behavior or schema. Raw-video upload,
URL imports, orphan-object cleanup after DB failure and stronger generic-media
validation remain separate; do not disguise them as fixed by service extraction.

M05f checkpoint: seventeen new native HTTP/JWT/MySQL upload cases characterize
the existing admin endpoints; only external storage is replaced. Real Sharp
processing proves WebP output, EXIF orientation/metadata removal and byte rejection;
SQL verifies exact optional associations, names, size, duration and ordering.
Fresh role/block/session-version denial occurs in the pre-parser guard and returns
plain JSON, not a tRPC error envelope; tests assert the actual HTTP contract.
Deliberately bypassing photo byte validation caused three rejection assertions to
fail; restored before extraction (not a newly found production vulnerability).
The injected ContentUploadService now owns the two operations, with unchanged
schemas/defaults and required factory composition; raw/upload imports remain
transitional. Focused tests including compiled Node startup: 39 pass. Full suite:
714 pass / 2 external skip; root/Next types, lint, backend/Next builds, unchanged
72-procedure/25376-byte API, 418-file boundaries and 42-document links pass.
Failure tests confirm no SQL association after storage failure and a safe 500
after forced SQL failure; the latter still leaves the stored object. Generic media
validation/key ownership and cleanup are explicitly open, not silently changed.
No frontend/provider/schema/quota/deployment changes or release-ready claim.

Generic media encoding/key safety specification: admin.uploadMedia currently
silently decodes invalid/empty/noncanonical base64 and uses a client filename plus
millisecond timestamp as the object key. Reproduce both malformed-input acceptance
and same-name/same-time collision before implementation. Require nonempty canonical
standard padded base64; bound encoded length by the existing 50 MiB JSON ceiling
before decoding, without changing HTTP parsers/quotas or wire types. Use fixed
type folders plus a server-generated UUID, with no client filename/extension in
the key. Preserve human display names/raw-camera suppression, MIME/type metadata,
byte sizes, optional association and success response; keys are opaque, not URLs
with trusted extensions. No new provider/endpoint/role or legacy object rewrite.
This does NOT validate the actual audio/video/document format or prevent active
content: MIME still requires its own acceptance policy (current clients support
PDF/DOC/DOCX/TXT and broad audio). Orphan cleanup must reconcile persisted ownership
and references before deletion; never delete on an ambiguous SQL error. Raw-video
uploads, private storage, durable intent/retry and those checks remain separate.

Generic media encoding/key safety checkpoint: tests against the previous code
confirmed nine invalid encodings were accepted, client path/query fragments entered
keys, and two same-name uploads at a fixed millisecond produced one storage key.
An independent service test also confirmed acceptance above the existing encoded
JSON ceiling. This is reproduced behavior, not an intentional mutation or evidence
of a historical production overwrite. The media decoder now requires nonempty
canonical standard base64 within 50 MiB encoded characters before allocating the
decoded buffer; ContentUploadService uses fixed folders and server UUIDs. Filename
and MIME remain client metadata, with existing raw-name suppression and byte-size
calculation. Seventeen added regressions include actual native HTTP/JWT/MySQL;
only external storage is replaced. Focused suite: 47 pass. Full suite: 731 pass /
2 external skip; root/Next types, lint, backend/Next builds, unchanged
72-procedure/25376-byte API and 419-file boundaries pass. HTTP parsers, quotas,
auth, frontend, schemas and dependencies are unchanged. No existing objects are
rewritten. File-format/MIME detection, orphan reconciliation, raw-video hardening,
private storage and provider acceptance remain open; no release-ready claim.

Generic media declared Content-Type specification: existing admin.uploadMedia
forwards caller MIME directly into public storage and SQL, even text/html for a
PDF-named document. Reproduce this through native HTTP/JWT/MySQL before repair.
This small slice checks declared category/MIME compatibility, NOT file signatures:
audio/* for audio, video/* for video; PDF, DOC, DOCX and text/plain for documents;
application/octet-stream remains the existing picker fallback for every category.
Reject missing/malformed/control-bearing or over-128-character MIME values and
incompatible categories as BAD_REQUEST before decoding/storage/SQL. Normalize
the MIME essence to lowercase and preserve valid ASCII token/quoted parameters
including charset/codecs for storage and SQL. Reject malformed/empty parameters,
unclosed quotes, HTAB and parameter obs-text. Preserve API shapes, human names,
UUID keys, parsers, quota, authorization and association behavior. No new
dependency, endpoint, provider call, database migration or old-object rewrite.
Tests cover active header types, category swaps, invalid header syntax/size,
supported editor types, binary fallback and matching storage/SQL metadata.
Verification: pnpm exec vitest run tests/nest-uploads.mysql.test.ts with disposable
MySQL, then pnpm test/check/lint/build/build:frontend/check:api/check:boundaries/
check:docs. Content-byte detection needs its own reviewed acceptance policy and
explicit dependency approval; MIME-family acceptance is not proof of safe bytes,
valid playback, absence of macros/scripts/polyglots or private storage. Orphan
reconciliation remains separate; no deletion after ambiguous SQL errors.

Generic media declared Content-Type checkpoint: prior implementation accepted
text/html and image/svg+xml in audio/video/document uploads, category swaps and
malformed MIME names. Over-128-character metadata caused a real SQL 500 after
the external storage boundary had accepted the object (not a historical provider
incident). Initial tests failed twenty assertions against the prior implementation:
fifteen invalid/incompatible values were accepted, one overlong value caused SQL
500, and four differed from the proposed normalization (not all are security bugs).
The owning content/media-content-type.ts policy now rejects incompatible/invalid
declared values, keeps supported editor types and binary fallback, and produces
one normalized value for both storage and SQL. Review caught parameter loss in
the first uncommitted version; five failing assertions separately proved malformed
parameter acceptance and lost charset/codecs. Final policy preserves valid ASCII
token/quoted-string parameters with case-sensitive values unchanged. Thirty added
cases cover rejection and supported metadata normalization. Focused suite: 77 pass;
full suite: 761 pass / 2 external skip; root/Next types, lint, backend/Next builds, unchanged
72-procedure/25376-byte API and 420-file boundaries pass. Tests use real HTTP/JWT/
MySQL but replace only external storage; they do not exercise actual storage
provider header behavior or claim browser exploitation. Human filenames, UUIDs,
association behavior, body limits, roles and shapes remain unchanged. No new
dependency/schema/frontend/parser/provider/deployment changes. The stricter ASCII
parameter grammar is documented; this is not a generic HTTP parser. Byte formats/playback,
antivirus/macros/active content, raw-video, private storage and orphan cleanup stay
open. A new byte-detector dependency was proposed separately for human approval,
not installed or assumed to validate legacy DOC/text/document safety.

Audio/video signature specification (next verified slice): after declared-MIME and
base64 checks, detect binary format before storage/SQL. Reject unknown signatures,
non-media formats and unambiguous category swaps with BAD_REQUEST. Keep document
byte validation separate; existing PDF/DOC/DOCX/TXT metadata policy is unchanged.
Use approved file-type 22.1.1 as a direct backend dependency, with scripts disabled
and reviewed lockfile/audit. Detection is a hint, not playback/track validation or
antivirus. MP4 and WebM are shared containers: permit audio and video categories,
using audio/mp4 or audio/webm for audio, without claiming to inspect their tracks.
Store the detected MIME consistently in storage/SQL; preserve declared parameters
only when their MIME essence equals the detected canonical value. Correct aliases,
incorrect same-family labels and octet-stream fallback rather than trusting them.
Run detection in an isolated worker with a five-second active-task deadline; one
active detector per process, serialized without introducing HTTP quotas or 429s.
Transfer a dedicated copy of the already size-bounded bytes, preserving storage
bytes; terminate/await the worker on every outcome. Malformed/parser-limit/timeout
input fails closed; worker startup/runtime infrastructure failure stays a generic
500. Test native HTTP/JWT/MySQL rejection and unchanged supported uploads, plus
worker teardown/recovery and compiled Node 22 execution. No schema, frontend,
provider, raw-video, storage privacy or orphan-object deletion changes.

Audio/video signature checkpoint: six added native cases failed against the prior
handler because HTML/SVG/PDF/ZIP/unknown/truncated-MP4 bytes were accepted as audio
and associated in SQL after the replaced storage boundary. This is a reproduced
code defect, not evidence of historical exploitation; final cases check both
audio and video. Correct uploads use locally generated MP3/MP4/audio-WebM and PCM
WAV fixtures, without private or remote media. Same-family label correction and
shared-container category handling are compatibility policy, not codec validation.
ContentUploadService now resolves audio/video MIME after strict decoding and before
storage/SQL. Documents retain their separate declared-header-only policy. Fixed
trusted worker code imports the exact installed dependency, receives only an owned
byte copy and no application environment/preload flags, runs one active task per
process, and is terminated/awaited on success, failure and deadline. Pending HTTP
request memory and queue wait are not bounded by this worker slot; no general DoS
protection or OS sandbox is claimed. Deadline uses fault injection; parser/byte
preservation, parallel results, compiled ESM from a foreign cwd and existing
CommonJS/tsx dev runtime use real workers. Native HTTP/JWT/MySQL replaces only
storage transport; actual provider Content-Type behavior remains unverified.
Twenty-two added cases: focused 99 pass; full 783 pass / 2 external skip across
82 passing files and one skipped file. Root/Next types, lint, backend/Next builds,
unchanged 72-procedure/25376-byte API, 421-file boundaries and 42 current docs pass.
Approved file-type 22.1.1 was already in the Nest transitive graph; the only lock
change is its exact direct backend importer entry. Reviewed MIT/BSD dependency
chain has no install hooks. A clean, frozen, offline pnpm 9.12.0/Node 22 workspace
install with scripts disabled and a detector call from its backend passed. Native
audit snapshot remains 33 high / 36 moderate / 4 low / 0 critical across 821 entries;
no detector-chain advisory was returned, which is not a general safety guarantee.
Existing audit findings need separate reachability/fix triage; no forced upgrade.
No schema, frontend, body quota, provider call, old-object rewrite or deployment
change. Document byte policy, raw-video, private storage, orphan reconciliation,
full file/track validation and provider acceptance remain open; no release claim.

PDF/DOCX signature slice: the existing document branch bypasses byte detection.
For normalized declared application/pdf or DOCX MIME only, require the existing
isolated file-type detector to return exactly that MIME before storage/SQL.
Unknown/foreign signatures (including a PDF/DOCX swap, ordinary ZIP and a package
advertising macro-enabled Word) return BAD_REQUEST / 400. Keep valid declared
parameters, stored bytes, display names, UUID keys, association and API shapes.
Preserve legacy DOC, TXT and application/octet-stream behavior in this slice:
they remain unverified, are not a safe alternative, and need their own acceptance
policy. No new dependency, parser, schema, quota, frontend or provider call.
This is signature/package classification, not full PDF/OPC validation, exclusion
of hidden macros/scripts/polyglots or antivirus. Use native HTTP/JWT/MySQL with
only storage transport replaced: prove prior acceptance first, then validate
locally constructed PDF and minimal DOCX packages plus unchanged legacy behavior.
Owner: content/media-content-type.ts; fixtures/tests: tests/helpers and native
upload suite. Follow existing TRPCError/Prettier conventions. Verify with pnpm exec
vitest run tests/nest-uploads.mysql.test.ts tests/file-signature.test.ts and pnpm
test/check/lint/build/build:frontend/check:api/check:boundaries/check:docs under
Node 22 and disposable backend_test MySQL. Run tests before a local atomic commit;
ask before new dependencies/schema/auth/provider changes; never read private files
or automatically delete an object after an ambiguous SQL error.

PDF/DOCX signature checkpoint: fourteen native HTTP/JWT/MySQL rejection cases
failed against the prior handler because all payloads were accepted and associated
after the replaced storage boundary. Cases include HTML/SVG, MP3, ordinary ZIP,
unknown text, a package advertising macro-enabled Word and PDF/DOCX swaps. This
is reproduced acceptance, not historical browser exploitation or macro execution.
The owning MIME policy now applies exact signature-MIME matching to declared
PDF/DOCX, reusing the already approved isolated detector and its deadline/teardown.
Eighteen native additions cover rejection, real supported bytes, preserved valid
parameters and standalone uploads; one compiled ESM/Node 22 policy case uses real
workers from a foreign cwd. Fixtures are locally constructed, not user documents;
the PDF was independently accepted by pdfinfo as one page, while ZIP package MIME
classification was separately observed for DOCX/DOCM/ZIP. No executable macro
payload or full Microsoft Office/PDF rendering acceptance is claimed.
Focused 118 pass; full 802 pass / 2 external skip across 82 passing files and one
skipped file. Root/Next types, lint, backend/Next builds, exact 72-procedure/25376-byte
API and 421-file boundaries pass. No dependencies/lockfile/schema/frontend/parser/
HTTP quota/provider/deployment change or old-object rewrite. Native audit still
reports 33 high / 36 moderate / 4 low / 0 critical; existing graph triage is separate.
Legacy DOC, TXT and document/octet-stream intentionally remain metadata-only:
choosing those labels still bypasses this document content check. They are not a
safe alternative or proof of a complete document boundary; their acceptance policy,
provider headers/privacy and full file/active-content validation remain open.
Storage/SQL are still non-atomic; orphan reconciliation must resolve ownership and
persisted references, never delete immediately on an ambiguous SQL failure.

TXT/opaque fallback slice: reuse the isolated binary detector before storage/SQL.
Declared text/plain must not contain a recognized binary signature. Validate the
complete decoded text with fatal TextDecoder and reject C0/C1 controls except
tab, LF, CR and form feed. Support UTF-8 by default, UTF-16LE/BE BOM detection,
and explicit supported charset labels/aliases for UTF-8, UTF-16LE/BE and
Windows-1251; reject duplicate/unsupported charset, BOM conflicts and malformed
encoding. Validate in bounded chunks without changing the original storage bytes.
Plain text may contain literal markup/code: this is encoding/type validation,
not an HTML filter or antivirus. Add an explicit charset when it was absent.
For document/application/octet-stream, accept detected PDF/DOCX or validated
UTF-8/BOM Unicode text, replace the opaque header with its canonical MIME and
discard unrelated opaque parameters. Reject recognized foreign binaries and
malformed/unknown non-text bytes. Do not guess a legacy encoding from arbitrary
bytes. Legacy declared DOC remains unchanged until a reviewed CFB format detector
can distinguish Word from Excel/PowerPoint/MSI; generic CFB magic is insufficient.
No dependency, schema, frontend, HTTP quota, raw-video or provider change. Native
HTTP/JWT/MySQL tests must prove prior acceptance before implementation, then assert
rejection before any write and stored MIME/bytes/association compatibility.
Compiled Node 22 must exercise the same text/fallback policy with real workers.
Standalone editor metadata still comes from the client; no ownership/association
integrity or provider Content-Disposition/nosniff/privacy claim is made here.

TXT/opaque checkpoint: the pre-repair native HTTP/JWT/MySQL run had 40 failures,
including 28 cases that accepted known foreign binaries, invalid encodings,
controls and ambiguous/unsupported charset before writes. Other failures exposed
missing canonical MIME; the compiled ESM policy also failed before repair. This
is reproduced acceptance, not historical exploitation. Reuse the existing worker
for binary classification; the content-owned text helper uses Node TextDecoder
and the standard MIME parser, rejecting duplicate charset without reading a
substring inside a quoted parameter. Scan complete text in 16 KiB chunks, flush
incomplete tails and preserve original bytes. Text scanning is synchronous linear
work over the existing size-bounded buffer: chunking bounds temporary strings,
not CPU/request memory. No generic DoS or parser-sandbox guarantee is claimed.
Review caught an introduced edge case: adding charset could exceed the 128-char
SQL MIME ceiling and fail with 500 after storage. A failing regression preceded
the guard; at-limit success and over-limit rejection now pass before any write.
Forty-eight native additions plus an expanded compiled real-worker case cover
foreign signatures, actual locally constructed Cyrillic encodings, BOM conflicts,
split UTF-8/UTF-16 characters, invalid late bytes, opaque PDF/DOCX/text and unchanged
standalone response/association. A CFB-magic fixture is explicitly not a valid DOC;
literal markup is valid text, not evidence of HTML execution or its prevention.
Focused 166 pass; full 850 pass / 2 external skip across 82 passing files and one
skipped file. Root/Next types, lint, backend/Next builds, unchanged 72-procedure /
25376-byte API, 422-file boundaries, formatting and 42 current docs pass. No new
dependency/lockfile/schema/frontend/body quota/provider/deployment changes.
Compatibility: Windows-1251 needs explicit text/plain + charset; picker fallback
does not guess this encoding. Legacy DOC still bypasses byte validation; review
Word-specific detector separately. Source inspection confirmed standalone editor
post-save still writes client MIME: that contract and durable ownership/orphan
reconciliation are next, not falsely covered by native postId upload assertions.
Provider headers/privacy, whole-file/active-content checks and existing workspace
dependency audit triage remain release gates. No immediate deletion on SQL failure.

Staging integration checkpoint (2026-10-05): origin frontend migration is already
contained in origin/staging; integrate the pending backend commits after fresh
verification. First repair the already-planned standalone upload metadata flow:
return additive canonical mimeType/fileSize from the server. After the user's
scope correction, do not change frontend source, tests or its local generated
contract; describe the editor's required metadata/retry handling in the handoff.
The user explicitly declined even generated frontend type updates. Keep the
strict check:api gate; do not merge/deploy this new API slice until that client
snapshot is updated by its owner. Backend-only verification is not full CI.
Photo URL-only responses are unchanged. Deploy the server before the later editor
update (old editors ignore added fields). Verify native HTTP/JWT/MySQL and the
existing regression suite. Record the expected regenerated API contract for the
frontend developer without changing their files. This does not establish persisted
ownership, repair the existing editor or authorize orphan deletion.
Test deployment still requires a confirmed test-only host, SSH access and isolated
database/provider/mail settings; the old production/static deploy is not reusable.
Legacy DOC detector/dependency and dependency audit triage remain explicit gates,
not presumed covered by this contract repair.

Raw-video signature slice: harden the existing POST /api/admin/upload-video
without adding a handler or changing authentication/CORS/body quotas. Retain
pre-parser live admin authorization, repeat authorization in the handler, the
80 MiB body ceiling, filename query/folder and URL-only success response. Reuse
the canonical media MIME normalizer and isolated signature detector for video;
retain video/mp4 as the absent-header default, accept recognized video containers
and binary picker fallback, reject foreign/unknown bytes and incompatible or
malformed declared MIME before storage. Store the canonical MIME and original
bytes. Map only trusted policy BAD_REQUEST failures to safe HTTP 400; worker/
storage infrastructure failures remain generic 500 without internal messages.
Native HTTP/JWT/MySQL tests must reproduce acceptance before repair, cover live
role/block/revocation and compatibility, and keep only storage transport mocked.
Signature classification does not certify tracks, playback or antivirus. No
new dependencies, schema, ownership/cleanup, URL import, Nest wiring or frontend
changes. Timestamp object keys remain a separately testable collision repair.

Raw-video signature checkpoint: 20 native failures reproduced before repair;
34 native HTTP/JWT/MySQL and four injected-fault cases pass, including actual
80 MiB HTTP ceiling, MP4/WebM/MOV and live identity changes. Full disposable
MySQL suite with backup/restore: 889 pass / 2 external S3 skip. Storage transport
alone is mocked in native cases. Old objects/Word bypass/ownership/privacy remain
open; raw URL-only contract preserved and no frontend files changed.

Raw-video key collision slice: reproduce separate valid HTTP uploads with the
same sanitized filename and fixed Date.now(), both sequentially and concurrently.
Each accepted request must get a distinct server-generated object key without
relying on clock resolution. Reuse built-in crypto.randomUUID (already used by
JSON media uploads), preserve feed/reels folder and sanitized filename suffix,
original bytes/MIME and URL-only response. This is collision isolation, not
idempotent upload, durable ownership or provider end-to-end verification.
No schema/dependency/frontend/old-object migration or automatic deletion.

Raw-video key checkpoint: both collision regressions failed with one key instead
of two/four, then passed with UUID keys. Native raw suite 36 pass, focused 63 pass;
full disposable MySQL/backup/restore 891 pass / 2 external S3 skip. Type checks,
lint, backend build, boundaries and changed test formatting pass. Frontend upload
consumer reads the URL without parsing the old timestamp (read-only inspection).
Strict check:api remains blocked by the intentionally untouched client snapshot;
no bypass/merge/push/deployment. File transport/ownership/privacy remain separate.

Video-link continuation: first reproduce the existing admin.importVideoUrl error
mapping on native HTTP/JWT/MySQL. Unsupported/external/malformed URLs are client
input errors, not infrastructure failures: return BAD_REQUEST / 400 while keeping
the same safe messages and URL-only success shape (optional fileSize type intact).
Keep exact configured HTTPS origin/bucket acceptance, live admin authorization,
no server-side fetch or storage write, and prior traversal rejection. No new
integration, network fetch, auth/quota/CORS/dependency/schema/frontend change.
Then move this tested policy behind the existing injected ContentUploadService
in a separate behavior-preserving commit; raw upload wiring remains separate.

Video-link error checkpoint: fourteen native failures reproduced (500 instead of
400), then 21 native cases and 69 focused cases passed. Full disposable MySQL
with backup/restore: 912 pass / 2 external S3 skip. Types, lint, backend build,
boundaries and new test formatting pass. URL policy refusal is not a server
outage; this change does not establish object existence/type/ownership. Existing
external-import prohibition, messages and URL-only success remain intact.

Video-link Nest checkpoint: route now calls the existing injected upload service;
URL guidance/origin/bucket policy moved from raw admin-video to content, without
an alternate runtime or forwarding facade. Previous regressions remain intact:
210 focused / 912 full pass, 2 external S3 skip, real disposable backup/restore.
Read-only compiler rendering gives identical 72-procedure contract before/after
the refactor (18653 unformatted bytes; SHA-256 e9b921094146806f666968b4bf96d58fdea862efe0fc5322230d720e2c84c449).
No frontend file is generated/edited; check:api still detects the earlier upload
metadata snapshot gap. Types/lint/backend build/423-file boundaries pass. No new
dependency/schema/quota/auth/CORS/outbound requests. Raw upload Nest wiring,
legacy DOC/ownership/privacy and release gates remain open.

Raw-video Nest continuation: move the existing binary POST /api/admin/upload-video
into a native ContentModule controller and the injected ContentUploadService.
Retain pre-parser admission and a fresh JWT/live SQL check after receiving the
body, 80 MiB limit, URL-only 200 response, canonical MIME, UUID keys and safe
401/403/400/413/500 messages. Characterize identity revocation during streaming
before migration. Trusted input errors alone map to 400; provider errors remain
500 even when they use BAD_REQUEST. Remove the superseded Express business
handler; retain parser middleware and one server. No frontend/API type writes,
new auth policy, schema/dependency changes, outbound integration or deployment.

Raw-video Nest checkpoint: 53 pre-migration characterization cases pass; all
three mid-stream live identity tests fail (unsafe 200) when the post-body check
is deliberately disabled, then pass with the real check restored. Native
controller/service/parser composition passes 238 focused cases plus a separate
compiled ESM HTTP/JWT/MySQL/worker case. Full suite with disposable backup/restore:
916 pass / 2 external S3 skip. Types/lint/backend build/423-file boundaries pass.
The read-only 72-procedure fingerprint remains identical to the URL-import stage;
no frontend generation or new contract change. Superseded admin-video.ts removed.
Remaining admin/data/worker migrations and release gates are not marked complete.

Admin-content read continuation: wire admin.posts/postsFiltered/scheduledPosts/
getPostMedia/stats through the existing injected ContentReadService. Keep the
current schemas, adminProcedure, unpublished/private visibility for admins,
three ordering rules, ordered attachment metadata, dashboard semantics and
empty/unavailable results. First characterize real HTTP/JWT/MySQL, then move
only these reads without a new module/port or fallback composition. Preserve
the read-only contract fingerprint and run the compiled Node entrypoint.
No frontend/generated types, schema, auth, provider or deployment changes.
Unbounded admin catalogs/statistics SQL and all write paths remain separate.

Admin-content read checkpoint: 19 native cases (including compiled ESM HTTP/
JWT/SQL) pass before/after wiring. Deliberately substituting the public catalog
makes the unpublished/ordering test fail. Five-suite focused run: 90 pass;
the old direct-router publication fixture required its new read dependency
(six failures/type error reproduced, all six pass after composition repair).
Final unmodified-concurrency full suite: 935 pass / 2 external S3 skip with real
disposable MySQL backup/restore. Types/lint/build/423-file boundaries pass;
read-only 72-procedure fingerprint unchanged. Strict check:api remains blocked
by the older untouched frontend metadata snapshot. One earlier full run failed
the native toggleSave actor-lock observation; diagnostic/isolated/paired runs
and final original-test full run passed without proving a cause or fix. Keep
that investigation open before merge, not hidden by retries/skip/timeouts.
No staging merge/push/deploy, new dependencies/schema/frontend/auth changes.

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

## TeamAssist isolated staging deployment — 2026-10-06

Extends the staging integration/deployment work, without replacing the open
backend release plan. User supplied SSH access and approved a new empty test DB.
Deploy source 12cfc8dd76e801809828e2ef8af4bdcc8577019f; do not edit frontend
sources, generated API types or tests. No production data/credentials/providers.

1. Inventory the shared host and triage the fresh lockfile audit. Checkpoint:
   no unrelated application changes and no unmitigated reachable high/critical
   finding for this exact test configuration; retain dated dependency follow-up.
2. Build a Linux/amd64 artifact with frozen dependencies and install scripts
   disabled. Prefer local build; bounded 1 GiB/0.6 CPU isolated remote builder
   is the fallback if local Docker is unavailable. Keep runtime and secrets
   separate. Verify actual startup.
3. Start isolated MySQL with no published DB port. Initialize canonical schema
   only after verifying this new DB is empty. This is a test-only baseline, NOT
   reconciliation/approval of the existing 0017–0019 migration-history gap.
4. Start frontend/API on their own bounded Compose project; expose only a
   loopback edge port and then HTTPS via host nginx. Verify guest UI, real SQL
   catalog/config queries, protected-route refusals and disabled providers.
5. Record artifact SHA, runtime health, resource use, secret locations and
   stop/rollback steps. Keep the known three browser failures and production
   migration/provider/private-storage release gates explicitly open.

Deployment checkpoint: server image c08e021f95ae6c57fd5594dfcce0925f0298e2f131e052ff4813aba011ed5748
built/started with production-only dependencies and native sharp/file-type checks.
All four containers healthy; HTTPS guest/SQL/admin-refusal/payment-off smoke passes,
home page rendered in the browser. Native backup decompresses to 28 tables;
users/payments remain zero; API outbound TCP blocked. Other server projects retain
their original uptime. Temporary server builder/cache removed. This is only a
test baseline, not production migration/provider/privacy acceptance.

## Migration application guard — 2026-10-06

Continue the B05/release migration gate, not the frontend or live deployment.
The existing db:push command generates and applies SQL before enforcing the
known 0017–0019 manifest failure. Do not reconcile that history without source
database evidence; prevent this unsafe default instead.

1. Reproduce command execution with disposable executable probes: a failed
   preflight must prevent both generation and application. Assert real child
   process effects/exit codes, not package.json source strings.
2. Make db:push apply reviewed SQL only after a database-required preflight using
   the same explicit DATABASE_URL as Drizzle. Refuse conflicting preflight URLs,
   unknown arguments and missing database configuration. An invalid manifest must
   fail before any connection attempt; existing read-only preflight semantics stay.
3. Verify focused migration tests, types/API/build/boundaries/docs and review the
   diff. Update workflow docs. Do not run migrate, change SQL/journal, seed an
   administrator, modify frontend files, push/merge or update the test server.

This is a fail-closed command guard, not migration reconciliation, a DB snapshot
lock, a backup/restore rehearsal, production approval or a restriction on someone
deliberately invoking drizzle-kit directly. Local Docker is currently unavailable;
do not silently skip SQL-dependent verification or reuse the deployed test DB.

Guard checkpoint: six failures reproduced before repair, then 13 command/CLI
cases and the existing 18 history/policy cases passed. Executable probes prove
failed preflight prevents generation/application; actual CLI tests prove unknown
flags/missing/conflicting URLs fail closed, .env is not loaded, dirty manifests
open no TCP connection, and the required gate does contact DATABASE_URL for a
clean manifest (a refused handshake remains a safe failure with no secrets).
Actual repository db:push exits 1 before any Drizzle write on the three known
orphan files. Full local suite 518 pass / 498 skip, with real MySQL unavailable;
types/lint/backend build/API/boundaries/docs pass. No SQL/journal/schema, frontend,
dependency, provider, server or production data changes. History reconciliation,
actual migration rehearsal and all other release gates remain open.

## M05 admin article continuation — 2026-10-06

Move admin.articles/createArticle/updateArticle/deleteArticle through the existing
injected ContentReadService/ContentWriteService. Preserve the schemas, defaults,
adminProcedure, private/draft list ordering, block normalization, numeric create
result, {ok:true} update/delete results and current article teaser side effects.
No new module/dependency, frontend/types, auth policy, schema or provider changes.

1. Characterize real HTTP/JWT/MySQL CRUD, publication/cover teaser transitions,
   invalid inputs and live denied/revoked identity. Demonstrate that a deliberate
   public-only catalog mutation fails the private/draft assertion before wiring.
2. Move only this orchestration behind the existing injected services; keep
   canonical db helpers and input schemas unchanged. Verify compiled ESM startup
   and read-only API contract check, then the focused/full regression suite.
3. Record remaining risks: article/teaser writes are not a single transaction,
   teaser target policy and missing/empty update semantics remain legacy behavior;
   ownership/privacy/provider/migration release gates do not disappear.

Local Docker still returns EOF. Use a separately named disposable MySQL container
on the user-provided test host only after inventory confirms resources. Bind only
loopback and connect through a private SSH tunnel; random ephemeral credentials,
512 MiB/0.4 CPU limits, exact ownership-labelled volume. Do not reuse the deployed
staging DB or change its containers. Remove only this fixture/tunnel/volume after
verification; no real users, provider calls, payments or email. Full backup/restore
gates requiring local Docker remain distinct from HTTP/SQL regression verification.

Test topology correction: the initial article beforeAll exceeded 10 seconds on
fresh DDL over SSH. A separate schema diagnostic measured 36 queries at 156–205 ms
each (6.8 seconds even after initialization). Do not increase assertion/hook
timeouts or interpret this as a product fix. Run a separate bounded Node test
container beside the disposable MySQL, using the existing staging image for
production dependencies and only frozen lockfile-selected test tools (scripts
disabled). Connect the two only on an ownership-labelled internal network and
disable external egress before tests. No HTTP port/jobs/deploy.env or other app
volume mounts. Remove this runner/network along with the SQL fixture afterwards.

Full-suite environment diagnosis: the first remote full run had 1015 pass,
15 failed tests, two failed suite imports and four skips. This runner lacked
Git/concurrently/qrcode, and the macOS tar transfer introduced an AppleDouble
sidecar matching Vitest's test glob. The SQL fixture had performance_schema=OFF,
so the lock-observation assertions could not see any pending locks; the image's
inherited NODE_ENV=production also refused the suites' loopback HTTP provider/
access URLs. Recreate only the owned SQL container with instrumentation ON,
retain its synthetic volume, install only the missing locked Node tools and Git
in the owned runner, remove the exact generated sidecar, and pass NODE_ENV=test
to Vitest (compiled production-child checks still set their own environment).
Verify instrumentation and internal-only network, then run a new full regression.
No product fix, assertion/timeout change, retry loop or deployed-DB repair is implied.

Article checkpoint: all four operations now use the existing injected services;
the route schemas and DB helpers are unchanged. Twenty characterization cases
pass; the deliberate published-only catalog mutation fails on missing draft 9061.
Focused three-file run: 68 pass. After the diagnosed fixture corrections, a fresh
full run passes 1032 / skips 4 across 90 files (two external S3, two native Docker
backup/restore). Local no-DB run: 518 pass / 518 skip. Types, lint, backend build,
strict 72-procedure/25461-byte API check, 434-file boundaries and 44-doc check pass.
Services/new tests match Prettier; admin router/README/tasks already differ from
the formatter at HEAD, so no unrelated whole-file reformat is included. No frontend,
schema/journal, dependency, provider or deployed application changes. Remaining
article consistency/policy/update semantics and release gates stay separate.

Cleanup verified: ownership labels/mounts/network peers and exact artifact paths
matched before removal. Both disposable containers, their synthetic SQL volume,
internal network and private generated local/remote artifacts were removed. The
four staging containers remain healthy at the previous version; other shared-host
applications retain their original uptime. No production data was removed.

## Article/teaser write consistency — 2026-10-06

Continue the pending M05 article consistency item on fix/article-write-consistency.
Trust boundary stays adminProcedure → injected write service → canonical DB helper.
Assets: article visibility/content and teaser discussion/reactions. Current service
create/update and DB delete commit those assets separately; an SQL failure can
leave only half of an admin operation. No frontend/types, provider, auth-policy,
production schema/history, push/merge or deployed-application changes.

1. Prepare owned disposable SQL/Node fixtures, with performance_schema ON,
   NODE_ENV=test, frozen test tools, no outside egress/HTTP port. Keep the test
   host's other applications untouched and resource limits at the previous bounds.
2. Prerequisite slice: extract the existing post deletion cascade into a domain
   helper that accepts the caller's transaction. Preserve standalone deletePost's
   lock order and transaction; verify existing real HTTP/SQL/cascade regression
   tests, review and commit this extraction separately from the behavior fix.
3. TDD fix: use real HTTP/JWT/MySQL with narrowly scoped SIGNAL/gate triggers to
   reproduce partial create/edit/unpublish/delete and pre-commit visibility. Prove
   concurrent edits/publications of one article wait for its row owner and leave
   one matching teaser. Then make each article mutation one Drizzle transaction,
   lock the existing article before teaser reads/writes, and reuse the canonical
   post cascade without nested commits. Keep storage normalization/teaser fields,
   target=club, missing-ID/nonempty update success and empty-patch failure intact.
4. Verify focus/full regression, compiled ESM, unchanged strict API and static
   gates. Record limits and remove only exact ownership-checked temporary resources.

Acceptance: injected SQL failures leave the original article/teaser/related SQL
rows unchanged; readers cannot observe an incomplete article/teaser write; two
article-API writers serialize without a new duplicate or stale teaser. No schema
index/legacy duplicate cleanup, generic post-source ownership policy, request
idempotency or file deletion is added. Production DB reconciliation/rollout and
the earlier intermittent concurrency investigation remain separate release gates.
Skill supplementary definition-of-done/security reference files are absent; use
the repository's existing verification and release gates, not an invented checklist.

Prerequisite checkpoint: post-deletion.ts exposes the existing cascade to a caller
transaction; standalone deletePost still opens exactly one transaction with the
same post/comment lock order and SQL operations. The baseline and extracted runs
each pass 33 HTTP/JWT/MySQL cases (20 article cases including compiled ESM, 13
comment/delete cases including rollback and concurrency). Types and backend build
pass. Review found no changed schema, permission, return value or storage effect.
Commit this extraction separately; article atomicity is not implemented yet.

Behavior checkpoint: the new real HTTP/JWT/MySQL suite failed nine assertions
before implementation (two unchanged deletion characterizations passed). Observed
persisted orphan article, changed article fields/visibility despite teaser failure,
deleted teaser despite final article failure, partially visible create/edit, and
absence of article row waiting during competing publication/deletion. Triggers
use only owned fixture predicates; assertions/timeouts were not relaxed.

article-writes.ts now owns one transaction per create/edit/delete and shares the
canonical deletion cascade. Existing rows are locked by article PK before any
snapshot/teaser lookup. The plain source lookup avoids locking an unindexed scan
of all posts; same-article API writers wait for the previous owner. No generic
post-source ownership guarantee or cleanup of existing source duplicates is made.
Storage normalization, first-match teaser behavior, club target, return shapes,
missing-ID/nonempty update and empty-patch error remain unchanged. The service no
longer runs a second independently committed teaser operation. Focused run: 44
pass (11 new consistency cases, 20 native admin/compiled ESM, 13 cascade cases).
Full regression started at this checkpoint; no push/merge or staging deployment.

Review hygiene: getPostBySource has no remaining callers; postComments,
commentLikes and commentReports imports in db.ts became unused after extraction.
The user explicitly chose to leave them for now. No unrelated cleanup is included.

Five-axis review: the failure/gate tests check committed raw SQL, not mocks; the
first article lock precedes all consistent reads; helpers contain no nested commit
or external effects. Canonical cascade, input schemas and fresh-session admin guard
remain unchanged. Storage filtering and teaser fields match the old helpers; no
new date/richText reset or announcement was introduced. Feature SQL now belongs
to content/article-writes.ts instead of expanding db.ts; no new dependency or
cycle. Queries remain parameterized. Article lock uses its PK; the existing
unindexed source scan remains a performance limit, not a new global locking scan.
Read consistency across separate requests, historical duplicates, generic-post
source ownership, creation idempotency and file deletion remain explicit limits.

Final regression checkpoint: 1043 pass / 4 skip across 91 files (90 passing, one
external-S3 suite skipped; two S3 and two native Docker backup/restore cases not
run). No failure, automatic retry, relaxed assertion or changed timeout. Includes
the final explicit-field article insertion and native compiled ESM regressions.
Types, lint, backend build, unchanged strict 72-procedure/25461-byte API,
436-file dependency boundaries, 44-doc links and changed-module/test formatting
pass. Local Docker remains unavailable; this remote internal-only fixture is not
a rehearsal of production migrations or native Docker backup/restore. HTTPS on
the unchanged test stand returns 200.

Cleanup completed after exact ownership label/mount/network-peer/path checks:
only the two disposable containers, their synthetic SQL volume, isolated network
and private generated local/remote artifacts were removed. Fixtures are
reproducible from tests; no production data was removed. All four staging
containers remain healthy, API/web at 12cfc8d; other host applications retain
their original uptime. No frontend files/types, schema/journal, dependency,
provider, push/merge or deployed application changes. Remaining M05 administrative
service wiring is next; broader release blockers are still open.

## Pending registration retry — 2026-10-06

User-reported staging flow: registration inserts a passwordless account and durable
mail, but SMTP is absent; a second request gets 409/"Войдите" although password
setup is incomplete. Read-only staging diagnosis confirmed passwordHash=NULL,
unsent setup mail and SMTP_PASS absent. No staging data/configuration changed.

Backend-only repair on fix/pending-registration-retry. Trust boundary: public
registration → identity service → locked user + registration provenance + durable
setup-mail transaction. No password/profile/role/session mutation on retry. Existing
active/staff/blocked/checkout-only accounts keep duplicate behavior. Do not treat
every passwordless row as a pending public registration.

1. Reproduce sequential/concurrent retry through native HTTP/MySQL. Existing origin
   registration mail proves the account's flow; identity fields/consent/password
   remain unchanged. Retry returns the existing 202/ok/message shape, never a
   session; active accounts still return 409. Preserve consent/IP checks.
2. Reuse a still-usable queued setup; otherwise queue a new setup without consuming
   previous valid links. User approved a durable per-recipient maximum of three
   setup mails per rolling hour (initial mail included), same 202 on suppression.
   Row lock serializes retries; SQL failure rolls token/mail creation back.
   Passwordless recovery uses the same setup policy so changing the URL cannot
   bypass the quota or consume the earlier valid link. Active-account password
   reset keeps its existing superseding-link behavior. Initial concurrent losers
   now return pending/202 when origin registration exists; one account/mail remains.
3. Verify real loopback SMTP delivery/rejection + retry + password completion/login
   on a disposable isolated fixture, then full/static/API/compiled checks, review
   and ownership-checked cleanup. No frontend or generated-type edits, migration,
   external mail, push/merge or staging rollout in this slice.

Actual Gmail delivery is a separate checkpoint. User will provide test SMTP
configuration in a protected local file; until then do not invent credentials,
enable live integrations or open staging egress. Real delivery and application
deployment cannot be claimed from the isolated receiver tests.

Implementation/review evidence: 12 expected failures before production changes
(ten retry cases and two deliberately changed initial-concurrency outcomes).
The first increment then independently exposed passwordless recovery creating a
fourth setup and consuming earlier links; routing that branch through the shared
setup policy fixes the cross-route bypass. Active-password reset regressions pass.
The new native SMTP receiver exercises real Nodemailer recipient acceptance and
rejection, durable outbox state, link completion and explicit later login, not a
mocked sender. Initial account creation remains insert-only; retry requires the
exact originating event/user/email/kind and never updates identity or consent.

Five-axis review: user lock precedes the retry snapshot and token/mail writes;
password completion takes the same lock. The unique origin event guards pending
eligibility; bounded latest-mail lookup and quota use the existing user index,
token lookup uses its unique hash. Queue budget includes initial/failed/discarded
setup records, not just accepted SMTP deliveries. No new migration, dependency,
cookie, response field or frontend code. Encrypted links never leave the mail
worker; errors remain generic. Reusing a pending link preserves backoff/lease;
successful completion still consumes all outstanding tokens. Staff/blocked/active
and checkout-only duplicate behavior remains tested. Historical duplicate emails,
outbox retention and general auth/IP-limit redesign are not addressed here.

Test environment diagnosis: compiled-ESM case hit its unchanged five-second
timeout with the disposable runner capped at 0.5 CPU; cgroup statistics showed
1409 throttled periods out of 1918 and ~97 seconds of cumulative throttling.
Only that owned runner was increased to one CPU, with memory cap unchanged.
All 58 focused tests then passed, followed by 1059 pass / 4 skip in the full
suite. No retries, relaxed assertions or increased test timeout were added.
Final indexed version: 1059 pass / 4 skip across 92 files (91 passing, one
external-S3 suite skipped; two external S3 and two native Docker backup/restore
cases not run). No failures; no retry/timeout/assertion relaxation. Fresh types,
lint, backend ESM build, unchanged 72-procedure/25461-byte API, 436-file boundaries,
44-document links and changed TypeScript formatting pass. README retains its
existing formatting convention, not a whole-file reformat. Live SMTP and staging
application remain unchanged; local Docker is still unavailable.

Ownership-checked cleanup completed: removed only the two disposable containers,
their synthetic SQL volume, isolated network and protected local/remote artifacts.
Fixtures can be recreated from tests; no real user data was removed. All four
staging containers remain healthy, API/web image stays at 12cfc8d, HTTPS returns
200; other applications retain their original uptime. Backend-only repair is
ready locally. No push/merge/deployment or real mailbox delivery performed;
test SMTP credentials/provider/network/rollout remain the explicit next checkpoint.

## 2026-10-07 — F5.1 create-intent key wiring (increment only)

Existing `admin.createPost` accepts an actor-scoped idempotency key; both editors
share `PostSaveCoordinator` but currently omit it. Connect that existing contract
without changing the API, authentication, uploads, update payload or storage.

1. RED: test UUID per independent creation, key retention for identical payload
   after a definite rejection, rotation for changed content/attachments, no key
   on updates, no browser-crypto access during construction, fail before dispatch
   when secure UUID support is unavailable, and no concurrent final create.
2. GREEN: generate the key lazily after all uploads are confirmed; retain its
   serialized final-payload identity in memory. A changed payload after a definite
   rejection starts a new intent. Never replay an unknown upload/update/create;
   the existing unknown-result and terminal-success guards remain in place.
3. Verify affected tests, types, lint, API/boundaries/docs and backend build;
   review the diff and record evidence. A fresh frontend production build/browser
   run requires enough local disk (currently <300 MiB free); do not delete user
   files or claim stale-build browser results as verification of this change.

Acceptance: actual create transport receives UUID, retries of identical confirmed
data keep it, edits and separate intents never inherit it. No persistent draft,
reload recovery or automatic replay is implemented by this slice: full F5.1
remains open. No push or rollout in this increment.

Verified: ten new coordinator cases (seven initial RED failures, then a separate
RED late-upload-after-confirmed-create case); 82 affected save cases pass.
Complete non-MySQL run: 711 pass / 4 skip. Curated verify: 251 pass. Fresh Next
production build: 28 routes, local disk-cache disabled only temporarily through
webpack; config restored with zero diff. Focused browser: 34 pass; full browser:
236 pass / 3 real-development-API skips, using fixtures rather than a real SQL API.
Types, lint, backend build, unchanged 72-procedure API, 456-file boundaries,
47-document links and formatting pass. Existing staging's eight read-only HTTPS
checks pass; no provider calls, migrations, writes, rollout or Git push.

Five-axis review: key created only at the final create boundary, before marking a
write dispatched; same-payload identity retained by value, not a mutable array
reference. The final guard rechecks completed/unknown/pending after asynchronous
uploads. Creation keys never leak into partial update payloads. Browser crypto
is lazy (no render/SSR access), no fallback to weak randomness. No dependency or
authentication change, browser persistence, telemetry of content or new storage
category. UUID plus payload comparison is the first F5.1 increment, not reload
recovery; the existing unknown-result prohibition is intentionally retained.

## 2026-10-07 — isolated public-video playback (approved scope)

User approved investigating and setting up a separate internet-enabled video
service; the main API must remain isolated. The current `/api/yt/:id` returns
502 because its configured yt-dlp executable is absent. Installing that binary
inside the isolated API alone cannot restore external playback.

Preflight on the staging host, without changing application containers:
official yt-dlp 2026.08.19 Linux executable verified against SHA-256
`58162f9bfdc27458ea47bfcb311cf47028f17d8154a8bf7d689861d46399230a`;
ran in a disposable, secretless, read-only container with CPU/memory/PID limits.
The first catalog video yielded separate H.264 video and AAC audio, not a combined
MP4. Bounded media reads confirmed HTTP 206 and MP4 signatures for video format
136 and audio formats 139 and 140-drc. Format 140 first timed out, then returned 503. Metadata extraction and 1 KiB reads do not establish complete downloads,
browser playback or reliable delivery across all 60 videos.

Proposed single capability: serve the existing public video player through a
separate non-root worker; combine video/audio without transcoding and keep only
an ephemeral, bounded cache (proposed hard filesystem limit: 384 MiB). This adds
first-load preparation latency. User approved this proposal on 2026-10-07;
implementation follows the three increments below. No worker deployment or
playback repair had been performed at the approval checkpoint.

Success criteria and boundaries:

- Existing `/api/yt/:id` supports GET/HEAD, byte ranges, actual playback with
  sound and seeking in a browser. Serve the existing local thumbnail route too.
- Check current publication through the existing anonymous `videos.list` API
  before external work or cached reads; fail closed if catalog reads fail.
  No arbitrary URL input or private/absent catalog video downloads.
- No DB credentials, SMTP keys, account cookies or application volumes in the
  worker; no access to the main isolated network. Reach the catalog through a
  dedicated internal edge/worker network; only the worker gets video egress.
- Bound downloads, preparation time, concurrency, memory and cache storage;
  discard failed/partial output. Do not expose signed upstream URLs in logs.
- Preserve API/web images, database, SMTP setup and payment prohibition. Rollout
  changes only the optional worker and edge, with protected rollback copies.

Approved increments:

1. Secretless worker and behavioral tests: deny unpublished/unknown IDs and
   unavailable catalogs; serve a prepared MP4 including ranges and HEAD; test
   failure cleanup, concurrent preparation and resource limits. Native Node
   tests, no new npm dependency, loopback fixtures rather than YouTube in CI.
2. Pinned downloader/runtime plus FFmpeg image and optional Compose/edge routing;
   validate non-root/read-only operation, topology and isolated API boundaries.
3. Back up edge/config, deploy only the accepted worker and edge, verify public
   HTTPS media data plus browser sound/playback/seek and unchanged payment blocks.
   Record actual results, limitations and rollback; do not infer success from
   metadata extraction or synthetic tests.

Delivery evidence: implemented the optional worker with no npm dependencies,
37 behavioral native tests and boundary rules rejecting API/database imports.
Full non-MySQL suite: 716 pass / 4 skip. Types, lint, backend build and unchanged
72-procedure API pass. The actual pinned Linux image passed native tests and
prepared the first public video through yt-dlp, FFmpeg streamcopy and ffprobe:
96,197,089 bytes, H.264 + AAC, duration 926.383311 seconds. Initial full
preparation took 21.473 seconds; the deployed cold request took 9.643 seconds.
These are observations, not a latency guarantee.

Deployed only worker `daryadarcy-video:2026-10-07-v1` and the optional edge routes;
API/web remain `5c4a9cc`, database and SMTP containers retain their uptime.
Actual HTTPS range requests return 206, thumbnail returns 200, unknown IDs 404,
payment routes 503. Browser playback advanced normally, then resumed after a
seek to 463.19 seconds and reached 478.44 seconds with readyState 4 and no error;
the verification tab was paused afterwards. Audio tracks were checked by ffprobe,
not physically listened to. All 60 videos and nationwide/VPN-free delivery were
not verified. Rollback and immutable image identity are in the operations guide.
No frontend change, SQL write/migration, remote Git push or staging-branch merge.

Five-axis review: publication is checked before fetching and after preparation;
only fixed provider URLs are accepted, and fail-closed catalog errors prevent
cached disclosure. Leases protect active files from eviction, abort/deadline
cleanup kills the process group, and resource limits are enforced inside a
non-root, secretless container. Public HTTP errors omit upstream stderr/URLs.
No new storage category or dependency in the application runtime. This remains
a bounded test adapter, not durable video hosting or a production CDN.

Fresh dependency audit: 1 critical / 35 high / 36 moderate / 4 low in the existing
workspace. The new worker does not install these npm packages. Current API
trust-proxy is `loopback`, not the incorrectly shortened IPv4-mapped IPv6 subnet
described in GHSA-jqcg-44mw-7w3h; a read-only compile check rejected public IPv4
and its mapped IPv6 form. This is scoped triage, not blanket clearance of the
existing dependencies. Follow up by 2026-10-08; production remains unapproved.

## 2026-10-07 — paper-style club testimonials

User requested that white/green messenger screenshots fit the existing paper
background. Replaced their inline presentation with selectable, accessible
verbatim excerpts in the incumbent cream/brown/Garamond visual world. Three
community and six review sources remain linked; only the three names visible
in the originals are attributed. Excerpts are explicitly labelled, not invented
or presented as complete transcriptions. Source images and all other content,
payment/subscription behavior, backend and generated API types remain unchanged.

Three browser cases failed on the original screenshot-only implementation, then
passed: readable text/source links at 390/1440px, no automatic screenshot fetch,
keyboard navigation and disabled endpoints. A missing default browser executable
was an environment error, not counted as RED; the installed browser was used.
Final production build: 28 routes; 49 selected browser checks pass, including
club pagination, photo loading, original-byte integrity and static caching.
Non-MySQL: 716 pass / 4 skip; types, lint, unchanged API and boundaries pass.
Two bounded visual rounds corrected the lower carousel's horizontal margins.
Quotes use ink on translucent paper, 44px controls, visible focus, native scrolling
and reduced-motion support. No dependency, tracking, raw HTML or remote data load
added. Existing screenshot-only style rules are retained for separate cleanup;
no unrelated deletion. Preview captures are outside Git. No push or deployment.

## 2026-10-07 — M06: club checkout service boundary

First billing migration slice: move the existing `club.createCheckout` use case
into a Nest-managed `ClubCheckoutService`, exported from `BillingModule` and
injected through TrpcService/router composition. The standalone router uses the
same implementation without starting Nest, listeners or workers.

Preserve input validation, actor/email matching, block checks, provider
configuration-before-writes, UUID orders, plan price snapshots and `{ url,
user: null }`. No checkout session, entitlement, external provider request,
schema/SQL/helper/dependency/frontend change. Checkout retries remain separate
orders; this slice does not add client idempotency or alter payment settlement.

Acceptance: router composition honors its supplied checkout service, not a
hidden global instance; real Nest HTTP resolves the same provider. Existing
checkout/config/signature tests must remain green. Verify public contract,
types/build, full non-MySQL suite and compiled ESM checkout fail-closed smoke.
Record SQL/provider coverage honestly: no MySQL or Prodamus sandbox acceptance
is claimed by this adapter-only slice. Cancellation, subscription reads,
webhook wiring and worker lifecycle remain later M06/M07 increments.

Verified: two composition regressions failed on the inline implementation;
76 focused cases pass after extraction. Real HTTP uses the application-scoped
provider; replacing it with a hidden new instance deliberately fails that test,
then passes after restoration. Compiled ESM preserves the injected boundary and
returns PRECONDITION_FAILED/412 with missing provider configuration, without
SQL/provider access. Full non-MySQL run: 723 pass / 4 skip. Types, lint, backend
build, unchanged 72-procedure/25461-byte API and 470-file boundaries pass.
The initial root pnpm test invocation rejected its exclude option before running
tests; the same configured Vitest suite was then run directly with that exclusion.

Five-axis review: one implementation for standalone and Nest callers; no service
locator or optional fallback. Order/auth/config/error semantics retained, no new
DB query or external effect, no pricing/account fields exposed. SQL transaction
helpers and webhook/cancellation remain unchanged, so this does not claim real
MySQL or provider sandbox acceptance. No new dependency, frontend/type-generation
edit, scheduled job, remote push, deployment or migration. Next slice is the
existing subscription read/claim/cancel use case, not new subscription behavior.

### M06 next slice: subscription service

Extract subscription status, the read-only claim compatibility endpoint and
provider-confirmed cancellation into `ClubSubscriptionService` in BillingModule.
Keep the existing helpers/transaction/worker/provider function, all protected
middleware and exact success/error shapes. Authorization still precedes protected
calls; blocked/anonymous public status stays unsubscribed. Group the two actual
billing dependencies by name at router composition, rather than expanding its
positional argument list. Verify injected reads/claims/cancel via real callers,
real Nest HTTP and compiled ESM; characterize service policy at the SQL/provider
boundary with controlled fixtures. No real cancellation, SQL/schema or workers.

Verified: three supplied-service composition cases failed before extraction;
all seven composition cases pass afterwards. Fifteen service characterization
cases retain explicit admin ownership, guest/blocked status, paid expiry,
read-only claim and confirmed-only cancellation. Eight real HTTP cases retain
session-derived ID, guest/blocked rejection and safe 500 errors. Deliberately
replacing the Nest provider with a hidden new instance fails three HTTP tests;
restoration passes. The compiled ESM smoke now checks both billing providers,
guest cancellation rejection and Date serialization. 31 slice-focused cases pass.
The first characterization run had two test-setup failures from referencing an
already-removed legacy activation export; replaced that invalid spy with a trap
on actual DB access. Those are not counted as production defects or TDD RED.

Full fresh non-MySQL suite: 753 pass / 4 skip. Root/frontend type checks, existing
frontend lint, backend build, unchanged 72-procedure/25461-byte API, 471-file
boundaries and 49-document checks pass. No backend ESLint coverage is claimed.
Service tests replace the SQL/helper boundary; HTTP/compiled tests replace session
and billing boundaries. They are not JWT/MySQL/provider sandbox acceptance.

Five-axis review: the router now owns validation/authorization only, and billing
owns its existing use cases. No hidden runtime fallback, service locator or
duplicated cancellation policy. Price remains a string; response/error shapes,
query count and transaction/provider ordering stay unchanged. No new dependency,
external send, state migration, frontend/generated-type edit, remote push or
deployment. Webhook/settlement/shop composition and worker lifecycle remain open;
this is not completion of M06 or production payment approval.

## 2026-10-07 — M06: native webhook ingress

Move only GET/POST `/api/prodamus/webhook` ownership to a BillingModule
controller, binding the existing verified handler through an application-scoped
factory provider. Keep raw 2 MiB parsing ahead of ordinary parsers, byte contents,
PHP-shaped payloads, signature/key isolation, existing status/text/security
headers and settlement/cancellation helpers. No new pass-through domain service:
the provider is a typed boundary to the current handler. Decomposition of its
business logic and shop migration remain subsequent increments.

Threat boundaries: untrusted provider body/signature versus entitlement and
durable receipts; browser return must remain non-authoritative. Do not replace
SQL receipt uniqueness with process-memory deduplication, relax configuration,
send external requests, edit frontend/types or deploy. Acceptance: HTTP uses the
application-bound handler rather than the legacy global closure, injected
handler sees original bytes (including >256 KiB), oversize requests fail before
handler work, compiled ESM preserves DI and existing signed-notification behavior.
Run existing webhook/billing tests and full non-MySQL gates; real SQL replay
acceptance requires a separately owned disposable database, not the test server.

Verified: two HTTP ingress tests fail on the old runtime-global closures and
pass with the application-bound provider. Four GET/implicit-HEAD compatibility
tests exposed a regression in the initial uncommitted migration: generic JSON
and form parsers interpreted bodies which legacy GET ignored, producing 400
instead of the signed query's 200/ignored. Root cause is the parser/handler ordering;
the narrow parser exclusion now preserves raw POST and query-only GET/HEAD.
These were local refactor regressions, not deployed production defects.

Fourteen new real HTTP cases cover handler binding, app isolation, original
bytes >256 KiB, 2 MiB rejection, query-only behavior, payment proof at the durable
SQL boundary, invalid signatures/merchant binding and safe failed settlement.
Compiled ESM checks unsigned rejection, a hand-signed pending event and injected
raw forwarding. Temporarily bypassing the provider in the controller makes the
raw-forwarding assertion fail; restored wiring passes. 72 focused cases pass.
SQL/helper boundaries are controlled in these tests: no real payment/SMTP request
or database replay/transaction acceptance. Local Docker reports remote-info EOF,
so disposable-MySQL tests remain unrun; test/production databases are untouched.

Five-axis review: one native route owner, no new pass-through service, fallback,
duplicate signature/settlement logic or process-memory replay cache. Typed
provider uses an app-scoped factory; parser exclusion is exact path/method only,
and existing security middleware remains first. Existing body limits, provider
verification, transaction/receipt helpers, result shapes and query count retained.
No dependency, new data collection, role/CORS/throttle/schema change, frontend
edit, provider send, remote push or deployment. M06 business decomposition/shop,
M07 lifecycle and production/provider/dependency gates remain open.

Final gates: 767 non-MySQL pass / 4 skip; root/frontend type checks, existing
frontend-only lint, 350.2 KiB backend build, unchanged 72-procedure/25461-byte
API, 472-file dependency boundaries and 49-document link checks pass.
No backend ESLint coverage or full MySQL/provider acceptance is claimed.

## 2026-10-07 — staging integration and shop order identity

User requested all prepared changes in staging, then backend continuation.
Fast-forwarded and pushed staging from 12cfc8d to 3183e89 (30 prepared commits
plus a browser-test locator correction). Remote SHA verified. Integration gates:
767 non-MySQL pass / 4 skip, 82 selected production-build browser cases and 37
video-worker tests pass; types, builds, frontend lint, API/boundaries/docs pass.
The initial browser run exposed an ambiguous status locator after testimonials
added two live counters. Scoped only the test to the session warning; UI unchanged.
Native dependency audit remains 1 critical / 35 high / 36 moderate / 4 low,
with existing isolated-test triage; no production approval or server deployment.

Continued from that SHA in backend/shop-checkout-hardening-2026-10-07. Shop's
two checkout paths used product + Date.now(), so concurrent buyers could receive
the same order identity, conflicting with the SQL unique constraint. Replace only
the timestamp suffix with Node's randomUUID(), as already used by club checkout.
Keep signatures, product prefix parsing (including historical orders), actors,
auth guards, prices, persistence and responses unchanged. No schema, dependency,
frontend source or settlement changes; unsafe shop payment remains hard-disabled.

TDD evidence: three real-router/loopback-HTTP tests fail with one identity instead
of two under a fixed clock, and pass after both generators change. Two validation
characterizations pass before/after. SQL write is controlled and the launch gate
is bypassed only in these tests to exercise dormant code; real disabled-feature
tests remain intact. This is not MySQL uniqueness or Prodamus sandbox acceptance.

Final gates for this increment: 772 non-MySQL pass / 4 skip, types and backend
build pass, unchanged 72-procedure API, 472-file boundaries and documentation
links pass. Five-axis review: two minimal generator replacements, no shared
abstraction or new side effects, independent concurrent cases catch reverting
either path, no new dependency, recipient data or payment-state mutation.
Shop settlement/outbox and configuration-before-write safety still need separate
increments before enabling payments; production dependency gates remain open.

## 2026-10-07 — shop checkout: validate before persistence

Continue backend only from 16d9d29. Both shop entry points persisted a pending
order before building its URL. Two expected TDD failures show a captured SQL
write despite invalid PUBLIC_APP_URL and a failed checkout. Moved URL construction
and its null/error handling before persistence; return/redirect still waits for
the write. Five-axis review: minimal order-of-effects correction, existing UUIDs,
actors, prices and responses retained, no extra queries, abstractions or grants.

774 non-MySQL pass / 4 skip; types, backend build, unchanged 72-procedure API and
472-file boundaries pass. SQL persistence is controlled in these cases, no actual
SQL/provider acceptance claimed. No frontend, schema, dependencies, launch-policy,
remote push or deployment change. Strict payform/signing configuration checks and
legacy error-log redaction are subsequent independent increments. Shared optional
skill checklist files are absent; repository gates and built-in review used.

## 2026-10-07 — shop checkout: fail-closed payment configuration

Validate the selected existing shop/club merchant before constructing a shop URL:
explicit HTTPS payform root, signing key, positive moneyMinor-compatible price
and configured safe callback origin. Dedicated shop key never falls back to a
different form when its configuration is incomplete. Existing explicit club-key
fallback and demo suffix remain compatible; neither enables shop payment.

23 expected RED cases reproduced unsigned/unsafe links, implicit merchant
defaults, invalid money, unclassified public-origin failures and whitespace URL
output. 24 builder cases plus two real-router/HTTP no-write cases now pass.
Three literal HMAC fixtures derived from an independent canonical payload prove
normal/demo/shop-to-club signing compatibility. Earlier invalid-origin test now
expects PRECONDITION_FAILED instead of an internal generic exception; legacy
HTTP keeps its existing generic 500 error/no redirect contract.

Five-axis review: one shop-owned policy point, no new service locator or reusable
framework; club subscription rules untouched. Domain-specific merchant/price
checks stay separate from club policy; shared URL-policy extraction, if needed,
must be a separate refactor. No extra SQL/provider calls, secret-bearing causes,
schema, API shape, frontend/generated files, dependencies or launch-policy change.
800 non-MySQL pass / 4 skip; types/backend build, unchanged 72-procedure API,
472-file boundaries pass. Shop settlement/outbox, owned catalog lookup and legacy
error-log privacy remain independent tasks; no production/provider acceptance,
remote push or deployment.

## 2026-10-07 — shop redirect: safe failure logging

Independent privacy increment: legacy checkout logged the original database
exception, which can contain recipient/SQL/payment parameters. One expected RED
HTTP case captures a synthetic private marker in console output. Log only the
stable failure message; retain generic 500/no redirect and do not suppress the
failure event entirely. The restored test passes without the private marker.

Final fresh Node 22 gates: 801 non-MySQL pass / 4 skip; types, 351.3 KiB backend
build, unchanged 72-procedure/25461-byte API, 472-file boundaries and existing
frontend-only lint pass. No backend ESLint claim. A preliminary run also passed
on the host's Node 23; repeated on the intended Node 22 before acceptance.
Native audit unchanged: 1 critical / 35 high / 36 moderate / 4 low. Local Docker
server query fails with EOF, so no disposable MySQL or live Prodamus acceptance
is claimed; no production readiness. Five-axis review: one sanitized error path,
no new abstraction, dependency, query, sensitive data collection, auth/CORS/quota
policy, frontend/schema edit, remote push or deployment. Continue with owned
catalog lookup, native shop service composition and validated atomic settlement
in separate increments. Online shop stays hard-disabled.

## 2026-10-07 — shop checkout: own catalog entries only

Continue backend only from 0c23918. User-controlled product IDs crossed a plain
object lookup: __proto__, constructor and toString resolved to inherited values
instead of unknown products. Twelve expected RED cases reproduce the helper,
builder, actual tRPC caller and loopback legacy HTTP failure paths. Restrict the
canonical lookup to Object.hasOwn and reuse it in URL construction. Unknown
products now return null/NOT_FOUND/404 before merchant configuration or writes;
known-product signatures, order IDs, capability policy and persistence stay intact.

Five-axis review: two production-line changes, one canonical validation point,
no added abstraction, dependency, query, financial grant, schema, auth policy or
frontend/generated-file edit. 140 focused checks pass. Fresh Node 22 whole-suite
repeat: 813 non-MySQL pass / 4 skip; types, backend build, unchanged 72-procedure
API and 472-file boundaries pass. Initial whole-suite run concurrent with types
hit the existing 5-second migration-command test timeout: 812 pass / 1 fail /
4 skip. That file passed alone (13 checks), then the complete unchanged command
passed without concurrent type/build work. No timeout/test-policy changes.

Read-only staging investigation: club.createCheckout returns edge 503;
PRODAMUS_SECRET is empty and both merchant form URLs are disabled placeholders.
This is not a ready subscription checkout; provider sandbox configuration and
full acceptance are still required. Shop additionally remains hard-disabled
until atomic settlement/outbox is validated. Local Docker still returns EOF;
no real SQL/provider acceptance, live payment, server mutation, push or deployment.

## 2026-10-07 — admin content maintenance: injected service ownership

User requested non-payment backend work while Prodamus demo access is pending.
Continue the existing M05 service migration, not a new endpoint or deletion
policy: admin.deletePost, admin.deleteMedia and admin.cleanupMediaNames now use
the existing application-scoped ContentWriteService. SQL remains in its current
helpers; do not duplicate the post cascade, introduce physical storage deletion,
change input validation or broaden administrator access.

Characterization baseline: 34 existing publication/native application checks
pass. New native HTTP tests first reproduce five expected RED failures when
routes bypass the supplied provider, then 23 pass after wiring; combined focused
run: 57 pass. Coverage includes resource IDs, unchanged void/ok responses, domain
refusal, guest/member/moderator/blocked-admin policy, malformed IDs and real
provider behavior without a database. Only session lookup and selected content
provider behavior are doubled for wiring; JWT, successful SQL deletion, SQL
rollback/concurrency and physical storage effects are not claimed as verified.
Existing cleanup behavior with no database is deliberately preserved as a no-op,
not reclassified as a new successful database maintenance operation.

Fresh Node 22 whole non-MySQL suite: 836 pass / 4 skip. Types, backend build
(351.4 KiB), unchanged 72-procedure/25461-byte API, 472-file boundaries and
existing frontend-only lint pass. No backend ESLint claim. Five-axis review:
three removed router-to-storage dependencies, existing injected service and
transaction helpers reused, no new lookup/global locator, dependency, query,
schema, authentication/CORS/quota policy or frontend/generated-file edits.
Remaining admin service wiring and real SQL acceptance stay open. No remote
push, shared-server mutation, deployment or payment configuration change.

## 2026-10-07 — MySQL backup: safe S3 failure diagnostics

Non-payment backend follow-up from b53c472. Trace: external S3 transport rejects
with an arbitrary error object -> upload/prune orchestration catch -> raw
console.warn arguments, including message, nested cause and request metadata.
Three synthetic-marker cases reproduce disclosure on upload, list and delete
failures. This proves a logging risk, not a discovered production-key incident.
Keep the existing warning prefixes, but never pass the external error object.
No new generic logging layer, SDK metadata allowlist or error serialization.

Characterization baseline: 13 backup checks pass / 2 native MySQL skip. After
three expected RED failures, focused run: 16 pass / 2 skip. Tests replace only
the external S3 send boundary and existing dump-tool fixture; process lifecycle,
pipes, gzip, SDK command construction, local retention and credential cleanup
remain real. Assert command inputs outside the transport stub so swallowed
assertions cannot masquerade as expected S3 failures. A complete local copy
survives each error, local expired-copy cleanup still runs, and failed upload
does not suppress the existing S3 retention attempt. All data and files are
synthetic; no actual database dump, external upload or real S3 deletion.

Fresh Node 22 gates: 839 non-MySQL pass / 4 skip; types, 351.4 KiB backend build,
unchanged 72-procedure/25461-byte API, 472-file boundaries and existing
frontend-only lint pass. Five-axis review: two existing failure paths only;
warnings retained, SDK errors not stringified or attached as causes, backup
schedule/retention/locking/lastBackupAt behavior unchanged. No frontend, schema,
dependency, authentication, payment, shared-server, remote push or deployment
changes. Native MySQL option parsing/restore and real S3 acceptance not run;
off-site retry/durability, worker lifecycle and production restore stay open.

## 2026-10-07 — admin video import: injected content service

Continue non-payment backend work from b272823. Move admin.importVideos metadata
mapping and persistence orchestration out of the tRPC router into the existing
Nest-managed ContentWriteService. Extract the existing Zod schema unchanged;
derive the service input from its validated output instead of duplicating a
wire type. This is service wiring, not new import functionality or a SQL repair.

Characterization baseline: 67 focused checks pass before production changes.
Two additional native HTTP cases first fail because the old router bypasses
the supplied provider; all 69 focused checks pass after wiring (35 in the admin
maintenance file). Twelve new cases cover injected outcome/refusal, ordered
metadata, missing values as null, preserved empty strings/title whitespace,
helper count rather than input length, empty input, malformed metadata,
guest/member/moderator/blocked-admin refusal and safe persistence errors.
Unknown client fields remain stripped; existing published/videoUrl values and
authorization are unchanged. Session lookup and selected provider or SQL helper
are doubled; real HTTP/composition/validation/error formatting run locally.

Fresh Node 22 gates: 851 non-MySQL pass / 4 skip; types, 351.7 KiB backend build,
unchanged 72-procedure/25461-byte API, 473-file boundaries and existing
frontend-only lint pass. No backend ESLint claim. Five-axis self-review:
reuse the existing injected service, no service locator, schema tightening,
extra query, dependency or authentication/CORS/quota policy change; await the
existing helper and propagate failures without inventing successful imports.
Remaining admin wiring stays open. Docker returns EOF, so actual MySQL writes,
check-then-insert deduplication, concurrent imports and rollback are not verified
or fixed here. No frontend/generated-file edits, payment configuration,
shared-server mutation, remote push or deployment.

## 2026-10-07 — notification token lifecycle: approved M08 slice

Objective: continue the Nest service migration with one coherent notification
boundary, without changing device registration or marketing-consent policy.
Scope approved by the user's "Да, делаем" before implementation: registerToken,
marketingConsent, setMarketingConsent and admin.purgeUserPushData. Real push
delivery, notifications.latest content reads and worker lifecycle are excluded.
Assumptions: retain the current public registration endpoint, protected consent
endpoints, admin-only purge, blocked-session policy and all existing Zod schemas.
Do not broaden access or represent missing-DB no-ops as verified persistence.

Contract: registerToken passes the validated token/platform and optional session
user ID; the client cannot set the owner. Consent reads use the session ID and
return enabled plus the current shared label/version. Consent writes append the
existing marketing granted/revoked event with that same label/version/platform,
then return success/enabled. Purge awaits deletion for its validated target ID
before returning success. Helper failures propagate through the existing safe
HTTP formatter. Keep SQL queries, token upsert semantics and no-DB behavior.

Structure: NotificationsModule exports NotificationsService; TrpcModule injects
it explicitly and router factories receive it as a mandatory dependency. Keep
standalone tools on the same factories. The service owns these use cases and
their responses; adapters retain input validation and authorization. Example
style: `@Inject(NotificationsService) notifications: NotificationsService`;
no hidden singleton, optional fallback or new generic repository abstraction.

Ordered tasks: (1) characterize current HTTP behavior with synthetic data;
(2) prove service-bypass failures, wire the provider and update composition
fixtures; (3) full/static gates, five-axis review, recorded limits and local
atomic commit. Existing Vitest/Nest/tRPC/Drizzle/esbuild stack, no dependencies.
Verification commands (Node 22 PATH; database envs empty for local-only tests):
`pnpm exec vitest run tests/nest-notifications.test.ts tests/nest-admin-content-maintenance.test.ts tests/nest-application.test.ts tests/push-transport.test.ts`;
`pnpm exec vitest run --exclude "**/*.mysql.test.ts"`;
`pnpm check && pnpm build && pnpm check:api && pnpm check:boundaries && pnpm lint && pnpm check:docs`.
Always preserve contracts, run tests before commits and review exact staged files.
Ask first for auth/quota/consent/schema/dependency/provider changes. Never edit
frontend/generated types, commit secrets, send real push, mutate shared data or
deploy in this increment. SQL transport and session lookup may be doubled;
actual JWT/MySQL persistence/provider acceptance remains a separate gate.
This approved slice preserves behavior; it does not approve new consent/auth
policy, external delivery or deployment.

Execution: 24 new characterization checks pass before production changes;
four expected RED composition cases reproduce all four routes bypassing the
supplied notification dependency. After explicit wiring, 32 slice checks and
128 combined focused checks pass. Replacing the supplied provider with a hidden
new instance deliberately fails all four native HTTP refusal assertions; the
mutation is removed before final verification. Three existing caller fixtures
now supply the required notification dependency; their expectations are intact.

Fresh Node 22 gates: 883 non-MySQL pass / 4 skip, types, 353.6 KiB backend build,
unchanged 72-procedure/25461-byte API, 476-file dependency boundaries and existing
frontend-only lint pass. No backend ESLint claim. A separately compiled ESM
probe starts the native application, exercises all four operations without a
database and receives HTTP 409 from the actual injected notification provider.
Only synthetic session lookup/provider refusal is substituted there; these
success/no-op responses do not prove durable writes. Generated probe artifacts
are removed; no listeners or workers are left running.

Five-axis self-review: four router-to-storage use cases now share one explicit
notification owner, with no new repository layer, locator, dependency, query,
token upsert change, legal-copy change or authorization/CORS/quota policy.
Service responses retain boolean wire types; writes await their existing helper
and safe HTTP errors are preserved. notifications.latest remains unchanged in
the adapter; SQL ownership, no-database write policy and real token/consent
persistence acceptance remain open. Docker server read returns EOF; no real
JWT/MySQL replay, Expo/device delivery or production readiness is claimed.
No frontend/generated-file, payment configuration, shared-server, remote push
or deployment changes. Save this coherent slice as a local atomic commit.

## 2026-10-07 — notifications.latest: M08 content-read slice

Continue the existing backend migration with one unchanged public read. Move
notifications.latest orchestration into the existing ContentReadService, passed
explicitly to the notification router by the existing composition root. This
removes storage/access orchestration from the HTTP adapter without another
provider, repository, service locator or standalone fallback.

Contract: read the latest published feed first; only then check the optional
session user through the canonical userHasClubAccess policy and read club
content if permitted. Guests, unpaid members and blocked users receive no club
ID/text; staff retain current access. Return exactly feedId/feedText/clubId/
clubText, preserving null IDs, empty text and nullish (not truthy) defaults.
Keep helper ordering, missing-DB defaults and safe error formatting; no SQL,
auth, schema, payment, quota, dependency or frontend/type changes.

Verify current behavior over native HTTP before implementation, then reproduce
provider bypass with injected outcome/refusal tests before wiring. Run focused
and whole non-MySQL suites serially, types/build/API/boundary/lint/docs gates and
five-axis self-review before a local atomic commit. Session lookup and selected
SQL helpers may be doubled; these checks are not real JWT/MySQL acceptance.
Docker server read currently returns EOF. No shared-server mutation, deployment
or remote push in this slice; real persistence and worker tasks stay open.

Execution: 16 added characterization cases pass before production changes
(48 notification checks total). Two native HTTP RED tests then reproduce the
old adapter ignoring the actual injected content provider's outcome/refusal.
After wiring, all 50 notification checks and 123 focused checks pass. Coverage
includes guest/unpaid/paid/staff/blocked access, query order and session user ID,
independent absent feed/club defaults, zero IDs/empty text, no-DB defaults and
safe failures at feed, membership and club reads without partial content.

Fresh Node 22 gates: 901 non-MySQL pass / 4 skip; types, 353.7 KiB backend build,
unchanged 72-procedure/25461-byte API, 476-file dependency boundaries, existing
frontend-only lint and documentation links pass. No backend ESLint claim.
Five-axis self-review: reuse the existing content owner and canonical club
policy, keep the adapter declarative and require its supplied dependency; no
hidden instance, extra query, parallelization/error-priority change, new layer,
dependency or schema/auth/quota change. Only superseded router imports are
removed; previously deferred db.ts dead-code cleanup stays untouched.

Native HTTP uses the real Nest composition, tRPC transport and error formatter;
session lookup and SQL helper boundaries are substituted for synthetic tests.
MySQL publication filters/ordering, expiry calculations, durable persistence
and real JWT sessions remain separate acceptance gates, not proven by these
fixtures or missing-DB responses. Docker server read still returns EOF. No
frontend/generated-file, payment configuration, shared-server, remote push or
deployment changes; save the reviewed slice as a local atomic commit.

## 2026-10-07 — profile use cases: M08 service slice

Keep profile.update, profile.uploadAvatar and
profileExtras.requestAccountDeletion on the same protected procedures and exact
wire schemas. A small ProfileModule exports ProfileService to TrpcModule;
explicit router factories receive that required service. The service owns
profile mutation orchestration, not sessions, SQL internals, photo decoding or
retention policy. Extract the existing update schema for its inferred input
type; keep photoInput/uploadPhoto as the canonical photo boundary.

Contract: always use the session user ID, strip unknown client ownership/role
fields and preserve partial/empty updates and name whitespace. Avatar decoding
and storage complete before writing the resulting URL to that user's profile;
client filename/MIME never select the key or persisted URL. Await existing
helpers before returning unchanged success/url/ok responses; propagate errors
through the safe HTTP formatter. Request deletion only records a request, not
immediate erasure. Retain current missing-DB differences: update no-op versus
deletion failure; do not present no-ops as persistence acceptance.

First characterize native HTTP ownership/validation/ordering/access/errors with
synthetic sessions and SQL/storage boundaries, retaining the real photo decoder.
Then reproduce supplied-service bypass before implementation, wire the domain
and update explicit composition fixtures. Full non-MySQL/static/API/docs gates
and five-axis review precede a local atomic commit. No new upload endpoint,
provider, dependency, sensitive-data category, authorization/schema/retention
policy, frontend/generated-file edit, payment work, remote push or deployment.
Real JWT/MySQL/S3 acceptance remains separate from local fixture evidence.

Execution: initial characterization had seven upload-path failures because
the fixture doubled only the tRPC session lookup, not the earlier SDK identity
lookup. Tracing request-bodies admission established its separate raw HTTP
401/403 contract before parsing. Supply both synthetic identity lookups and
assert that raw contract without changing production admission/authorization.
All 18 characterization checks then pass before production changes.

Three expected RED composition cases reproduce all profile operations ignoring
the explicitly supplied profile dependency. After wiring the service/module,
24 profile checks and 128 focused checks pass. Replacing the supplied dependency
with a hidden new ProfileService instance deliberately fails all three native
HTTP refusal tests; restore the supplied instance before final verification.
Three existing composition fixtures now supply the required profile dependency;
billing/notification expectations and runtime business logic are untouched.

Five-axis self-review: profile-specific writes share one explicit domain owner,
not the content/session service; transport retains schemas and protected access,
while canonical photo decoding retains its limits, server-owned UUID/WebP key,
EXIF stripping and upload-before-update sequence. No new external service,
upload endpoint, extra SQL, schema, auth/quota/retention policy or repository
layer. Preserve success's boolean type and deletion's literal true type.
The first type gate catches an excess-property test literal; use a variable for
the same ownership-spoofing HTTP input, without casts or weakened assertions.

Known limitations remain explicit: missing-DB profile writes still report a
legacy no-op success, failed avatar SQL writes leave the previously uploaded
object, and deletion only records a request. Do not call those policies fixed,
durable erasure verified or this migration production-ready. Actual JWT/MySQL
and S3 acceptance need isolated dependencies; Docker server read returns EOF.
No frontend/generated-file, payment/provider, shared-server, push or deployment
changes. Final verification counts are recorded after the last test edit.

Final fresh Node 22 verification: 925 non-MySQL pass / 4 skip; types,
355.2 KiB backend build, unchanged 72-procedure/25461-byte API, 479-file
dependency boundaries, existing frontend-only lint and documentation links pass.
No backend ESLint or real persistence claim. Update the backend navigation and
record remaining profile acceptance/policy tasks without closing M08 or rollout.

## 2026-10-07 — profile persistence: reject missing-database success

Fix the separately recorded false-success bug, not another refactor. Inspection
of both ProfileService callers shows updateUserProfile returning normally when
getDb is null; both await it and then return success/a new avatar URL. Make the
existing persistence boundary throw in that case, like deletion requests and
other required writes. Keep the safe HTTP 500 formatter and all successful
response types, schemas, session ownership, upload admission and SQL unchanged.
An empty profile patch still requires an available database; with a database
its existing no-op behavior remains unchanged.

Replace the legacy no-DB success characterization with native HTTP regression
checks for a nonempty patch, empty patch and avatar upload. Exercise the actual
missing-DB helper, not a mocked helper failure. Only identity lookups and avatar
storage are doubled; retain the real photo decoder. Observe false-success RED
results before the smallest persistence-boundary fix, then run focused/full
non-MySQL and static/API/docs gates and five-axis review before a local commit.

This intentional failure-path change prevents misleading success; it does not
prove durable writes, detect zero affected rows or introduce storage rollback.
Avatar storage still precedes the DB write and can leave an orphan on failure;
that needs its own ownership/cleanup design. Docker server read returns EOF.
No frontend/generated-file, payment, auth/quota policy, dependency/schema,
shared-server, remote push or deployment changes in this slice.

Execution: all three new regression cases fail for the expected false-success
reason before the production change, while the other 23 profile cases pass.
Replace only the missing-DB return with an error at the shared write boundary.
All 26 profile checks and 70 focused checks then pass; fresh full non-MySQL
verification passes 927 checks with 4 skipped. No timeout or assertion changes.

Fresh Node 22 gates: types, 355.2 KiB backend build, unchanged
72-procedure/25461-byte API, 479-file dependency boundaries and the existing
frontend-only lint pass. Documentation links are checked after these notes.
No backend ESLint, real JWT/MySQL/S3 acceptance or release-readiness claim.

Five-axis self-review: correctness is exercised through native HTTP with the
actual absent-DB helper; the service already awaits writes. The one-line failure
is explicit and readable, and belongs to the existing persistence boundary,
without duplicate transport/service guards or a new abstraction. Session
ownership, upload admission and safe error formatting remain unchanged; the
warning stays static, with no secrets or user data. There are no extra queries
or runtime dependencies. Empty patches with an available DB and the existing
upload order are unchanged. Orphan cleanup and zero-row detection remain open;
do not close M08 or the rollout gate on this local regression fix.

## 2026-10-07 — avatar preflight before external storage

Tracing uploadAvatar confirms the photo helper writes an object before the
profile helper discovers getDb is null. Storage has no canonical delete API;
more importantly, a SQL error/timeout can leave the write outcome unknown.
Do not delete an object blindly on any SQL exception: it might be referenced by
a committed profile. Reliable compensation/reconciliation needs a separate
durable ownership/outcome design and supported provider deletion semantics.

Small safe slice: the profile use case checks the existing DB client before
starting photo decoding/storage. Null or rejected client acquisition must yield
the existing safe HTTP 500 with no storage side effect. This only establishes
client availability/configuration, not a live connection or successful future
write. The actual write still performs its own check. A configured DB retains
the canonical photo validation, UUID/WebP storage and upload-before-write order.
With no DB, byte-level photo validation now follows the preflight and therefore
returns 500; transport schema/admission/ownership remain unchanged.

Tests first: strengthen the real no-DB HTTP avatar case to assert zero uploads,
add a rejected-acquisition case, and retain configured-path tests using the
installed Drizzle mock builder (no network) plus existing SQL/storage doubles.
Observe expected RED failures, implement the minimal guard, run focused/full
non-MySQL tests and static gates, then review and commit locally. No frontend,
generated types, storage deletion, old-avatar cleanup, provider integration,
schema/dependency changes, push, deployment or shared-server writes.

Execution: both preflight HTTP regressions initially report one uploaded object
instead of no side effects (38 other checks pass). Add an awaited client guard
in the profile use case before calling the canonical photo helper. All 27
profile checks and 71 focused checks pass. The configured path keeps byte
validation, sanitization, actor-owned keys, upload-before-write ordering and
safe storage/SQL failures. Fresh full non-MySQL run: 928 pass / 4 skip.

Five-axis review: the guard prevents the known absent-client failure before
external effects, but makes no connectivity/commit claim; explicit comments
record that boundary. The existing domain owner orchestrates the guard, with
no new abstraction or changes to shared photo/storage/SQL helpers. No deletion
target, auth/admission/quota change, PII logging or provider response trust is
added. Cached acquisition adds no probe/query; unavailable-client requests avoid
decoder/storage work. Ambiguous SQL outcomes and zero-row writes remain open.
No newly unused code or unrelated cleanup.

Fresh Node 22 gates: types, 355.3 KiB backend build, unchanged
72-procedure/25461-byte API, 479-file dependency boundaries and existing
frontend-only lint pass. Recheck documentation links after the final notes.
No backend ESLint, live MySQL/S3 test or dependency-audit/release claim.

## 2026-10-07 — notification writes reject absent-database success

Inspection traces three awaited NotificationsService writes to db.ts helpers
that return normally when getDb is null: registerPushToken, logPushConsentEvent
and deletePushTokensForUser. The API then reports success without registering a
device, recording a grant/revocation or purging any tokens. Fix this separately
recorded M08 no-DB write policy at those existing persistence boundaries only.

Contract: absent DB yields the existing safe INTERNAL_SERVER_ERROR / HTTP 500,
not {success:true} or a claimed new consent state. Preserve successful response
types, validation, public guest registration, session ownership, admin-only
purge, legal metadata and all configured SQL/upsert/delete behavior. Read-side
false/empty no-DB defaults and recipient selection remain unchanged (fail-closed
delivery); do not add retries, actual sending or a consent/authorization policy.

First replace legacy no-DB write characterization with native HTTP regressions
covering guest/member registration, grant, revocation and admin purge. Run the
actual missing-DB helpers with blank DATABASE_URL; only session identity is
doubled. Keep the no-DB read default check. Observe expected false-success RED
before the three minimal guards; run focused/full non-MySQL, static/API/docs
gates and five-axis review, then commit locally. This does not establish real
SQL writes, atomic consent ordering, token ownership under races or device
delivery. No frontend/generated types, payments, worker/provider, dependencies,
schema, shared-server, push or deployment changes.

Execution: five expected RED cases resolve success/claimed enabled state
instead of rejecting; the other 47 notification checks pass. Replace only the
three null-DB early returns with errors. Final notification suite 52 pass,
three focused suites 100 pass and full non-MySQL 930 pass / 4 skip. Existing
ownership, input, role, legal-copy and generic SQL-error checks also pass;
no timeouts/assertions weakened. Docker server read still returns EOF.

Five-axis review: the helpers now reject instead of hiding an absent write,
and all three service callers already await them. Explicit failures use the
existing persistence boundary, without new service guards, abstraction, dead
code or materially growing db.ts. No new PII logging, provider request, auth,
consent/retention policy or elevated access. Configured SQL and read-side
fail-closed selection are unchanged; no additional query or runtime dependency.
Real SQL upsert/event ordering/delete acceptance remains open, as do delivery
and N12 worker lifecycle. This is not a production-readiness/erasure claim.

Fresh Node 22 gates: types, 355.4 KiB backend build, unchanged
72-procedure/25461-byte API, 479-file dependency boundaries, existing
frontend-only lint and links in 49 current documents pass. No backend ESLint
or dependency-audit/release claim.

## 2026-10-07 — moderation IDs validated before mutations

Inspection: moderation schemas accept any finite number for reportId,
commentId and userId, although schema primary keys are integer auto-increment
IDs. Fractions, zero, negatives and unsafe integers reach deletion/blocking
helpers and audit logging instead of being refused at the request boundary.
Keep this input bug fix separate from M08 service migration and audit atomicity.

Require positive safe integer numbers on dismissCommentReport.reportId,
deleteReportedComment.commentId/optional reportId and blockUser/unblockUser.userId.
Invalid values yield BAD_REQUEST / HTTP 400 before any mutation/audit helper.
Keep optional reportId optional and its existing ignored behavior, successful
{ok:true} responses, reason trimming, actor from session, moderator/admin rights,
SQL/transactions and missing-positive-ID semantics unchanged. No coercion or new
role/authorization rule; no claim that a well-formed ID exists in the database.

Use native HTTP tests with synthetic complete users and persistence-boundary
doubles: 20 invalid-number cases must fail RED against the existing router;
valid moderator/admin calls preserve exact target/actor/audit order, optional
omission and role refusal. Then implement only the schemas, run focused/full
non-MySQL and static/API/docs checks, review all five axes and commit locally.
No frontend/generated types, payments/provider, real destructive operations,
schema/dependencies, remote push or deployment. Real JWT/MySQL audit consistency
and moderation service migration remain separate tasks.

Execution: 20 invalid-number HTTP regressions initially resolve {ok:true}; the
25 valid/role characterization checks pass before the fix. Tighten only the
five ID schemas with int/positive constraints; do not coerce values or alter
handlers. Slice 45 pass, four focused suites 85 pass; fresh full non-MySQL
975 pass / 4 skip. No assertions or timeouts weakened. Docker server read EOF.

Five-axis review: boundary schemas reject impossible/unsafe IDs before helper
side effects, while native HTTP checks retain role gates, target/actor and audit
order. Small explicit constraints belong in the current router, not a generic
ID framework or duplicate SQL guard; no new runtime abstraction or unused code.
No auth policy, elevated rights, PII logging, external request or destructive
operation is added. Invalid calls avoid SQL/audit work; valid calls perform the
same work. Type shapes remain numeric and unchanged, but invalid-value acceptance
intentionally changes. Well-formed IDs do not prove existence, transaction/audit
atomicity, real JWT/MySQL acceptance or production readiness.

Fresh Node 22 gates: types, 355.5 KiB backend build, unchanged generated
72-procedure/25461-byte API, 479-file dependency boundaries, existing
frontend-only lint and links in 49 current documents pass. No backend ESLint
or dependency-audit/release claim. No frontend/generated edits or deploy.

## 2026-10-07 — approved YooKassa test checkout for club access

### Objective and approval boundary

The user approved one-off test club payment followed by access, without saving
cards or automatic renewals. Shop payments, real-money payments, refunds and
recurring YooKassa subscriptions are outside this stage. The user approved this
plan and the additive checkout-intent table on 2026-10-07. Enabling the test stand
remains a separate checkpoint. Existing incomplete project tasks are retained.

### Contract and architecture

- Keep Prodamus unchanged while the test adapter is disabled. No fallback to a
  live provider on error. Add a client-generated UUID intent key in the HTTP
  `Idempotency-Key` header (not the tRPC input),
  required only in YooKassa test mode. Preserve `{url, user: null}` and existing
  actor-email/blacklist checks; checkout never authenticates or verifies email.
- Claim the key atomically in a proposed `billing_checkout_intents` table with
  unique intent/order/provider-payment bindings. Persist recipient, test shop,
  price, access period, immutable request hash/payload, first dispatch time and
  processing state before calling out. Same key + changed body is a conflict.
  Concurrent requests cannot dispatch independent payments. No card data, raw
  provider dump or secrets in logs/Git; confirmation links are sensitive.
- Use fixed YooKassa HTTPS origin and validated IDs, no redirects, bounded time,
  response bytes and concurrency. Validate the account and each payment, requiring
  the configured shop and `test: true`; reject live keys. Create a one-stage
  redirect payment with `capture: true`, without a saved payment method. Persist
  provider ID before returning the validated URL. Metadata contains an opaque
  order ID, not email or authority to grant access.
- Network errors/HTTP 500 mean unknown outcome. Recover with the exact stored
  request/key only within a conservative window shorter than YooKassa's 24-hour
  idempotence guarantee. Never re-dispatch an unresolved older intent; reconcile.
  If provider ID is known, recover by GET, not by creating another payment.
- A webhook is a hint for an authenticated GET, not proof. Check ID, shop, test,
  amount, RUB, persisted order binding, `succeeded` and `paid`. Do not acknowledge
  transient verification/DB failures as successful processing. Handle webhook
  arrival before the create response is persisted, without issuing unbound access.
- Reuse atomic receipt + entitlement + outbox settlement with a test-specific
  provider namespace/order prefix. Browser return never grants access. A duplicate
  webhook never extends it again. Persist 30-day/180-day duration with the intent;
  do not derive it from mutable configuration. Old Prodamus cancellation/profile
  logic must not process YooKassa one-off orders. UI must label a one-off test
  purchase, not promise automatic renewals.
- Preserve API isolation: separately design bounded payment-only egress before
  rollout. Retain DB/SMTP/video/image services and old live-payment blocks.
  Configure HTTP notifications in the test shop's cabinet, not via Basic-auth API.

### Ordered slices, acceptance and commands

1. Y1 — HTTP/configuration boundary under `apps/backend/src/billing/yookassa/`
   and focused Vitest tests (2–4 files). Reject wrong shop/live responses and
   unsafe URLs; bound reads/time, redact errors. Test first with boundary-only
   transport doubles; no network in unit tests. No new SDK/dependencies.
2. Y2 — additive SQL/repository and disposable-MySQL tests (3–5 files), after Y1.
   Prove conflicts, concurrent retries, restart recovery and refusal of expired
   unknown outcomes. Schema approval precedes edits; migration rehearsal and
   preflight precede target DB changes. Never rewrite historical migrations.
3. Y3 — Nest checkout/webhook wiring and settlement (split into 3–5-file slices),
   after Y2. Test forgery, mismatched shop/amount/currency/test flag, blocked
   recipients, early webhook, transaction rollback and replay. Characterize
   existing Prodamus behavior. Checkpoint: review before caller/rollout work.
4. Y4 — caller contract handoff, after Y3. Retain the same intent through retry
   and reload, including timeout; do not create a key per attempt. Frontend edits
   require their own agreed scope, generated contract and browser checks.
5. Y5 — separately approved staging rollout, after Y4: protected backup,
   rehearsed migration, scoped egress/edge changes, cabinet notifications and
   exact image rollback. Real sandbox acceptance must prove payment → access,
   eventual access email and duplicate replay without extra receipt/outbox/period.

Use Node 22, committed pnpm 9.12.0 lockfile, existing Nest/Drizzle boundaries,
strict TypeScript and Zod. Example: `{ email, plan }` plus `Idempotency-Key: <UUID>` enters checkout;
`{ url, user: null }` leaves it. Recipient/price remain server-owned.

Run `pnpm exec vitest run tests/yookassa-*.test.ts` per slice, then `pnpm check`,
`pnpm build`, `pnpm check:api`, `pnpm check:boundaries` and `pnpm check:docs`.
Run SQL tests only under the repository's disposable `backend_test` policy.
Mocked tests are not SQL/provider acceptance. Run native `pnpm audit`, triage
reachable critical/high issues before release; never force dependency upgrades.
Build/test frontend only if changed. Do not reset staging data or claim production
readiness. Migration-history discrepancies remain a deployment gate.

References checked 2026-10-07: [request format and 24-hour idempotence](https://yookassa.ru/developers/using-api/interaction-format),
[payment lifecycle](https://yookassa.ru/developers/payment-acceptance/getting-started/payment-process),
[webhook verification and cabinet setup](https://yookassa.ru/developers/using-api/webhooks).

Implementation refinement: use the standard HTTP header so generated frontend
types and the existing procedure schema stay unchanged. Test mode still requires
a stable caller key; the current UI cannot enable this flow without its separate
caller work. Unconfirmed terminal notifications return 503 for provider retry.

### Approved staging baseline transition — 2026-10-07

The user approved a protected backup and restore rehearsal before updating the
existing test stand. The observed database is `daryadarcy_staging`, 28 InnoDB
tables, without `__drizzle_migrations`; the initial canonical-schema baseline
already includes the changes in historical migrations 0017–0025. Replaying those
files or inserting fictional historical execution records is forbidden.

This is a narrow operator workflow for this one baseline, not a replacement for
production migration history. Keep the generic Drizzle preflight and historical
SQL bytes unchanged. A separately named stage-only upgrader will validate the
database name, full normalized SHOW CREATE TABLE fingerprint, exact 0026 SQL
SHA-256, and absence of views/triggers/routines/events. It permits only creation
of `billing_checkout_intents`; any unrelated schema drift fails closed. Serialize
operators with a MySQL advisory lock. MySQL DDL autocommits: on a lost response,
inspect the exact resulting schema on retry, never DROP/recreate an existing table.
The operator saves an actual-time release receipt outside the DB; no invented
Drizzle rows and no acceptance of arbitrary SQL, schema hashes or bypass flags.

Order and acceptance:

1. B1: owner-only config copies and consistent SQL dump, then restore into a
   separate memory/CPU-bounded MySQL container with no published ports/application
   workers. Compare every table's normalized DDL, counts and row digests inside
   the private server boundary; publish only aggregate verification. Preserve the
   protected backup, working volumes/services and rollback image IDs.
2. B2: tooling/operations stage-only policy + CLI and tests (at most four files).
   Test wrong DB/schema/SQL, unexpected executable objects, existing exact table,
   lock contention and DDL failure. Rehearse against the restored copy, proving
   original-table data unchanged. Use real MySQL, not a mocked SQL execution claim.
   Commands: `pnpm exec vitest run tests/staging-baseline.test.ts`,
   `node tooling/operations/staging-baseline-upgrade.mjs` (read-only default).
3. Checkpoint: only after backup restoration and B2 checks pass, apply the same
   allowlisted additive DDL to the test stand, keep payments disabled and verify
   guest smoke. Record source/target fingerprints and actual execution time.
4. Continue Y4 caller and Y5 scoped payment egress/notification/real-sandbox
   acceptance afterwards. No production, live payment, old migration replay,
   destructive DB reset, new dependencies or unrelated frontend-branch merge.

Code style: portable ESM operational scripts, fixed SQL and generic redacted
failures; e.g. `{ mode: "read-only", state: "pending", releaseApproval: false }`.
Tests belong in `tests/`; execution/rollback evidence belongs in the existing
operations guide. A successful baseline update is not successful payment rollout.

Execution: protected fresh dump restored twice into a separate MySQL 8.4, with
28 original-table definitions, 833 row digests and 24 auto-increment counters
verified against the dump. Native rehearsal proves CREATE and unchanged old
data, then repeat without DDL. Advisory-lock contention refuses execution;
SELECT-only fault account causes CREATE refusal, and the normal-privilege retry
succeeds. Only the empty new table on the disposable copy was reset for that
fault fixture; no working table was dropped. Unit/CLI RED→GREEN reaches 47
checks, four migration suites 78 pass; full local suite 1070 pass / 596 SQL or
external-resource skip. No assertion/TTL/timeout weakening or new dependencies.

The exact allowlisted SQL was applied to staging at 2026-10-07T17:17:59Z.
Post-verification: 29 tables, 833 old rows and old definitions unchanged,
zero intents, no invented historical ledger. All six existing services remain
healthy on their original images; eight guest smoke checks pass, including
payment routes still returning 503. Five-axis review retains the production
history block and existing dependency findings (51: 1 critical / 20 high /
26 moderate / 4 low); no network/routing or runtime exposure changed by this DB
step. Y4 caller, payment-scoped egress, merchant notifications and actual sandbox
payment/email acceptance remain open. Cabinet was opened at its login page;
authentication is a user action, not something the API key can replace.

### Payment-only egress slice — 2026-10-07

Cabinet inspection in Safari confirms test shop 1489524 now sends only
`payment.succeeded` and `payment.canceled` to the approved staging webhook URL.
The handler/caller are not deployed and this is not payment acceptance.

Before changing any working service, exercise an opt-in nginx stream gateway
and isolated Node probe on disposable Docker networks. The internal DNS alias
`api.yookassa.ru` points at the gateway; its fixed upstream resolves using explicit
external DNS, not Docker's self-referential alias. Require exactly that TLS SNI,
reject plaintext/other SNI, retain end-to-end Node certificate verification and
disable upstream retry. No TLS termination, secrets, generic CONNECT proxy,
published port, or API attachment to an external network. Bound resources/time.

Native acceptance must prove unauthenticated `/v3/me` reaches the real API with
valid TLS (401, no payment creation), wrong/missing SNI and plaintext fail, and
the probe cannot connect directly to the Internet. Exercise the actual pinned
nginx configuration, not source-text assertions. Test RED before implementation,
then GREEN; save aggregate evidence only. Preserve all working services/networks.

This slice produces an opt-in Compose overlay, config, native acceptance and
rollback notes. It does not enable checkout, deploy an unfinished caller, merge
the new frontend staging commit, or alter the database. Caller/return lifecycle,
fresh dependency reachability review and actual sandbox settlement remain gates.
