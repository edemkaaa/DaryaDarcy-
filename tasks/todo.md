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
- [ ] Move repository helpers to `tooling/scripts`.
- [ ] Green checkpoint: root commands and both current builds.

## Phase 2 — Backend and data

- [x] Move backend to `apps/backend`.
- [x] Move schema/migrations to `packages/database`.
- [ ] Extract domain routers and repositories.
- [ ] Green checkpoint: API contract, tests, check, backend build.

## Phase 3 — Frontend

- [ ] Move Expo application to `apps/frontend`.
- [ ] Isolate shared contracts in `packages/shared`.
- [ ] Verify web/iOS/Android configuration paths.
- [ ] Green checkpoint: Expo web build, tests, check.

## Phase 4 — Enforcement

- [ ] Add dependency-boundary checks.
- [ ] Remove temporary facades and stale paths.
- [ ] Split remaining oversized modules.
- [ ] Run final correctness, architecture, security, and performance review.
