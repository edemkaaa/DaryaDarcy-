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

1. `apps/frontend` may import `packages/shared`, never backend/database internals.
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
- [ ] Move repository-only helpers to `tooling/scripts`.
- [ ] Acceptance: root commands still work and no old path is required.

### Phase 2 — Backend and database ownership

- [x] Move the service into `apps/backend` without changing HTTP/tRPC behavior.
- [x] Move Drizzle schema/migrations and database ownership into `packages/database`.
- [ ] Split backend code by business domain behind composition facades.
- [ ] Acceptance: backend builds from its workspace and public router contract is unchanged.

### Phase 3 — Frontend ownership

- [ ] Move the Expo app, components, hooks, assets and client utilities into `apps/frontend`.
- [ ] Give the frontend its own manifest/config while keeping root convenience commands.
- [ ] Replace cross-layer imports with `packages/shared` contracts or explicit facades.
- [ ] Acceptance: Expo web build, type check, and app route inventory pass.

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
