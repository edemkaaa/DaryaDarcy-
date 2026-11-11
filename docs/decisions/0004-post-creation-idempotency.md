# ADR-004: Durable request keys for post creation

- **Status:** Accepted for the user-approved local backend stage; not release approval
- **Date:** 2026-10-05

## Актуальность на 11 ноября 2026

Серверный журнал и клиентское восстановление реализованы в текущем коде. Упоминания первоначально неподключённого фронтенда и миграционного допуска ниже относятся к дате решения. Это не подтверждение состояния новой рабочей БД; применимость миграций проверяют перед каждым выпуском.

## Context

An HTTP response can be lost after MySQL commits. Retrying admin.createPost used
to create another post and announcement. Existing clients expect a numeric ID
and do not supply a request key. Express/tRPC remains the application stack.

## Decision

Accept an optional bounded ASCII idempotencyKey. The initiating client must reuse
the same key and payload across attempts. Scope its SHA-256 hash to the server's
authenticated actor and versioned operation. Hash validated input after schema
defaults, excluding the key, with sorted object properties and ordered arrays.
Do not hash generated IDs or server timestamps; reject non-JSON keyed payloads.

Keep persistence in the content module. A unique no-op upsert acquires the key
lock without overwriting the winner's payload/result. Read it FOR UPDATE; reject
a different fingerprint with CONFLICT. Commit a new post, all initial media and
the request's postId together. A duplicate returns the original numeric ID and
does not announce again. All existing authorization runs before replay.

Concurrent calls wait under MySQL's configured lock timeout. A timeout is an
uncertain attempt, not permission to replace a key; retry the same intent.
Rollback leaves no claimed key. A successful result survives post edits/deletion
without a cascading FK or TTL, so replay does not resurrect or revert content.

## Alternatives considered

SELECT before INSERT races. Plain duplicate INSERT can involve shared locks;
the no-op upsert uses an exclusive lock. In-memory caching loses results on
restart and across workers. Deduplication by text blocks legitimate identical
posts. Making keys mandatory would break existing clients. A NestJS migration
does not address durability and is unnecessary for this bounded change.

## Consequences

Apply additive migration 0025 before keyed requests are enabled, after resolving
the existing 0017–0019 migration-history gate. Rehearse on a disposable MySQL,
not production. Code rollback retains the new table and successful results;
dropping/pruning them needs a separately approved retention/replay policy.

Unkeyed calls keep their previous semantics. The frontend contract is generated,
but editor key generation and retry UX remain separate work. The initial creator
announces after commit; a crash can still lose that announcement. Transactional
push outbox/delivery guarantees belong to N12, not this change.

Real HTTP tests reuse the application's tRPC context, JWT/role checks and MySQL;
only external push delivery is replaced. They cover lost responses, actual
in-flight locks, simultaneous calls, rollback, payload conflicts and tombstones.

References: [ECC NestJS patterns](https://github.com/affaan-m/ECC/blob/main/skills/nestjs-patterns/SKILL.md)
informs thin handlers/domain-owned logic and boundary tests, not framework choice;
[MySQL locking](https://dev.mysql.com/doc/refman/8.4/en/innodb-locks-set.html)
explains duplicate-key locking;
[Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests)
illustrates stable initiating keys and payload guards.
