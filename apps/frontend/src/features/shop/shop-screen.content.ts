import type { ViewportSize } from "@/shared/browser/viewport";

export { SHELF_PRODUCTS as PRODUCTS } from "@/domain/product/catalog";
export type { ShelfProduct as Product } from "@/domain/product/catalog";
export const PAPER_TEXTURE_URI =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg";
export const SHOP_BROWN = "#5C4033";
export const ASSETS = {
  // User's Photoshop shelf background (1021x3118)
  shelfBg:
    "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/ed5c0d6e67b1-XTxEeqUQaizDpkGL.jpg",
  // Decorative Tudor house figurine (transparent bg)
  house:
    "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/b010b81b5866-rvMvDhDknWfcKisy.webp",
  // Metal label frame for shelf edge (wide version)
  labelFrame:
    "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/cloudfront/afae02aa817a-shelf-label-frame-wide-iUo6pePUPBamyiM9D5NVtE.webp",
  // Price tags (user-provided with transparent bg)
  priceTag2000:
    "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/e197a59fb5c3-qFGLTXCnSORlpLhB.webp",
  priceTag1000:
    "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/98ab8fafc475-UumiPOEfgzXJXOMx.webp",
};

export const BOOK_GAP = 8;

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
