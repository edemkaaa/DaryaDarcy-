# ADR-009: Durable article creation recovery

- **Status:** Accepted for user-approved local backend work; not rollout approval
- **Date:** 2026-10-13

## Context

admin.createArticle already commits article and teaser atomically, but a lost
response followed by another call creates another pair. The existing numeric
response and unkeyed clients must remain compatible. The frontend is maintained
by another developer and must not be edited in this work.

## Decision

Add optional lowercase UUID-v4 idempotencyKey to admin.createArticle; retain its
numeric result. Scope SHA-256 request identity to authenticated actor and the
versioned operation. Hash validated/defaulted payload, sorted object properties
and ordered arrays, before article storage normalization. Null cover and default
sort order are canonicalized; generated timestamps/IDs are excluded.

Separate article_creation_requests owns the result. An atomic unique no-op upsert
followed by FOR UPDATE serializes contenders. Claim, article, teaser and result
commit together. A private per-attempt claimToken distinguishes a freshly inserted
row from an invalid committed row with no result: never take over unknown work.
It is not the client intent key and never leaves the server.

Schema presence, a single-column requestKey primary key and InnoDB are checked
inside the same transaction, after acquiring the table metadata lock. This blocks
unsafe creation without uniqueness/transactionality. It is not certification of
working migration history or all column definitions. No automatic DDL or fallback.

Same actor/key/payload replays the original ID, even after edits or deletion;
changed payload conflicts. No cascade or automatic TTL may discard the successful
result. Current admin authorization runs before both replay and status lookup.
Read-only admin.articleCreationStatus exposes notRecorded/created/deleted and
the original ID only. notRecorded is a snapshot, not proof the first request has
failed: an in-flight transaction may commit later. Retry only the same intent.

## Alternatives considered

Title/content deduplication suppresses legitimate identical articles. In-memory
caches do not survive process restart. SELECT-before-INSERT races. Reusing the
post ledger couples unrelated operations and deletion rules. Mandatory keys break
existing clients. Key-only creation cannot recover the original payload.

## Consequences

Additive migration 0029 is prepared locally and exercised only on owned disposable
MySQL. Existing 0017–0019 history and 0027/0028 deployment gates are unchanged.
Code rollback keeps this table and its results; dropping/pruning it requires a
reviewed procedure. actorUserId is purpose-limited personal linkage, not declared
anonymized data; account deletion/export and retention review remain pre-rollout.

The client must persist the same intent key before the first request, isolated
by account, to obtain reload protection. No frontend source/generated API contract
is updated here. A pending generated-contract check is an explicit integration
handoff, not an excuse to change another developer's files. Backend HTTP/SQL and
independent-process tests do not certify the browser reload scenario.

Reference: [approved server contract](../../SPEC-article-create-recovery.md).
