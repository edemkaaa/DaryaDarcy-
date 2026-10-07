"use client";
import { useViewport } from "@/shared/browser/viewport";
import { useSearchParams } from "next/navigation";
import { useScreenActive } from "@/shared/navigation/screen-activity";

import { getClubScreenLayout } from "./club-screen.layout";
import classes from "./club-screen.module.scss";
import { cssTransform } from "@/shared/ui/css";
import {
  Background,
  ScrollArea,
  Typography,
  Field,
  Action,
  Spinner,
  Collection,
} from "@/shared/ui/elements";
import { openExternalUrl } from "@/shared/browser/actions";
import { requirePaymentUrl } from "@/shared/navigation/external-url";
import { useState, useCallback, useEffect } from "react";
import { ClubSubscribed } from "@/features/club/club-subscribed";
import { useClub } from "@/domain/subscription/subscription-context";
import { useAuth } from "@/domain/session/session-context";
import { SessionStatus } from "@/domain/session/session-status";
import { SubscriptionStatus } from "@/domain/subscription/subscription-status";
import { trpc } from "@/shared/api/trpc";
import { Picture } from "@/shared/media/image";
import { MaterialIcons } from "@/shared/ui/icons";
import { ScreenContainer } from "@/shared/ui/screen-container";
import { ClubTestimonials } from "./club-testimonials";
import {
  COMMUNITY_TESTIMONIALS,
  CLUB_TESTIMONIALS,
} from "./club-testimonials.content";

