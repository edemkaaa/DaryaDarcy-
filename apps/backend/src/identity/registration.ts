import { eq, or } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  users,
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

/** Registration may insert an account, never update or claim a pre-existing one. */
export async function createEmailAccount(
  database: MySql2Database,
  input: {
    openId: string;
    email: string;
    passwordHash: string;
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
          role: "user",
          loginMethod: "email",
          lastSignedIn: new Date(),
        })
        .$returningId();
      await tx.insert(userConsentEvents).values({
        userId: inserted.id,
        consentKey: EMAIL_REGISTER_CONSENT_KEY,
        status: "granted",
        consentVersion: EMAIL_REGISTER_CONSENT_VERSION,
        consentText: EMAIL_REGISTER_CONSENT_TEXT,
      });
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
