/** Ресурсы и подписи витрины Магазина отделены от компонентов; изменение этих данных входит в клиентскую сборку. */
import type { ViewportSize } from "@/shared/browser/viewport";

export { SHELF_PRODUCTS as PRODUCTS } from "@/domain/product/catalog";
export type { ShelfProduct as Product } from "@/domain/product/catalog";
export const PAPER_TEXTURE_URI =
  "/assets/responsive/d0db18ed8f2e-MasrlKbgCBdeyOhE.w1440.fe3ce71852fa6634.webp";
export const SHOP_BROWN = "#5C4033";
export const ASSETS = {
  // User's Photoshop shelf background (1021x3118)
  shelfBg:
    "/assets/responsive/ed5c0d6e67b1-XTxEeqUQaizDpkGL.w1021.41295f07fcd8f1aa.webp",
  // Decorative Tudor house figurine (transparent bg)
  house:
    "/assets/responsive/b010b81b5866-rvMvDhDknWfcKisy.w900.85be0a511d9e1c58.webp",
  // Metal label frame for shelf edge (wide version)
  labelFrame:
    "/assets/responsive/afae02aa817a-shelf-label-frame-wide-iUo6pePUPBamyiM9D5NVtE.w1200.30582a18c6fb5bad.webp",
  // Price tags (user-provided with transparent bg)
  priceTag2000:
    "/assets/responsive/e197a59fb5c3-qFGLTXCnSORlpLhB.w900.a5486ca7e1360951.webp",
  priceTag1000:
    "/assets/responsive/98ab8fafc475-UumiPOEfgzXJXOMx.w900.cfac9f24edadc576.webp",
};

export const BOOK_GAP = 8;

/** Вычисляем пропорции полок, книг, цифровых товаров и табличек из одной ширины полотна. */
export function getShopScreenContent(viewport: ViewportSize) {
  const { width: SCREEN_WIDTH } = viewport;
  const SHELF_SIDE = Math.round(SCREEN_WIDTH * 0.072);
  const BOOK_WIDTH = Math.floor(
    (SCREEN_WIDTH - SHELF_SIDE * 2 - BOOK_GAP * 2) / 3,
  );
  const BOOK_HEIGHT = BOOK_WIDTH * 1.36;
  const DIGITAL_SIDE = Math.round(SCREEN_WIDTH * 0.18);
  const HOUSE_WIDTH = SCREEN_WIDTH * 0.42;
  const HOUSE_HEIGHT = HOUSE_WIDTH * 0.75;
  const LABEL_WIDTH = SCREEN_WIDTH * 0.21;
  const LABEL_HEIGHT = LABEL_WIDTH / 2.33;
  return {
    SCREEN_WIDTH,
    SHELF_SIDE,
    BOOK_WIDTH,
    BOOK_HEIGHT,
    DIGITAL_SIDE,
    HOUSE_WIDTH,
    HOUSE_HEIGHT,
    LABEL_WIDTH,
    LABEL_HEIGHT,
  };
}
