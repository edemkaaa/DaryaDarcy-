# ADR-005: Incremental NestJS migration with existing API and Drizzle

- **Status:** Accepted for the user-requested local migration; not release approval
- **Date:** 2026-10-05

## Context

The user requests NestJS migration and related backend repairs. ADR-002 favoured
keeping the framework until an explicit migration was designed. This decision
supersedes only that framework constraint, not the verified security/data rules.
Next.js consumes 72 tRPC procedures and several HTTP endpoints. MySQL transactions
already implement payments, account access and publication concurrency.

## Decision

Use a single Nest HTTP runtime with native domain modules and explicit service
injection. Keep existing tRPC paths/types, HTTP statuses, JWT/cookies, MySQL and
Drizzle. Domain-by-domain migration replaces adapters, not all business logic.
Do not introduce TypeORM, another backend/port, GraphQL or new external services.

Start with the reviewed Nest core/common/platform-express package family and its
required reflect-metadata/RxJS peers, pinned in pnpm. Install with scripts disabled.
Initial pins: Nest 12.1.2, reflect-metadata 0.2.2, RxJS 7.8.2. The framework's
default Express adapter uses its own Express 5.2.1; existing parser libraries
remain unchanged until real-HTTP compatibility checks justify their replacement.
Keep Node 22, Vitest and esbuild; constructor injection uses explicit @Inject
tokens rather than compiler-generated decorator metadata. No Nest CLI is needed.

Disable Nest default body parsing. Register existing security middleware first,
provider raw webhook before JSON, authenticated upload parsers before ordinary
routes. The first native slice is health/capabilities, then seasonal settings.
Factory creation must not start workers, bind a public port or read a production
environment file. The executable alone loads configuration and starts operation.

## First-slice specification

Objective: the real Nest application serves existing health/capability contracts
and existing adapters with unchanged trust boundaries. Source lives in
apps/backend/src; transport modules/controllers stay in their owning domains;
tests live in tests. Keep existing formatting and small typed services. Example:

```typescript
constructor(@Inject(LaunchService) private readonly launch: LaunchService) {}
```

Commands from the repository root: pnpm check; pnpm test; pnpm build; pnpm lint;
pnpm check:api; pnpm check:boundaries; pnpm check:docs. MySQL tests require the
guarded BACKEND_TEST_DATABASE_URL pointing only at a disposable backend_test.

Testing: actual HTTP requests through the production factory, existing context/
JWT and real MySQL for domain slices; mock only external provider/SMTP/push
transport. Prove errors/rollback/parallel requests, not decorator text or mocks.
Run the built Node artifact as well as Vitest, since compiler behaviour differs.

Boundaries: always preserve security policies and API shapes, test each slice,
review dependencies/lockfile, commit verified steps. Ask before new permissions,
CORS policy, external integrations, working-data migrations or rollout. Never
commit secrets, run production jobs from tests, hide failures with retries or
report the whole migration complete while adapters remain.

Acceptance: real HTTP health/capabilities and bridged tRPC work; foreign origins,
oversized/malformed requests and anonymous uploads remain rejected; raw provider
bytes reach HMAC verification; one runtime closes its listener; full suite/types/
contract/build pass without production or external writes.

## Alternatives considered

Full rewrite with TypeORM/REST: combines framework, schema/query and client
changes, making regressions difficult to isolate. Rejected for this migration.
An empty Nest wrapper permanently hosting the monolith: insufficient; adapters
are transitional, tracked explicitly in the migration task list. Microservices
add coordination without addressing the present maintainability problem.

## Consequences

The migration is not complete when Nest first starts. Native modules, ownership
of lifecycle/resources, regression coverage and adapter removal must follow.
Existing dependency advisories, registration race and 0017–0019 migration-history
gate remain open. No production rollout is implied by local implementation.

No database migration is required for the framework foundation. Roll back a
verified runtime slice through its commit while retaining security repairs and
the durable request table; do not reset working data or resurrect unsafe flows.

References: [Nest lifecycle](https://docs.nestjs.com/fundamentals/lifecycle-events),
[raw body handling](https://docs.nestjs.com/faq/raw-body),
[migration/runtime requirements](https://docs.nestjs.com/migration-guide).
