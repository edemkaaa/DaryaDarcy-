# ADR-001: Modular pnpm monorepo boundaries

- **Status:** Accepted
- **Date:** 2026-10-02

## Context

The repository contains a universal Expo frontend, an Express/tRPC backend, Drizzle schema and migrations, a second Vite frontend, deployment configuration, and many operational scripts at the same directory level. Large backend files also mix HTTP procedures, business rules, database access, and external integrations. This makes ownership unclear and increases the chance that a frontend or deployment change accidentally reaches another layer.

The product does not need independently deployed microservices. It does need clear folders, explicit dependency direction, stable commands, and a migration that can be reviewed and rolled back in small steps.

## Decision

Adopt a pnpm workspace organized as:

- `apps/frontend` — the production Expo Router application for web, iOS, and Android;
- `apps/backend` — the Express/tRPC service;
- `apps/legacy-web` — the existing alternate Vite client, isolated and kept buildable;
- `packages/shared` — platform-neutral contracts and helpers;
- `packages/database` — Drizzle schema, migrations, connection, and repositories;
- `infrastructure/deploy` — nginx, PM2, provisioning, and deployment configuration;
- `tooling/scripts` — repository maintenance, import, audit, and release helpers.

The system remains a modular monolith. The root package provides convenient orchestration commands. Each app/package owns its manifest and verification commands as it is migrated.

Allowed dependency direction is:

```text
frontend ───────▶ shared
backend ────────▶ shared
backend ────────▶ database ───────▶ shared
infrastructure ─▶ build artifacts and commands only
```

Application code must not import infrastructure. Frontend code must not import backend or database internals. Existing tRPC namespaces, inputs, outputs, URLs, and error semantics are compatibility contracts and remain unchanged during structural moves.

Migration is incremental. Temporary re-export/composition facades are allowed when they keep a public import stable, but each facade must be documented and removed after callers migrate.

## Alternatives considered

### Keep the current flat repository

Rejected because it preserves ambiguous ownership and makes future backend/frontend work harder to review.

### Split into multiple repositories

Rejected because shared API/type changes would require cross-repository coordination and versioning before the team needs that overhead.

### Convert to microservices

Rejected because the current deployment and team do not benefit from independent service scaling. It would add distributed tracing, retries, network failure, and operational complexity without reducing the main source-level coupling.

### Rewrite into a new framework

Rejected because the problem is structure and ownership, not a missing framework capability. A rewrite would combine behavioral change with architecture change and lose the current working contract.

## Consequences

### Positive

- Developers can find frontend, backend, data, and deployment code quickly.
- Workspace manifests make ownership and commands explicit.
- Dependency rules prevent accidental cross-layer imports.
- Structural changes can be reviewed and reverted independently.
- The backend and frontend remain deployable together while their internals become modular.

### Negative

- Some configuration and import paths must change during migration.
- Temporary compatibility facades add short-lived duplication.
- Build and deployment scripts require path audits.
- The legacy client remains maintenance overhead until product ownership is decided.

## Migration and rollback

Move one boundary at a time: safety net, legacy/deploy, backend/database, frontend/shared, then internal domain extraction. Verify tests, type checking, and relevant builds after each step and commit each step separately.

Rollback is performed by reverting the affected slice. Public API behavior and database schema are intentionally unchanged, so a structural slice does not require a data rollback.

## Validation

- Root test, type-check, and build commands pass without production credentials.
- Both frontend builds resolve from their workspace locations.
- The backend bundle starts from its workspace location.
- Repository checks reject prohibited dependency directions and reintroduced legacy root paths.
