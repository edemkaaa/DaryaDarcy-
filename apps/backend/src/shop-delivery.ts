import { PUBLIC_CONTACT_EMAIL } from "../../../packages/shared/src/contact";
import { sendTransactionalEmail } from "./_core/email";
import { sendServicePushNotification } from "./push";
import * as platformDb from "./platform-db";
import { getCapabilities } from "./launch/capabilities";

const PRODUCT_LABELS: Record<string, string> = {
  "digital-1": "Пособие по атмосферной фотографии",
  "digital-2": "Винтажные книги и открытки",
};

const PRODUCT_DOWNLOAD_URLS: Record<string, string> = {
  "digital-1": (process.env.SHOP_DIGITAL_1_DOWNLOAD_URL || "").trim(),
  "digital-2": (process.env.SHOP_DIGITAL_2_DOWNLOAD_URL || "").trim(),
};

function shopPageUrl(productId: string): string {
  const base = (process.env.PUBLIC_APP_URL || "https://daryadarcy.com").replace(/\/$/, "");
  return `${base}/shop/${productId}`;
}

export async function deliverShopPurchase(input: {
  orderId: string;
  productId: string;
  email: string;
  userId: number | null;
}): Promise<void> {
  if (!getCapabilities().shopOnlinePayment) return;
  const email = input.email.trim();
  if (!email) return;

  if (await platformDb.isShopDeliveryEmailSent(input.orderId)) return;

  await platformDb.queueShopDeliveryEmail({
    orderId: input.orderId,
    userId: input.userId,
    email,
    productId: input.productId,
  });

  const label = PRODUCT_LABELS[input.productId] || "цифровой товар";
  const link = shopPageUrl(input.productId);
  const downloadUrl = PRODUCT_DOWNLOAD_URLS[input.productId];
  const sent = await sendTransactionalEmail({
    to: email,
    subject: `DARYADARCY — доступ к «${label}»`,
    text:
      `Здравствуйте!\n\n` +
      `Спасибо за покупку «${label}».\n\n` +
      (downloadUrl
        ? `Скачайте материал по ссылке:\n${downloadUrl}\n\n`
        : `Откройте материал в приложении (войдите с той же почтой, что при оплате):\n${link}\n\n`) +
      `Страница покупки: ${link}\n\n` +
      `Если письмо не пришло в течение 15 минут, напишите нам: ${PUBLIC_CONTACT_EMAIL}\n\n` +
      `С заботой,\nDARYADARCY`,
  });

  if (sent) {
    await platformDb.markShopDeliveryEmailSent(input.orderId);
    if (input.userId) {
      void sendServicePushNotification({
        userId: input.userId,
        title: "Покупка в магазине",
        body: `Ссылка на «${label}» отправлена на ${email}`,
        data: { type: "shop_delivery", orderId: input.orderId, productId: input.productId },
        target: "feed",
      });
    }
  }
}

export async function processPendingShopDeliveryEmails(): Promise<void> {
  if (!getCapabilities().shopOnlinePayment) return;
  const pending = await platformDb.listPendingShopDeliveryEmails(10);
  for (const row of pending) {
    await deliverShopPurchase({
      orderId: row.orderId,
      productId: row.productId,
      email: row.email,
      userId: row.userId,
    });
  }
}
