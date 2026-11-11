/** Проверяет, подтверждены ли платёж и привязка профиля для отмены; TEST не становится LIVE-доказательством. */
import { and, eq, like, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  accessEmailOutbox,
  billingCheckoutIntents,
  billingProfiles,
  billingReceipts,
  clubPayments,
  type ClubPayment,
} from "../../../../packages/database/src/schema";
import { billingKey, moneyMinor, prodamusTestOrderPattern } from "./protocol";
import { clubSettlementPayloadHash } from "./settlement-request";

type Reader = Pick<MySql2Database, "select">;
type BillingProfile = typeof billingProfiles.$inferSelect;

/** Для каждого paid monthly-заказа ищет однозначный receipt/profile этого пользователя; отдельный подписанный TEST-заказ не считается автосписанием. */
export async function hasUnboundMonthlyPayment(
  database: Reader,
  userId: number,
  profiles: BillingProfile[],
): Promise<boolean> {
  const monthly = await database
    .select({
      orderId: clubPayments.orderId,
      email: clubPayments.email,
      sum: clubPayments.sum,
    })
    .from(clubPayments)
    .where(
      and(
        eq(clubPayments.userId, userId),
        eq(clubPayments.status, "paid"),
        like(clubPayments.orderId, "club-%"),
      ),
    );
  if (!monthly.length) return false;

  // Settlement создаёт обе записи атомарно. Индекс пользователя outbox и
  // primary key receipt позволяют прочитать доказательства без полного сканирования.
  const receipts = await database
    .select({
      orderId: billingReceipts.orderId,
      payloadHash: billingReceipts.payloadHash,
      amountMinor: billingReceipts.amountMinor,
    })
    .from(accessEmailOutbox)
    .innerJoin(
      billingReceipts,
      and(
        eq(
          billingReceipts.paymentKey,
          sql`SUBSTRING(${accessEmailOutbox.eventKey}, 13)`,
        ),
        eq(billingReceipts.userId, accessEmailOutbox.userId),
      ),
    )
    .where(
      and(
        eq(accessEmailOutbox.userId, userId),
        eq(accessEmailOutbox.kind, "club-access"),
        like(accessEmailOutbox.eventKey, "club-access:%"),
      ),
    );
  const receiptsByOrder = new Map<string, typeof receipts>();
  for (const receipt of receipts) {
    const previous = receiptsByOrder.get(receipt.orderId);
    if (previous) previous.push(receipt);
    else receiptsByOrder.set(receipt.orderId, [receipt]);
  }
  return monthly.some((payment) => {
    const amount = moneyMinor(payment.sum);
    const email = payment.email?.trim().toLowerCase();
    if (amount === null || !email) return true;
    const proofs = receiptsByOrder.get(payment.orderId) ?? [];
    // Разовый TEST не создаёт автосписаний. Его формат и квитанция должны
    // принадлежать этому пользователю, включая оплату с пересчётом в RUB.
    if (
      prodamusTestOrderPattern.exec(payment.orderId)?.[0] === payment.orderId &&
      payment.orderId.split("-")[2] === String(userId) &&
      amount === 79000 &&
      proofs.some((proof) => proof.amountMinor === amount)
    )
      return false;
    const matching = profiles.filter(
      (profile) =>
        profile.email === email &&
        profile.amountMinor === amount &&
        proofs.some(
          (proof) =>
            proof.amountMinor === amount &&
            proof.payloadHash ===
              clubSettlementPayloadHash(payment.orderId, amount, {
                email,
                currency: "rub",
                subscriptionId: profile.subscriptionId,
                profileId: profile.profileId,
              }),
        ),
    );
    // Старые хеши квитанций не включали домен merchant: при неоднозначных
    // кандидатах профиля нельзя просто выбирать самый новый.
    return matching.length !== 1;
  });
}

/** Разрешает известные форматы клубного заказа; YooKassa TEST требует согласованных intent, paymentId и receipt с той же суммой/владельцем. */
export async function supportsCancellationPayment(
  database: Reader,
  paid: ClubPayment,
): Promise<boolean> {
  // Для месячного заказа дополнительно требуется отсутствие непривязанной оплаты.
  if (
    paid.orderId.startsWith("club-") ||
    paid.orderId.startsWith("club6m-") ||
    paid.orderId.startsWith("admin-grant-")
  )
    return true;
  if (!paid.orderId.startsWith("yk-club-")) return false;
  const [intent] = await database
    .select()
    .from(billingCheckoutIntents)
    .where(
      and(
        eq(billingCheckoutIntents.userId, paid.userId),
        eq(billingCheckoutIntents.orderId, paid.orderId),
      ),
    )
    .limit(1);
  if (!intent?.providerPaymentId) return false;
  const [receipt] = await database
    .select({ amountMinor: billingReceipts.amountMinor })
    .from(billingReceipts)
    .where(
      and(
        eq(
          billingReceipts.paymentKey,
          billingKey([
            `yookassa:test:${intent.shopId}`,
            intent.providerPaymentId,
          ]),
        ),
        eq(billingReceipts.userId, paid.userId),
        eq(billingReceipts.orderId, paid.orderId),
      ),
    )
    .limit(1);
  return Boolean(
    receipt &&
    receipt.amountMinor === intent.amountMinor &&
    moneyMinor(paid.sum) === intent.amountMinor,
  );
}
