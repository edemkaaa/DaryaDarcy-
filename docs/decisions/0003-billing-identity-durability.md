# ADR-003: Durable club receipts, identity links and cancellation requests

- **Status:** Accepted for the user-approved local backend stage; not release approval
- **Date:** 2026-10-02

## Context

Webhooks can repeat or arrive concurrently. Provider, database and SMTP cannot
participate in a single transaction. Legacy accounts created by checkout have no
password, and email-derived staff permissions make public setup unsafe.

## Decision

Use isolated pooled MySQL transactions, lock a member before settling an order,
and commit a unique provider receipt, entitlement and access-email event together.
Store the checkout price and validate integer minor units and provider bindings.
Only a verified initial payment can bind a recurring profile. Unknown bindings
fail closed; they require reconciliation, not guesses by email or client user ID.

Use random single-use password tokens with hashes in the token table, an encrypted
outbox copy for delivery recovery, expiry and recipient-address binding. Password
completion consumes outstanding links and advances a session version. It does not
authenticate the caller. Staff permissions come only from explicit roles.

Persist cancellation intent before calling Prodamus. Mark cancellation confirmed
only after its success response or a verified, profile-bound cancellation event.
Retry uncertain failures; retain paid expiry and keep request/confirmation distinct.

## Alternatives considered

Status checks without locks: do not serialize concurrent different payments.
Sending mail during a transaction: holds database locks during network failure
and still cannot guarantee atomicity with SMTP. Sending after commit without an
outbox: can lose access messages. Plaintext tokens in mail tables: exposes account
reset credentials in database copies. Exactly-once SMTP: not a supportable promise.
Changing local cancellation flags before the provider replies: falsely reports
that automatic charges have stopped.

## Consequences

Additive migrations, a separate encryption key, worker monitoring, explicit staff
role preflight and legacy billing reconciliation are required before deployment.
SMTP remains at-least-once. SKIP LOCKED workers can defer a locked record until a
later scheduler tick; tests wait for the delivery condition, not one immediate pass.
See [billing/identity stage](../audits/billing-identity.md) for API contracts and release gates.
