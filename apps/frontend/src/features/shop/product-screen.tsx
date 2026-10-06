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
import { requirePaymentUrl } from "@/shared/navigation/external-url";
import { useEffect, useState } from "react";
import { Picture } from "@/shared/media/image";
import { useRouter } from "@/shared/navigation/router";
import { useSafeAreaInsets } from "@/shared/ui/safe-area";
import { MaterialIcons } from "@/shared/ui/icons";
import { useAuth } from "@/domain/session/session-context";
import { ContactEmailLine } from "@/features/legal/contact-email-line";
import { LegalDocumentsFooter } from "@/features/legal/legal-documents-footer";
import { trpc } from "@/shared/api/trpc";
import { useCapabilities } from "@/shared/api/capabilities";
import {
  PAPER_TEXTURE_URI,
  BROWN,
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
export default function ProductDetailScreen({
  id,
  paid,
}: {
  id: string;
  paid?: string;
}) {
  const viewport = useViewport();
  const { stylesLayout } = getProductScreenLayout(viewport);

  const router = useRouter();
  const capabilities = useCapabilities();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const checkout = trpc.shop.createCheckout.useMutation();
  const ownedQuery = trpc.shop.owned.useQuery(
    { productId: String(id || "") },
    { enabled: Boolean(id) },
  );
  const refetchOwned = ownedQuery.refetch;
  useEffect(() => {
    if (paid !== "1" || !id) return;
    void refetchOwned();
    const timer = setInterval(() => void refetchOwned(), 2500);
    const stop = setTimeout(() => clearInterval(timer), 20000);
    return () => {
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [paid, id, refetchOwned]);
  const [zoomVisible, setZoomVisible] = useState(false);
  const [zoomImageUri, setZoomImageUri] = useState("");
  const [zoomIndex, setZoomIndex] = useState(0);
  const [payError, setPayError] = useState<string | null>(null);
  const product = PRODUCTS.find((p) => p.id === id);
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
  const owned = Boolean(ownedQuery.data?.owned);
  const handleBuyPress = (url: string) => {
    if (url.startsWith("prodamus:")) {
      if (!capabilities.shopOnlinePayment) return;
      void (async () => {
        setPayError(null);
        if (!isAuthenticated) {
          router.push(`/login?next=/shop/${product.id}`);
          return;
        }
        try {
          const result = await checkout.mutateAsync({ productId: product.id });
          const paymentUrl = requirePaymentUrl(result.url);
          if (typeof window !== "undefined") {
            window.location.assign(paymentUrl);
            return;
          }
          await openExternalUrl(paymentUrl);
        } catch (error) {
          setPayError(
            error instanceof Error
              ? error.message
              : "Не удалось открыть оплату",
          );
        }
      })();
      return;
    }
    openExternalUrl(url);
  };
  const openZoom = (uri: string, index: number) => {
    setZoomImageUri(uri);
    setZoomIndex(index);
    setZoomVisible(true);
  };
  const zoomPrev = () => {
    if (zoomIndex > 0) {
      const newIdx = zoomIndex - 1;
      setZoomIndex(newIdx);
      setZoomImageUri(gallery[newIdx]);
    }
  };
  const zoomNext = () => {
    if (zoomIndex < gallery.length - 1) {
      const newIdx = zoomIndex + 1;
      setZoomIndex(newIdx);
      setZoomImageUri(gallery[newIdx]);
    }
  };
  return (
    <Background
      source={{ uri: PAPER_TEXTURE_URI }}
      fit="cover"
      className={classes.div}
    >
      <ScrollArea hideScrollbar contentClassName={classes.scrollAreacontent}>
        {/* Header */}
        <div
          style={{ paddingTop: insets.top + 8 }}
          className={["ui-stack ", classes.div2].filter(Boolean).join(" ")}
        >
          <Action
            aria-label="Назад"
            onClick={() => router.back()}
            className={({ pressed }) =>
              [
                classes.action,
                pressed ? classes.opacityState : classes.opacityState2,
              ]
                .filter(Boolean)
                .join(" ")
            }
          >
            <MaterialIcons name="arrow-back" size={20} color={BROWN} />
          </Action>
          <div
            className={["ui-stack ", classes.div3].filter(Boolean).join(" ")}
          />
        </div>

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
                  onClick={() => openZoom(item, index)}
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
        {product.links.length > 0 && (
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
                  disabled={
                    checkout.isPending ||
                    (link.url.startsWith("prodamus:") &&
                      !capabilities.shopOnlinePayment)
                  }
                  style={({ pressed }) => ({
                    transform: cssTransform([{ scale: pressed ? 0.97 : 1 }]),
                  })}
                  onClick={() => {
                    if (product.type === "digital" && owned) return;
                    handleBuyPress(link.url);
                  }}
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
                    {product.type === "digital"
                      ? owned
                        ? "Оплачено"
                        : checkout.isPending
                          ? "Открываем…"
                          : `${link.name} →`
                      : `Купить на ${link.name} →`}
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
                      onClick={() => handleBuyPress(link.url)}
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
            {product.type === "digital" ? (
              owned ? (
                <Typography className={classes.typography}>
                  Оплата получена. Файл отправим на почту, указанную при оплате.
                </Typography>
              ) : (
                <Typography className={classes.typography}>
                  {payError ||
                    (checkout.isPending || authLoading
                      ? "Открываем оплату…"
                      : !capabilities.shopOnlinePayment
                        ? "Покупка этого материала пока недоступна."
                        : "Оплата через Prodamus. После оплаты файл придёт на почту.")}
                </Typography>
              )
            ) : null}
            {product.type === "digital" ? (
              <div
                className={["ui-stack ", classes.div4]
                  .filter(Boolean)
                  .join(" ")}
              >
                <ContactEmailLine prefix="Если письмо не пришло в течение 15 минут:" />
              </div>
            ) : null}
          </div>
        )}

        {product.links.length === 0 && (
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
                onClick={() => {
                  setZoomImageUri(imgUri);
                  setZoomVisible(true);
                }}
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
        open={zoomVisible}
        motion="fade"
        onClose={() => setZoomVisible(false)}
      >
        <div
          className={["ui-stack ", classes.zoomOverlay]
            .filter(Boolean)
            .join(" ")}
        >
          <Action
            aria-label="Закрыть просмотр фото"
            onClick={() => setZoomVisible(false)}
            style={{ top: insets.top + 16 }}
            className={classes.action6}
          >
            <MaterialIcons name="close" size={28} color="#fff" />
          </Action>

          <Picture
            source={{ uri: zoomImageUri }}
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
              {zoomIndex + 1} / {gallery.length}
            </Typography>
            <Action
              aria-label="Следующее фото"
              onClick={zoomNext}
              disabled={zoomIndex === gallery.length - 1}
              className={({ pressed }) =>
                [
                  classes.action7,
                  zoomIndex === gallery.length - 1
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
