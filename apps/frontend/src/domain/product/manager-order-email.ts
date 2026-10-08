import {
  parseManagerOrderSettings,
  type ManagerOrderSettings,
} from "@/domain/launch/settings";

export function managerOrderEmail(
  settings: ManagerOrderSettings,
  product: { id: string; title: string },
  origin: string,
): string {
  const { managerEmail } = parseManagerOrderSettings(settings);
  const site = new URL(origin);
  if (
    !["https:", "http:"].includes(site.protocol) ||
    site.username ||
    site.password
  )
    throw new Error("Не удалось подготовить ссылку на товар");
  const title = product.title.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  const productUrl = new URL(
    `/shop/${encodeURIComponent(product.id)}`,
    site.origin,
  );
  const subject = `Заказ: ${title}`;
  const body = `Здравствуйте!\n\nХочу заказать «${title}».\nТовар: ${productUrl.href}\n\nПодскажите, пожалуйста, как оформить заказ.`;
  return `mailto:${managerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
