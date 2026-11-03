import { asc, eq, isNull } from "drizzle-orm";
import { shopDeliveryEmails } from "../../../../packages/database/src/schema";
import { getDb } from "../database/connection";

export async function queueShopDeliveryEmail(input: {
  orderId: string;
  userId: number | null;
  email: string;
  productId: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(shopDeliveryEmails)
    .values({
      orderId: input.orderId,
      userId: input.userId,
      email: input.email,
      productId: input.productId,
    })
    .onDuplicateKeyUpdate({
      set: { email: input.email, productId: input.productId },
    });
}

export async function isShopDeliveryEmailSent(
  orderId: string,
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select({ sentAt: shopDeliveryEmails.sentAt })
    .from(shopDeliveryEmails)
    .where(eq(shopDeliveryEmails.orderId, orderId))
    .limit(1);
  return Boolean(rows[0]?.sentAt);
}

export async function markShopDeliveryEmailSent(
  orderId: string,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(shopDeliveryEmails)
    .set({ sentAt: new Date() })
    .where(eq(shopDeliveryEmails.orderId, orderId));
}

export async function listPendingShopDeliveryEmails(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(shopDeliveryEmails)
    .where(isNull(shopDeliveryEmails.sentAt))
    .orderBy(asc(shopDeliveryEmails.createdAt))
    .limit(limit);
}
