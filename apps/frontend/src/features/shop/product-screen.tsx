"use client";
import { useViewport } from "@/shared/browser/viewport";

import { getProductScreenLayout } from "./product-screen.layout";
import classes from "./product-screen.module.scss";
import { cssTransform } from "@/shared/ui/css";
import {
  Typography,
  Background,
  ScrollArea,
  Action,
  Collection,
  Dialog,
} from "@/shared/ui/elements";
import { openExternalUrl } from "@/shared/browser/actions";
import { useState } from "react";
import { Picture } from "@/shared/media/image";
import { useSafeAreaInsets } from "@/shared/ui/safe-area";
import { MaterialIcons } from "@/shared/ui/icons";
import { LegalDocumentsFooter } from "@/features/legal/legal-documents-footer";
import { useManagerOrderSettings } from "@/domain/launch/use-manager-order-settings";
import { managerOrderEmail } from "@/domain/product/manager-order-email";
import { QueryRetryState } from "@/shared/ui/query-retry-state";
import {
  PAPER_TEXTURE_URI,
  BROWN_MUTED,
  BROWN_LIGHT,
  CREAM,
  PRODUCTS,
  SHOP_MISSING_FILES,
} from "./product-screen.content";
function isPublicShopAsset(url: string): boolean {
  if (!url.includes("/app-assets/shop/")) return true;
  const file = url.split("/").pop() || "";
  return !SHOP_MISSING_FILES.has(file);
}
export default function ProductDetailScreen({ id }: { id: string }) {
  const product = PRODUCTS.find((p) => p.id === id);
  const viewport = useViewport();
  const { stylesLayout } = getProductScreenLayout(viewport);

  const managerOrderEnabled = product?.type === "digital";
  const manager = useManagerOrderSettings(managerOrderEnabled);
  const insets = useSafeAreaInsets();
  const [zoom, setZoom] = useState<{
    images: readonly string[];
    index: number;
  } | null>(null);
  if (!product) {
    return (
      <div
        style={{ paddingTop: insets.top }}
        className={["ui-stack ", classes.div].filter(Boolean).join(" ")}
      >
        <Typography className={classes.errorText}>Товар не найден</Typography>
      </div>
    );
  }
  const coverUrl = isPublicShopAsset(product.coverUrl)
    ? product.coverUrl
    : product.imageUrl;
  const gallery = (product.gallery || []).filter(isPublicShopAsset);
  const reviewImages = (product.reviewImages || []).filter(isPublicShopAsset);
  const orderHref =
    managerOrderEnabled &&
    manager.settings &&
    !manager.isFetching &&
    !manager.isPaused &&
    typeof window !== "undefined"
      ? managerOrderEmail(manager.settings, product, window.location.origin)
      : null;
  const zoomImages = zoom?.images ?? [];
  const zoomIndex = zoom?.index ?? 0;
  const openZoom = (images: readonly string[], index: number) => {
    if (images[index]) setZoom({ images, index });
  };
  const zoomPrev = () => {
    setZoom((current) =>
      current && current.index > 0
        ? { ...current, index: current.index - 1 }
        : current,
    );
  };
  const zoomNext = () => {
    setZoom((current) =>
      current && current.index < current.images.length - 1
        ? { ...current, index: current.index + 1 }
        : current,
    );
  };
  return (
    <Background
      source={{ uri: PAPER_TEXTURE_URI }}
      fit="cover"
      className={classes.div}
    >
      <ScrollArea hideScrollbar contentClassName={classes.scrollAreacontent}>
        {/* Cover Image */}
        <div
          className={["ui-stack ", classes.coverSection]
            .filter(Boolean)
            .join(" ")}
        >
          <Picture
            source={{ uri: coverUrl }}
            style={{
              width:
                product.type === "book"
                  ? stylesLayout.coverImagePng.width
                  : stylesLayout.coverImage.width,
            }}
            contentFit={product.type === "book" ? "contain" : "cover"}
            transition={300}
            className={
              product.type === "book"
                ? classes.appearanceState
                : classes.appearanceState2
            }
          />
        </div>

        {/* Title Section */}
        <div
          className={["ui-stack ", classes.titleSection]
            .filter(Boolean)
            .join(" ")}
        >
          <Typography className={classes.productTitle}>
            {product.title.toLocaleUpperCase("ru-RU")}
          </Typography>
          <Typography className={classes.productSubtitle}>
            {product.subtitle}
          </Typography>
        </div>

        {/* Gallery Carousel — smooth scroll, no pagination dots */}
        {gallery.length > 0 && (
          <div
            className={["ui-stack ", classes.gallerySection]
              .filter(Boolean)
              .join(" ")}
          >
            <Collection
              data={gallery}
              horizontal
              hideScrollbar
              keyExtractor={(_, i) => `gallery-${i}`}
              renderItem={({ item, index }) => (
                <Action
                  aria-label={`Открыть фото товара ${index + 1}`}
                  onClick={() => openZoom(gallery, index)}
                  style={() => ({
                    width: stylesLayout.carouselItem.width,
                    height: stylesLayout.carouselItem.height,
                  })}
                  className={({ pressed }) =>
                    [
                      classes.action2,
                      pressed ? classes.opacityState3 : classes.opacityState4,
                    ]
                      .filter(Boolean)
                      .join(" ")
                  }
                >
                  <Picture
                    source={{ uri: item }}
                    contentFit="cover"
                    sizes="(max-width: 480px) 58vw, 278px"
                    transition={200}
                    className={classes.carouselImage}
                  />
                </Action>
              )}
              contentClassName={classes.carouselList}
            />
          </div>
        )}

        {/* Buy Buttons */}
        {managerOrderEnabled ? (
          <div className={`ui-stack ${classes.buySection}`}>
            {orderHref ? (
              <a
                href={orderHref}
                className={`ui-action ${classes.action3} ${classes.managerOrderLink}`}
              >
                <MaterialIcons name="shopping-cart" size={16} color={CREAM} />
                <Typography className={classes.buyButtonText}>
                  Заказать через менеджера →
                </Typography>
              </a>
            ) : (
              <Action disabled className={classes.action3}>
                <MaterialIcons name="shopping-cart" size={16} color={CREAM} />
                <Typography className={classes.buyButtonText}>
                  {manager.isLoading || manager.isFetching
                    ? "Загружаем контакт менеджера…"
                    : manager.isPaused
                      ? "Нет соединения"
                      : "Заказать через менеджера →"}
                </Typography>
              </Action>
            )}
            <Typography className={classes.typography}>
              Откроется почтовое приложение. Отправьте письмо менеджеру
              самостоятельно.
            </Typography>
            {orderHref && manager.settings ? (
              <Typography className={classes.typography}>
                Если приложение не открылось, напишите:{" "}
                {manager.settings.managerEmail}
              </Typography>
            ) : null}
            {manager.isPaused ? (
              <Typography className={classes.typography}>
                Подключитесь к интернету, чтобы загрузить контакт менеджера.
              </Typography>
            ) : null}
            <QueryRetryState
              isLoading={false}
              isError={Boolean(manager.error)}
              onRetry={() => {
                void manager.retry();
              }}
              message="Не удалось загрузить контакт менеджера. Попробуйте ещё раз."
            />
          </div>
        ) : product.links.length > 0 ? (
          <div
            className={["ui-stack ", classes.buySection]
              .filter(Boolean)
              .join(" ")}
          >
            {product.links
              .filter((l) => !l.size || l.size === "primary")
              .map((link, index) => (
                <Action
                  key={`primary-${index}`}
                  style={({ pressed }) => ({
                    transform: cssTransform([{ scale: pressed ? 0.97 : 1 }]),
                  })}
                  onClick={() => void openExternalUrl(link.url)}
                  className={({ pressed }) =>
                    [
                      classes.action3,
                      pressed ? classes.opacityState5 : classes.opacityState6,
                    ]
                      .filter(Boolean)
                      .join(" ")
                  }
                >
                  <MaterialIcons name="shopping-cart" size={16} color={CREAM} />
                  <Typography className={classes.buyButtonText}>
                    Купить на {link.name} →
                  </Typography>
                </Action>
              ))}
            {product.links.filter((l) => l.size === "secondary").length > 0 && (
              <div
                className={["ui-stack ", classes.secondaryRow]
                  .filter(Boolean)
                  .join(" ")}
              >
                {product.links
                  .filter((l) => l.size === "secondary")
                  .map((link, index) => (
                    <Action
                      key={`secondary-${index}`}
                      onClick={() => void openExternalUrl(link.url)}
                      className={({ pressed }) =>
                        [
                          classes.action4,
                          pressed
                            ? classes.opacityState7
                            : classes.opacityState8,
                        ]
                          .filter(Boolean)
                          .join(" ")
                      }
                    >
                      <Typography className={classes.secondaryButtonText}>
                        {link.name}
                      </Typography>
                    </Action>
                  ))}
              </div>
            )}
          </div>
        ) : null}

        {!managerOrderEnabled && product.links.length === 0 && (
          <div
            className={["ui-stack ", classes.buySection]
              .filter(Boolean)
              .join(" ")}
          >
            <div
              className={["ui-stack ", classes.comingSoonBadge]
                .filter(Boolean)
                .join(" ")}
            >
              <MaterialIcons name="schedule" size={15} color={BROWN_MUTED} />
              <Typography className={classes.comingSoonText}>
                Ссылка на покупку скоро появится
              </Typography>
            </div>
          </div>
        )}

        {/* Description */}
        <div
          className={["ui-stack ", classes.descriptionSection]
            .filter(Boolean)
            .join(" ")}
        >
          <div
            className={["ui-stack ", classes.sectionHeader]
              .filter(Boolean)
              .join(" ")}
          >
            <MaterialIcons name="auto-stories" size={18} color={BROWN_MUTED} />
            <Typography className={classes.sectionTitle}>
              {product.aboutTitle || "О книге"}
            </Typography>
          </div>
          <Typography className={classes.descriptionText}>
            {product.description}
          </Typography>
        </div>

        {/* Details / Characteristics */}
        {product.details && product.details.length > 0 && (
          <div
            className={["ui-stack ", classes.detailsSection]
              .filter(Boolean)
              .join(" ")}
          >
            <div
              className={["ui-stack ", classes.sectionHeader]
                .filter(Boolean)
                .join(" ")}
            >
              <MaterialIcons
                name="info-outline"
                size={18}
                color={BROWN_MUTED}
              />
              <Typography className={classes.sectionTitle}>
                Характеристики
              </Typography>
            </div>
            {product.details.map((detail, index) => (
              <div
                key={index}
                className={["ui-stack ", classes.detailRow]
                  .filter(Boolean)
                  .join(" ")}
              >
                <MaterialIcons name="check" size={14} color={BROWN_LIGHT} />
                <Typography className={classes.detailText}>{detail}</Typography>
              </div>
            ))}
          </div>
        )}

        {/* Reviews Section */}
        {((product.reviews && product.reviews.length > 0) ||
          reviewImages.length > 0) && (
          <div
            className={["ui-stack ", classes.reviewsSection]
              .filter(Boolean)
              .join(" ")}
          >
            <div
              className={["ui-stack ", classes.sectionHeader]
                .filter(Boolean)
                .join(" ")}
            >
              <MaterialIcons
                name="format-quote"
                size={18}
                color={BROWN_MUTED}
              />
              <Typography className={classes.sectionTitle}>Отзывы</Typography>
            </div>

            {/* Review Images (tappable for fullscreen) */}
            {reviewImages.map((imgUri, idx) => (
              <Action
                aria-label={`Открыть фото отзыва ${idx + 1}`}
                key={`review-img-${idx}`}
                onClick={() => openZoom(reviewImages, idx)}
                className={({ pressed }) =>
                  [classes.action5, pressed ? classes.opacityState9 : ""]
                    .filter(Boolean)
                    .join(" ")
                }
              >
                <Picture
                  source={{ uri: imgUri }}
                  contentFit="contain"
                  className={classes.reviewImage}
                />
              </Action>
            ))}

            {/* Text Reviews */}
            {product.reviews &&
              product.reviews.map((review, idx) => (
                <div
                  key={`review-${idx}`}
                  className={["ui-stack ", classes.reviewCard]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div
                    className={["ui-stack ", classes.reviewQuoteIcon]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <MaterialIcons
                      name="format-quote"
                      size={16}
                      color={BROWN_LIGHT}
                    />
                  </div>
                  <Typography className={classes.reviewText}>
                    {review.text}
                  </Typography>
                  {review.author && (
                    <Typography className={classes.reviewAuthor}>
                      @{review.author}
                    </Typography>
                  )}
                </div>
              ))}
          </div>
        )}

        {/* Decorative footer */}
        <div
          className={["ui-stack ", classes.footerDecor]
            .filter(Boolean)
            .join(" ")}
        >
          <div
            className={["ui-stack ", classes.dividerLine]
              .filter(Boolean)
              .join(" ")}
          />
          <MaterialIcons name="eco" size={14} color={BROWN_LIGHT} />
          <div
            className={["ui-stack ", classes.dividerLine]
              .filter(Boolean)
              .join(" ")}
          />
        </div>
        <LegalDocumentsFooter className={classes.legalDocumentsFooter} />
      </ScrollArea>

      {/* Fullscreen Zoom Modal */}
      <Dialog
        label="Просмотр фотографии товара"
        open={zoom !== null}
        motion="fade"
        onClose={() => setZoom(null)}
      >
        <div
          className={["ui-stack ", classes.zoomOverlay]
            .filter(Boolean)
            .join(" ")}
        >
          <Action
            aria-label="Закрыть просмотр фото"
            onClick={() => setZoom(null)}
            style={{ top: insets.top + 16 }}
            className={classes.action6}
          >
            <MaterialIcons name="close" size={28} color="#fff" />
          </Action>

          <Picture
            source={{ uri: zoomImages[zoomIndex] ?? "" }}
            fullSize
            style={{
              width: stylesLayout.zoomImage.width,
              height: stylesLayout.zoomImage.height,
            }}
            contentFit="contain"
            transition={200}
          />

          <div
            className={["ui-stack ", classes.zoomNavRow]
              .filter(Boolean)
              .join(" ")}
          >
            <Action
              aria-label="Предыдущее фото"
              onClick={zoomPrev}
              disabled={zoomIndex === 0}
              className={({ pressed }) =>
                [
                  classes.action7,
                  zoomIndex === 0
                    ? classes.opacityState10
                    : pressed
                      ? classes.opacityState11
                      : classes.opacityState12,
                ]
                  .filter(Boolean)
                  .join(" ")
              }
            >
              <MaterialIcons name="chevron-left" size={36} color="#fff" />
            </Action>
            <Typography className={classes.zoomCounter}>
              {zoomIndex + 1} / {zoomImages.length}
            </Typography>
            <Action
              aria-label="Следующее фото"
              onClick={zoomNext}
              disabled={zoomIndex === zoomImages.length - 1}
              className={({ pressed }) =>
                [
                  classes.action7,
                  zoomIndex === zoomImages.length - 1
                    ? classes.opacityState13
                    : pressed
                      ? classes.opacityState14
                      : classes.opacityState15,
                ]
                  .filter(Boolean)
                  .join(" ")
              }
            >
              <MaterialIcons name="chevron-right" size={36} color="#fff" />
            </Action>
          </div>
        </div>
      </Dialog>
    </Background>
  );
}
