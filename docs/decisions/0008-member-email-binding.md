# ADR-008: Purpose-specific first email binding

- **Status:** Scenario cancelled by the user on 2026-10-13; frontend removed, backend unchanged
- **Date:** 2026-10-10

The user confirmed there are no existing legacy phone accounts. This decision
records the historical implementation; it no longer authorizes frontend rollout.
Server removal remains with the backend owner.

## Context

An administrator needs to bind an email to an existing legacy member with a phone
and no email. The owner must explicitly confirm email control. Identity, password,
session version and subscription must remain unchanged; this is not account merge
or password recovery. The [approved specification](../../SPEC-email-binding.md)
requires replay safety, privacy cleanup and disabled rollout until acceptance.

## Decision

Keep request/proof state in `member_email_bindings` and encrypted delivery in its
dedicated outbox, added by migration 0028. Reuse the existing durable-worker pattern
when connecting delivery; do not introduce a timer or loosen password-mail guards.
The pending email belongs to a binding request, not to the user's current identity,
so it cannot satisfy the existing access-mail recipient check. No external SMTP is
connected by this internal request stage.

Validate a bounded normalized email and stable lowercase UUIDv4 before dispatch.
Lock current actor and recipient in ascending user-ID order. Reauthorize admin,
blocked/deleted/deletion-pending state and the actor's session version at the write.
Claim the primary key atomically, fingerprint actor/recipient/email and replay only
the same intent. Retain terminal intent evidence after scrubbing its email/proof;
do not recreate PII or mail on a replay. A timeout must reuse the original key.

Queue a random 256-bit proof with a purpose-prefixed SHA-256 digest. Its AES-256-GCM
delivery cipher authenticates purpose, request key and payload hash as AAD. Missing
or noncanonical encryption configuration rolls back the claim. Commit request,
outbox and an audit without email/token/cipher together. Return only request key
and state. No user/credential/payment/session mutation is part of requesting.

Serialize pending bindings through the recipient lock. An occupied email conflicts,
but queuing is not a reservation: internal confirmation rechecks and uses the
normalized user-email unique constraint from migration 0027 to arbitrate races with
registration and checkout. This stage refuses any other pending intent, including
an expired pending row, until the lifecycle slice performs cleanup.

## Alternatives considered

Using password setup/reset tokens would couple binding to credential changes and
invalidate purpose separation. Updating email when the administrator submits would
skip owner confirmation. Reusing access-mail delivery by bypassing its recipient
check would weaken existing login/payment flows. A memory queue loses evidence on
restart. A separate recipient email in the outbox would unnecessarily duplicate PII.

## Consequences

Internal confirmation now locks user → request → outbox, revalidates the purpose
hash and current recipient, and uses the normalized unique index to decide email
ownership. It changes only email, consumes/scrubs the proof and records PII-free
audit atomically. An expired/invalidated recipient or duplicate-entry loser is
terminally scrubbed without an identity change. Other SQL failures roll back.
Recheck expiry after the potentially blocking user update and undo any expired
uncommitted write before recording expiry. Original admin ID is audit provenance,
not an authenticated confirmation principal. No session/password/payment mutation.

HTTP request/status/explicit confirmation are registered but default-disabled
behind `MEMBER_EMAIL_BINDING_ENABLED=true`; worker registration is pending.
Automatic expiry/30-day
retention, transactional account-deletion cleanup and leased/retrying delivery
are implemented. Delivery follows existing access-mail bounds and performs SMTP
outside transactions; late acknowledgements are fenced by lease and terminal
state. Retries after an unknown acceptance reuse the same proof/Message-ID, not
an exactly-once claim. Account deletion supports the pre-0028 schema only when
both tables are absent; a partial schema fails the whole transaction. Cleanup
does not depend on enabling requests in the UI.

Native HTTP/SQL and compiled ESM now verify transport, strict replies, current
authority, same-origin, safe errors/no-store, replay and explicit confirmation.
Status recovery never returns an address or proof; sent means SMTP acceptance,
not inbox delivery. Existing CORS/proxy/quota settings are unchanged; new binding
buckets reuse existing mail/completion bounds with the same single-process limit.
No-referrer fragment page, frontend integration and worker registration are still
required before enabling the flow. Local SQL/SMTP/HTTP acceptance does not stand
in for browser, external
delivery or working-server acceptance.

Migration 0028 is exercised only in owned disposable MySQL fixtures. Existing
0017–0019 migration-history gates stay open. Do not apply to the working database,
send real mail, enable the form or deploy this unfinished flow. Code rollback must
preserve durable intent evidence; dropping request tables is not a code rollback.
