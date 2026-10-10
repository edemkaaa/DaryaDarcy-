import type { MySql2Database } from "drizzle-orm/mysql2";
import { eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import {
  adminAuditLog,
  memberEmailBindings,
  users,
} from "../../../../packages/database/src/schema";
import { isValidEmail, normalizeEmail } from "../_core/password";
import { EmailBindingError, isEmailBindingDuplicate } from "./email-binding";
import { completeMemberEmailBinding as completeIntent } from "./email-binding-lifecycle";

/** Internal-only; confirmation does not authenticate or issue a session. */
export async function confirmMemberEmailBinding(
  database: MySql2Database,
  token: string,
): Promise<boolean> {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token))
    return false;
  const proofHash = createHash("sha256")
    .update(`email-binding:v1:${token}`)
    .digest("hex");
  try {
    // Only route to the recipient here. All authority and proof state are read
    // again under locks; no candidate email/state may authorize the write.
    const [candidate] = await database
      .select({
        requestKey: memberEmailBindings.requestKey,
        userId: memberEmailBindings.userId,
      })
      .from(memberEmailBindings)
      .where(eq(memberEmailBindings.proofHash, proofHash))
      .limit(1);
    if (!candidate) return false;
    return await database.transaction(async (tx) => {
      // Same user -> binding -> outbox order as requesting and future deletion.
      const [recipient] = await tx
        .select()
        .from(users)
        .where(eq(users.id, candidate.userId))
        .for("update");
      const [binding] = await tx
        .select()
        .from(memberEmailBindings)
        .where(eq(memberEmailBindings.requestKey, candidate.requestKey))
        .for("update");
      if (
        !binding ||
        binding.userId !== candidate.userId ||
        binding.state !== "pending" ||
        binding.proofHash !== proofHash
      )
        return false;
      if (binding.expiresAt.getTime() <= Date.now()) {
        await completeIntent(tx, binding.requestKey, "expired");
        return false;
      }
      if (
        !recipient ||
        recipient.role !== "user" ||
        recipient.blockedAt ||
        recipient.accountDeletionRequestedAt ||
        recipient.openId.startsWith("deleted-") ||
        !recipient.phone?.trim() ||
        (recipient.email !== null && recipient.email !== "") ||
        !binding.email ||
        normalizeEmail(binding.email) !== binding.email ||
        !isValidEmail(binding.email)
      ) {
        await completeIntent(tx, binding.requestKey, "cancelled");
        return false;
      }
      const [occupied] = await tx
        .select({ id: users.id })
        .from(users)
        .where(sql`NULLIF(LOWER(TRIM(${users.email})), '') = ${binding.email}`)
        .limit(1);
      if (occupied) {
        await completeIntent(tx, binding.requestKey, "cancelled");
        return false;
      }
      try {
        // The unique normalized index, not the snapshot SELECT above, decides
        // ownership in races with registration/checkout or another binding.
        await tx
          .update(users)
          .set({ email: binding.email, updatedAt: recipient.updatedAt })
          .where(eq(users.id, recipient.id));
      } catch (error) {
        // MySQL duplicate-entry aborts this statement, not the transaction.
        // Scrub the losing intent in the same tx. Other failures must rollback.
        if (!isEmailBindingDuplicate(error)) throw error;
        await completeIntent(tx, binding.requestKey, "cancelled");
        return false;
      }
      if (binding.expiresAt.getTime() <= Date.now()) {
        // A unique-index wait can outlive the proof. Undo our uncommitted
        // email write before expiring; no outside reader sees a bound address.
        await tx
          .update(users)
          .set({ email: recipient.email, updatedAt: recipient.updatedAt })
          .where(eq(users.id, recipient.id));
        await completeIntent(tx, binding.requestKey, "expired");
        return false;
      }
      await completeIntent(tx, binding.requestKey, "confirmed");
      // The original requesting administrator is recorded as intent provenance,
      // not as an authenticated caller of this proof-only operation.
      await tx.insert(adminAuditLog).values({
        actorUserId: binding.actorUserId,
        action: "confirm_member_email_binding",
        targetType: "user",
        targetId: binding.userId,
      });
      return true;
    });
  } catch {
    // Bound SQL may include email/proof material. Never propagate/log its cause.
    throw new EmailBindingError("unavailable");
  }
}
