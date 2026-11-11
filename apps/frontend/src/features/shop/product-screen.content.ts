/** Ресурсы и подписи карточки товара отделены от компонентов; изменение этих данных входит в клиентскую сборку. */
import type { ViewportSize } from "@/shared/browser/viewport";

export { PRODUCT_DETAILS as PRODUCTS } from "@/domain/product/catalog";
export type { Product as Product } from "@/domain/product/catalog";
export const PAPER_TEXTURE_URI =
  "/assets/responsive/d0db18ed8f2e-MasrlKbgCBdeyOhE.w1440.fe3ce71852fa6634.webp";
export const BROWN = "#3D2B1F";
export const BROWN_MUTED = "#8B7355";
export const BROWN_LIGHT = "#D4C4A8";
export const CREAM = "#FDF8F0";

export const SHOP_MISSING_FILES = new Set([
  "veXysoFDZMKZaCDB.PNG",
  "koLmphlWqhNfBNNV.jpeg",
  "sVhxDQBKkyhDDdnM.jpeg",
  "qqJOhCdOtezhXgRL.jpeg",
  "cQOxsMCmqBHNodJb.jpeg",
  "acowSIYLDimbpFaU.jpeg",
  "agcZRQuPqqUIkbfg.jpeg",
  "kIvlvGffqWCvSlth.PNG",
  "UouzQSOhhezBWDeT.webp",
  "cDggMTjJaSHKEpui.webp",
  "ewxmaFgszedwfCDc.webp",
  "wOGcBVuJHDvZVMSb.webp",
  "SAzFHKXBjPlpSODC.webp",
  "xECVAhnvSMZUDvKV.webp",
  "duefjXzIoLGcxdSk.JPG",
  "luiZwEIyLvSFPdXH.JPG",
]);

/** Размер карусели задаётся долей ширины; детальный каталог переиспользуется из domain без копирования товаров. */
export function getProductScreenContent(viewport: ViewportSize) {
  const { width: SCREEN_WIDTH } = viewport;
  const CAROUSEL_ITEM_WIDTH = SCREEN_WIDTH * 0.58;
  const CAROUSEL_ITEM_HEIGHT = CAROUSEL_ITEM_WIDTH * (5 / 4);
  return { SCREEN_WIDTH, CAROUSEL_ITEM_WIDTH, CAROUSEL_ITEM_HEIGHT };
}
