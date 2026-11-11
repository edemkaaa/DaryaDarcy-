import { and, desc, eq, isNull } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  billingProfiles,
  billingReceipts,
  clubPayments,
  users,
} from "../../../../packages/database/src/schema";
import { normalizeContactPhone } from "../../../../packages/shared/src/checkout-contact";
import { queueAccessEmail } from "../identity/access";
import { queueCancellationForUser } from "./cancellation";
import { moneyMinor, profileKey } from "./protocol";
import {
  prepareClubSettlement,
  type ClubSettlementInput,
} from "./settlement-request";

export async function settleClubOrder(
  database: MySql2Database,
  input: ClubSettlementInput,
): Promise<boolean> {
  const prepared = prepareClubSettlement(input);
  if (!prepared) return false;
  const { proof, amount, paymentKey, orderId, payloadHash } = prepared;
  const [recipient] = input.recurring
    ? await database
        .select({ userId: billingProfiles.userId })
        .from(billingProfiles)
        .where(eq(billingProfiles.profileKey, profileKey(proof)))
        .limit(1)
    : await database
        .select({ userId: clubPayments.userId })
        .from(clubPayments)
        .where(eq(clubPayments.orderId, orderId))
        .limit(1);
  if (!recipient) return false;
  return database.transaction(async (tx) => {
    // Lock the owner before reading expiry: different payments for one member
    // must serialize as well as replays of the same payment.
    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.id, recipient.userId))
      .for("update");
    if (!user || user.blockedAt) return false;
    if ((user.email || "").trim().toLowerCase() !== proof.email) return false;
    const [receipt] = await tx
      .select()
      .from(billingReceipts)
      .where(eq(billingReceipts.paymentKey, paymentKey));
    if (receipt)
      return receipt.userId === user.id && receipt.payloadHash === payloadHash;
    if (input.recurring) {
      const [profile] = await tx
        .select()
        .from(billingProfiles)
        .where(eq(billingProfiles.profileKey, profileKey(proof)))
        .for("update");
      if (
        !profile ||
        profile.userId !== user.id ||
        profile.email !== proof.email ||
        profile.amountMinor !== amount
      )
        return false;
      await tx.insert(clubPayments).values({
        userId: user.id,
        orderId,
        email: proof.email,
        sum: input.sum,
      });
    }
    const [payment] = await tx
      .select()
      .from(clubPayments)
      .where(eq(clubPayments.orderId, orderId))
      .for("update");
    if (!payment || payment.userId !== user.id) return false;
    if (
      payment.status !== "pending" ||
      moneyMinor(payment.sum) !== amount ||
      (payment.email || "").trim().toLowerCase() !== proof.email
    )
      return false;
    if (proof.profileId && proof.subscriptionId && !input.recurring) {
      const key = profileKey(proof);
      const [profile] = await tx
        .select()
        .from(billingProfiles)
        .where(eq(billingProfiles.profileKey, key))
        .for("update");
      if (
        profile &&
        (profile.userId !== user.id ||
          profile.email !== proof.email ||
          profile.amountMinor !== amount)
      )
        return false;
      if (!profile)
        await tx.insert(billingProfiles).values({
          profileKey: key,
          userId: user.id,
          domain: proof.domain,
          subscriptionId: proof.subscriptionId,
          profileId: proof.profileId,
          email: proof.email,
          amountMinor: amount,
        });
    }
    if (user.accountDeletionRequestedAt && proof.profileId)
      await queueCancellationForUser(tx, user.id);
    const [latest] = await tx
      .select({ expiresAt: clubPayments.expiresAt })
      .from(clubPayments)
      .where(
        and(eq(clubPayments.userId, user.id), eq(clubPayments.status, "paid")),
      )
      .orderBy(desc(clubPayments.expiresAt))
      .limit(1);
    const expiresAt = new Date(
      Math.max(Date.now(), latest?.expiresAt?.getTime() ?? 0) + input.periodMs,
    );
    const [activeProfile] = await tx
      .select({ key: billingProfiles.profileKey })
      .from(billingProfiles)
      .where(
        and(
          eq(billingProfiles.userId, user.id),
          isNull(billingProfiles.cancelledAt),
        ),
      )
      .limit(1);
    // A saved cancellation request is not confirmation, including when a real
    // charge arrives while setActivity is still being retried.
    const cancellationConfirmed = Boolean(proof.profileId && !activeProfile);
    await tx
      .update(clubPayments)
      .set({
        status: "paid",
        paidAt: new Date(),
        expiresAt,
        sum: input.sum ?? payment.sum,
        cancelAtPeriodEnd: payment.cancelAtPeriodEnd || cancellationConfirmed,
      })
      .where(eq(clubPayments.id, payment.id));
    await tx.insert(billingReceipts).values({
      paymentKey,
      userId: user.id,
      orderId,
      payloadHash,
      amountMinor: amount,
    });
    // The user lock prevents concurrent payments from replacing the first
    // contact. Only this validated order's saved contact is eligible.
    const contactPhone = payment.contactPhone
      ? normalizeContactPhone(payment.contactPhone)
      : null;
    if (
      contactPhone &&
      !user.contactPhone?.trim() &&
      !user.accountDeletionRequestedAt
    )
      await tx.update(users).set({ contactPhone }).where(eq(users.id, user.id));
    await queueAccessEmail(
      tx,
      user.id,
      proof.email,
      "club-access",
      `club-access:${paymentKey}`,
      orderId,
    );
    return true;
  });
}
