# ADR-010: Profile form writes use optimistic revisions

- **Status:** Accepted; rollout completed after separate user authorization on 2026-10-28
- **Date:** 2026-10-28

## Context

A client timeout does not cancel an already admitted SQL write. Reading old
profile data before request A commits and then saving B allowed delayed A to
replace successful B. The race was reproduced over real loopback HTTP/JWT/MySQL.
The requested correction concerns name/gender form saves; the existing avatar
receipt protocol remains separate. Avatar quotas are explicitly out of scope.

## Decision

Add users.profileRevision (non-null integer, default zero) with additive 0045.
Return it in the current-user public projection. profile.update requires
expectedRevision and returns the committed profileRevision. Under a row lock,
recheck actor existence, sessionVersion, blocked/deletion flags and revision;
apply the patch and increment revision in the same transaction. Empty patches
return the unchanged revision. No blind-write compatibility fallback.

Internal name/gender writes and explicit-name upserts advance the revision.
Role, login activity and password-only changes do not advance this counter;
sessionVersion remains responsible for authentication revocation. Existing avatar
uploads continue to use their own receipt identity/current-avatar checks.

The browser captures the revision at edit start and persists it with pending
input. A 409 retains text and requires a fresh read and explicit reviewed save.
A read of old data is still not proof A stopped; CAS fences A once B commits.
A matching read confirms current state, not exclusive ownership of the write.
Lower revisions in reads/ACKs cannot replace a newer profile of the same account.
Revisions of different accounts are never compared as one sequence.

## Alternatives considered

A values hash misses ABA (A to B to A). updatedAt changes for unrelated activity
and has limited precision. Reusing sessionVersion would couple editing to logout.
A separate operation ledger and status endpoint are unnecessary for preventing
this lost update; the form does not need to prove which identical writer won.
Client abort and a later GET alone do not prevent a delayed database mutation.

## Consequences

The migration and API/frontend form changes require a coordinated release after
backup and migration-history verification. Old clients without expectedRevision
receive 400; rolling back code keeps the additive column, without down-DDL.
During local implementation, working resources were not modified. The later
user-authorized release applied only additive 0045 and preserved existing data,
sessions, administrator credentials and S3; see the release report.
Tests cover real SQL ABA/aborted-A/new-B ordering, actor revocation before write,
HTTP responses, preserved browser drafts and session/account boundaries.

Reference: [integration contract](../development/frontend-audit-handoff-2026-10-27.md).