import { useRouter } from "@/shared/navigation/router";
import {
  PAPER_TEXTURE_URI,
  CLUB_BANNER_URL,
  BROWN_MUTED,
  CREAM,
  OLIVE,
  LETTER_CAROUSEL_IMAGES,
  EXCLUSIVE_CAROUSEL_IMAGES,
  GIVEAWAY_CAROUSEL_IMAGES,
  PODBORKI_CAROUSEL_IMAGES,
  BENEFITS,
} from "./club-screen.content";
import { getClubScreenContent } from "./club-screen.content";
export default function ClubScreen() {
  const active = useScreenActive();
  const currentParams = useSearchParams().toString();
  const [tabParams, setTabParams] = useState(currentParams);
  // Other routes may also have paid/checkout flags. Keep the hidden club's
  // view intact and only accept URL changes when this tab is active.
  if (active && tabParams !== currentParams) setTabParams(currentParams);
  const searchParams = new URLSearchParams(active ? currentParams : tabParams);
  const router = useRouter();
  const viewport = useViewport();
  const { stylesLayout } = getClubScreenLayout(viewport);
  const { SCREEN_WIDTH } = getClubScreenContent(viewport);
  const {
    isSubscribed,
    refreshSubscription,
    monthlyPrice,
    status: subscriptionStatus,
  } = useClub();
  const {
    isAuthenticated,
    loading: authLoading,
    user,
    error: sessionError,
  } = useAuth();
  const checkout = trpc.club.createCheckout.useMutation();
  const claimPending = trpc.club.claimPending.useMutation();
  const [payError, setPayError] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState("");
  const forceCheckout = searchParams.get("checkout") === "1";
  const justPaid = searchParams.get("paid") === "1";
  const openPayUrl = useCallback((url: string) => {
    const safe = requirePaymentUrl(url);
    if (typeof window !== "undefined") {
      window.location.assign(safe);
      return;
    }
    void openExternalUrl(safe);
  }, []);
  const handlePay = useCallback(async () => {
    setPayError(null);
    const email = (user?.email || guestEmail).trim();
    if (!isAuthenticated && !email) {
      setPayError("Укажите почту — на неё придёт чек, затем откроется оплата.");
      return;
    }
    try {
      const result = await checkout.mutateAsync(email ? { email } : undefined);
      openPayUrl(result.url);
    } catch (error) {
      setPayError(
        error instanceof Error ? error.message : "Не удалось открыть оплату",
      );
    }
  }, [
    checkout,
    guestEmail,
    isAuthenticated,
    openPayUrl,
    user?.email,
    setPayError,
  ]);
  const claimPendingPayment = claimPending.mutateAsync;
  useEffect(() => {
    if (!active || !justPaid || authLoading || !isAuthenticated) return;
    let cancelled = false;
    void (async () => {
      try {
        await claimPendingPayment();
      } catch {}
      if (!cancelled) refreshSubscription();
    })();
    const timer = setInterval(() => refreshSubscription(), 2500);
    const stop = setTimeout(() => clearInterval(timer), 20000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [
    active,
    justPaid,
    authLoading,
    isAuthenticated,
    refreshSubscription,
    claimPendingPayment,
  ]);
  const [, setActiveLetterIndex] = useState(0);
  const onLetterScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const offsetX = e.currentTarget.scrollLeft;
      const index = Math.round(offsetX / (SCREEN_WIDTH * 0.4 + 10));
      setActiveLetterIndex(index);
    },
    [SCREEN_WIDTH],
  );
  // ── Subscribed state ──
  if (authLoading || sessionError) return <SessionStatus />;
  if (subscriptionStatus === "checking" || subscriptionStatus === "error") {
    return (
      <ScreenContainer backgroundColor="#FDF8F0">
        <SubscriptionStatus />
      </ScreenContainer>
    );
  }
  if (isSubscribed && !forceCheckout) {
    return <ClubSubscribed />;
  }
  // ── Subscription Landing Page (including an explicit renewal) ──
  if (!isSubscribed || forceCheckout) {
    return (
      <ScreenContainer edges={["left", "right"]} backgroundColor="#F5EDE3">
        <Background
          source={{ uri: PAPER_TEXTURE_URI }}
          fit="cover"
          className={classes.background}
        >
          <ScrollArea hideScrollbar>
            {/* Banner with overlaid header */}
            <div
              className={["ui-stack ", classes.div].filter(Boolean).join(" ")}
            >
              <div
                className={["ui-stack ", classes.heroBanner]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Picture
                  source={{ uri: CLUB_BANNER_URL }}
                  contentFit="cover"
                  transition={400}
                  className={classes.heroBannerImage}
                />
              </div>
            </div>

            {/* Description */}
            <div
              className={["ui-stack ", classes.subtitleContainer]
                .filter(Boolean)
                .join(" ")}
            >
              <Typography className={classes.subtitleDescription}>
                Безопасное пространство для тех, кому важна красота в жизни, а
                не только на экране.
              </Typography>
              <Typography className={classes.dotSeparator}>•</Typography>
              <Typography className={classes.subtitleDescription}>
                Творческая атмосфера, доброе комьюнити, эксклюзивные материалы и
                подборки от Дарьи — не просто вдохновение, а часть вашей
                повседневной жизни.
              </Typography>
              <Typography className={classes.dotSeparator}>•</Typography>
              <Typography className={classes.subtitleDescription}>
                Место, где можно быть{" "}
                <Typography className={classes.italicText}>ближе</Typography> и
                получать{" "}
                <Typography className={classes.italicText}>больше</Typography>.
              </Typography>
            </div>

            <div
              className={["ui-stack ", classes.priceSection]
                .filter(Boolean)
                .join(" ")}
            >
              {!isAuthenticated ? (
                <Field
                  placeholder="Почта для чека и входа"
                  placeholderColor={BROWN_MUTED}
                  autoCapitalize="off"
                  inputMode="email"
                  value={guestEmail}
                  onValueChange={setGuestEmail}
                  className={classes.guestEmail}
                />
              ) : null}
              <Action
                style={({ pressed }) => ({
                  transform: cssTransform([{ scale: pressed ? 0.97 : 1 }]),
                })}
                disabled={checkout.isPending || authLoading}
                onClick={() => void handlePay()}
                className={({ pressed }) =>
                  [
                    classes.action,
                    pressed || checkout.isPending
                      ? classes.opacityState
                      : classes.opacityState2,
                  ]
                    .filter(Boolean)
                    .join(" ")
                }
              >
                {checkout.isPending ? (
                  <Spinner color={CREAM} />
                ) : (
                  <MaterialIcons name="star" size={18} color={CREAM} />
                )}
                <Typography className={classes.subscribeButtonText}>
                  Оплатить {monthlyPrice} ₽
                </Typography>
              </Action>
              {payError ? (
                <Typography className={classes.typography}>
                  {payError}
                </Typography>
              ) : null}
            </div>

            {/* Benefits */}
            <div
              className={["ui-stack ", classes.benefitsSection]
                .filter(Boolean)
                .join(" ")}
            >
              <Typography className={classes.benefitsSectionTitle}>
                Что входит в подписку:
              </Typography>
              {BENEFITS.map((benefit, index) => (
                <div key={index} className="ui-stack ">
                  <div
                    className={["ui-stack ", classes.benefitCard]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <div
                      className={["ui-stack ", classes.benefitIcon]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <MaterialIcons
                        name={benefit.icon}
                        size={22}
                        color={OLIVE}
                      />
                    </div>
                    <div
                      className={["ui-stack ", classes.benefitText]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <Typography className={classes.benefitTitle}>
                        {benefit.title}
                      </Typography>
                      <Typography className={classes.benefitDescription}>
                        {benefit.description}
                      </Typography>
                    </div>
                  </div>
                  {/* Letter carousel after Письмо месяца */}
                  {benefit.title === "Эксклюзивные материалы" && (
                    <div
                      className={["ui-stack ", classes.letterCarouselContainer]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <Collection
                        data={EXCLUSIVE_CAROUSEL_IMAGES}
                        horizontal
                        hideScrollbar
                        keyExtractor={(_, i) => `exclusive-${i}`}
                        snapInterval={SCREEN_WIDTH * 0.7 + 10}
                        renderItem={({ item }) => (
                          <div
                            style={{
                              width: stylesLayout.exclusiveCarouselSlide.width,
                            }}
                            className={[
                              "ui-stack ",
                              classes.exclusiveCarouselSlide,
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            <Picture
                              source={{ uri: item }}
                              contentFit="contain"
                              sizes="(max-width: 480px) 70vw, 336px"
                              transition={300}
                              className={classes.exclusiveCarouselImage}
                            />
                          </div>
                        )}
                        contentClassName={classes.collectioncontent}
                      />
                    </div>
                  )}
                  {benefit.title === "Розыгрыши" && (
                    <div
                      className={["ui-stack ", classes.letterCarouselContainer]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <Collection
                        data={GIVEAWAY_CAROUSEL_IMAGES}
                        horizontal
                        hideScrollbar
                        keyExtractor={(_, i) => `giveaway-${i}`}
                        snapInterval={SCREEN_WIDTH * 0.75 + 10}
                        renderItem={({ item }) => (
                          <div
                            style={{
                              width: stylesLayout.giveawayCarouselSlide.width,
                            }}
                            className={[
                              "ui-stack ",
                              classes.giveawayCarouselSlide,
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            <Picture
                              source={{ uri: item }}
                              contentFit="contain"
                              sizes="(max-width: 480px) 75vw, 360px"
                              transition={300}
                              className={classes.giveawayCarouselImage}
                            />
                          </div>
                        )}
                        contentClassName={classes.collectioncontent}
                      />
                    </div>
                  )}
                  {benefit.title === "Доброе комьюнити" && (
                    <div
                      className={["ui-stack ", classes.letterCarouselContainer]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <ClubTestimonials
                        items={COMMUNITY_TESTIMONIALS}
                        label="О клубном комьюнити"
                      />
                    </div>
                  )}
                  {benefit.title === "Подборки" && (
                    <div
                      className={["ui-stack ", classes.letterCarouselContainer]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <Collection
                        data={PODBORKI_CAROUSEL_IMAGES}
                        horizontal
                        hideScrollbar
                        keyExtractor={(_, i) => `podborki-${i}`}
                        snapInterval={SCREEN_WIDTH * 0.4 + 10}
                        renderItem={({ item }) => (
                          <div
                            style={{
                              width: stylesLayout.letterCarouselSlide.width,
                            }}
                            className={[
                              "ui-stack ",
                              classes.letterCarouselSlide,
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            <Picture
                              source={{ uri: item }}
                              contentFit="cover"
                              sizes="(max-width: 480px) 40vw, 192px"
                              transition={300}
                              className={classes.letterCarouselImage}
                            />
                          </div>
                        )}
                        contentClassName={classes.collectioncontent}
                      />
                    </div>
                  )}
                  {benefit.title === "Письмо месяца" && (
                    <div
                      className={["ui-stack ", classes.letterCarouselContainer]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <Collection
                        data={LETTER_CAROUSEL_IMAGES}
                        horizontal
                        hideScrollbar
                        keyExtractor={(_, i) => `letter-${i}`}
                        onScroll={onLetterScroll}
                        snapInterval={SCREEN_WIDTH * 0.4 + 10}
                        renderItem={({ item }) => (
                          <div
                            style={{
                              width: stylesLayout.letterCarouselSlide.width,
                            }}
                            className={[
                              "ui-stack ",
                              classes.letterCarouselSlide,
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            <Picture
                              source={{ uri: item }}
                              contentFit="cover"
                              sizes="(max-width: 480px) 40vw, 192px"
                              transition={300}
                              className={classes.letterCarouselImage}
                            />
                          </div>
                        )}
                        contentClassName={classes.collectioncontent}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Privileges */}
            <div
              className={["ui-stack ", classes.priceSection]
                .filter(Boolean)
                .join(" ")}
            >
              <Typography className={classes.privilegesTitle}>
                Привилегии:
              </Typography>
              <Typography className={classes.privilegesItem}>
                {"\u2022"} доступ к лучшим материалам клуба за 2 года
              </Typography>
              <Typography className={classes.privilegesItem}>
                {"\u2022"} развернутые результаты теста на личную эстетику
              </Typography>
              <Typography className={classes.privilegesItem}>
                {"\u2022"} эксклюзивные гиды и выкройки
              </Typography>
            </div>

            {/* Price & Subscribe */}
            <div
              className={["ui-stack ", classes.priceSection]
                .filter(Boolean)
                .join(" ")}
            >
              <div
                className={["ui-stack ", classes.priceCard]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Typography className={classes.priceLabel}>
                  Варианты подписки
                </Typography>
                <Typography className={classes.planName}>Ежемесячно</Typography>
                <div
                  className={["ui-stack ", classes.priceRow]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Typography className={classes.priceAmount}>
                    {monthlyPrice} ₽
                  </Typography>
                  <Typography className={classes.pricePeriod}>
                    {" "}
                    / месяц
                  </Typography>
                </div>
                <Typography className={classes.priceNote}>
                  Автосписание каждый месяц. Отменить можно в профиле в любой
                  момент — доступ сохранится до конца оплаченного периода.
                </Typography>
                {!isAuthenticated ? (
                  <Field
                    placeholder="Почта для чека и входа"
                    placeholderColor={BROWN_MUTED}
                    autoCapitalize="off"
                    inputMode="email"
                    value={guestEmail}
                    onValueChange={setGuestEmail}
                    className={classes.guestEmail}
                  />
                ) : null}
                <Action
                  style={({ pressed }) => ({
                    transform: cssTransform([{ scale: pressed ? 0.97 : 1 }]),
                  })}
                  disabled={checkout.isPending || authLoading}
                  onClick={() => void handlePay()}
                  className={({ pressed }) =>
                    [
                      classes.action,
                      pressed || checkout.isPending
                        ? classes.opacityState3
                        : classes.opacityState4,
                    ]
                      .filter(Boolean)
                      .join(" ")
                  }
                >
                  {checkout.isPending ? (
                    <Spinner color={CREAM} />
                  ) : (
                    <MaterialIcons name="star" size={18} color={CREAM} />
                  )}
                  <Typography className={classes.subscribeButtonText}>
                    Оплатить {monthlyPrice} ₽
                  </Typography>
                </Action>
                {isAuthenticated ? (
                  <Action
                    onClick={async () => {
                      setPayError(null);
                      try {
                        const result = await claimPendingPayment();
                        refreshSubscription();
                        if (!result.granted) {
                          setPayError(
                            "Оплата ещё не найдена. Если вы только что заплатили, подождите минуту и нажмите ещё раз.",
                          );
                        }
                      } catch (error) {
                        setPayError(
                          error instanceof Error
                            ? error.message
                            : "Не удалось подтвердить оплату",
                        );
                      }
                    }}
                    className={classes.action2}
                  >
                    <Typography className={classes.privacyLink}>
                      Я уже оплатила
                    </Typography>
                  </Action>
                ) : null}
                {justPaid ? (
                  <Typography className={classes.priceNote}>
                    Проверяем оплату… Доступ откроется после подтверждения.
                  </Typography>
                ) : null}
                {payError ? (
                  <Typography className={classes.priceNote}>
                    {payError}
                  </Typography>
                ) : null}
                <Action
                  onClick={() => router.push("/privacy")}
                  className={classes.action3}
                >
                  <Typography className={classes.privacyLink}>
                    Политика конфиденциальности
                  </Typography>
                </Action>
              </div>
            </div>

            {/* Reviews Carousel */}
            <div
              className={["ui-stack ", classes.reviewsSection]
                .filter(Boolean)
                .join(" ")}
            >
              <ClubTestimonials
                items={CLUB_TESTIMONIALS}
                label="Отзывы участниц"
                title="Отзывы участниц"
              />
            </div>

            <div
              className={["ui-stack ", classes.div2].filter(Boolean).join(" ")}
            />
          </ScrollArea>
        </Background>
      </ScreenContainer>
    );
  }
  // Unreachable fallback
  return null;
}
