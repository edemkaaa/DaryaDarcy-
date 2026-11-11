import { and, desc, eq, like, or } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  queueAccessEmail,
  queuePasswordSetupRetry,
  type Transaction,
} from "./access";
import { normalizeEmail } from "../_core/password";
import {
  users,
  accessEmailOutbox,
  clubPayments,
  userConsentEvents,
  type User,
} from "../../../../packages/database/src/schema";
import {
  EMAIL_REGISTER_CONSENT_KEY,
  EMAIL_REGISTER_CONSENT_TEXT,
  EMAIL_REGISTER_CONSENT_VERSION,
} from "../../../../packages/shared/src/consent-texts";

function isDuplicateAccount(error: unknown): boolean {
  let current = error;
  for (
    let depth = 0;
    depth < 4 && current && typeof current === "object";
    depth++
  ) {
    const detail = current as { code?: string; cause?: unknown };
    if (detail.code === "ER_DUP_ENTRY") return true;
    current = detail.cause;
  }
  return false;
}

async function recordRegistrationConsent(tx: Transaction, userId: number) {
  await tx.insert(userConsentEvents).values({
    userId,
    consentKey: EMAIL_REGISTER_CONSENT_KEY,
    status: "granted",
    consentVersion: EMAIL_REGISTER_CONSENT_VERSION,
    consentText: EMAIL_REGISTER_CONSENT_TEXT,
  });
}

/** Resume proof by email, including identities created by a recorded checkout. */
export async function retryEmailRegistration(
  database: MySql2Database,
  email: string,
  openId: string,
): Promise<boolean> {
  return database.transaction(async (tx) => {
    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.email, email))
      .for("update");
    if (
      !user ||
      user.passwordHash ||
      user.blockedAt ||
      user.accountDeletionRequestedAt ||
      user.role !== "user" ||
      normalizeEmail(user.email || "") !== email
    )
      return false;
    const [registration] = await tx
      .select({ id: accessEmailOutbox.id })
      .from(accessEmailOutbox)
      .where(
        and(
          eq(accessEmailOutbox.eventKey, `registration:${user.id}`),
          eq(accessEmailOutbox.userId, user.id),
          eq(accessEmailOutbox.email, email),
          eq(accessEmailOutbox.kind, "password-setup"),
        ),
      );
    if (registration) {
      await queuePasswordSetupRetry(tx, user.id, email);
      return true;
    }

    if (user.openId !== openId || user.loginMethod !== "email" || user.phone)
      return false;
    const [checkout] = await tx
      .select({ email: clubPayments.email })
      .from(clubPayments)
      .where(
        and(
          eq(clubPayments.userId, user.id),
          eq(clubPayments.email, email),
          or(
            like(clubPayments.orderId, "club-%"),
            like(clubPayments.orderId, "club6m-%"),
            like(clubPayments.orderId, "yk-club-%"),
          ),
        ),
      )
      .limit(1);
    if (normalizeEmail(checkout?.email || "") !== email) return false;

    // A previous recovery may already have queued a usable link. Record
    // consent once and share the existing recipient budget for setup mail.
    const [consent] = await tx
      .select({ status: userConsentEvents.status })
      .from(userConsentEvents)
      .where(and(
        eq(userConsentEvents.userId, user.id),
        eq(userConsentEvents.consentKey, EMAIL_REGISTER_CONSENT_KEY),
      ))
      .orderBy(desc(userConsentEvents.id))
      .limit(1);
    if (consent?.status !== "granted")
      await recordRegistrationConsent(tx, user.id);
    await queuePasswordSetupRetry(tx, user.id, email);
    return true;
  });
}

/** Registration may insert an account, never update or claim a pre-existing one. */
export async function createEmailAccount(
  database: MySql2Database,
  input: {
    openId: string;
    email: string;
    name: string | null;
  },
): Promise<User | null> {
  try {
    return await database.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: users.id })
        .from(users)
        .where(or(eq(users.openId, input.openId), eq(users.email, input.email)))
        .limit(1);
      if (existing) return null;
      const [inserted] = await tx
        .insert(users)
        .values({
          ...input,
          passwordHash: null,
          role: "user",
          loginMethod: "email",
          lastSignedIn: new Date(),
        })
        .$returningId();
      await recordRegistrationConsent(tx, inserted.id);
      await queueAccessEmail(
        tx,
        inserted.id,
        input.email,
        "password-setup",
        `registration:${inserted.id}`,
      );
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, inserted.id));
      return user;
    });
  } catch (error) {
    // The deterministic email openId's unique constraint arbitrates concurrent
    // registration/checkout. A losing request cannot overwrite password or role.
    if (isDuplicateAccount(error)) return null;
    throw error;
  }
}
