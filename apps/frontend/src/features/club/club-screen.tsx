"use client";
import { useViewport } from "@/shared/browser/viewport";
import { useClubNavigation } from "@/shared/navigation/use-club-navigation";
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
import { useState, useCallback } from "react";
import { ClubSubscribed } from "@/features/club/club-subscribed";
import { useClub } from "@/domain/subscription/subscription-context";
import { useAuth } from "@/domain/session/session-context";
import { SessionStatus } from "@/domain/session/session-status";
import { SubscriptionStatus } from "@/domain/subscription/subscription-status";
import { useClubPayment } from "./use-club-payment";
import { Picture } from "@/shared/media/image";
import { MaterialIcons } from "@/shared/ui/icons";
import { ScreenContainer } from "@/shared/ui/screen-container";
import { ScreenStatus } from "@/shared/ui/screen-status";
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
import { ClubCheckoutMode } from "./checkout-mode";
import { getClubPaymentMode } from "./payment-mode";
export default function ClubScreen() {
  return (
    <ClubCheckoutMode>
      <LegacyClubScreen />
    </ClubCheckoutMode>
  );
}

function LegacyClubScreen() {
  const prodamusTest = getClubPaymentMode() === "prodamus-test";
  const active = useScreenActive();
  const navigation = useClubNavigation(active);
  const router = useRouter();
  const viewport = useViewport();
  const { stylesLayout } = getClubScreenLayout(viewport);
  const { SCREEN_WIDTH } = getClubScreenContent(viewport);
  const { hasClubAccess, monthlyPrice, status: subscriptionStatus } = useClub();
  const price = prodamusTest ? 790 : monthlyPrice;
  const defaultPayLabel = prodamusTest
    ? "Открыть тестовую оплату"
    : `Оплатить ${price} ₽`;
  const {
    isAuthenticated,
    user,
    loading: authLoading,
    error: sessionError,
  } = useAuth();
  const [guestEmail, setGuestEmail] = useState("");
  const phoneOwner = user?.id ?? null;
  const [phoneDraft, setPhoneDraft] = useState<{
    owner: number | null;
    value: string;
  }>({ owner: phoneOwner, value: "" });
  const contactPhone = phoneDraft.owner === phoneOwner ? phoneDraft.value : "";
  const forceCheckout = navigation?.checkout === true;
  const justPaid = navigation?.paymentReturn === true;
  const payment = useClubPayment({
    active,
    returnKey: justPaid ? navigation.key : null,
    guestEmail,
    contactPhone,
    prodamusTest,
  });
  const payError = payment.payError;
  const payLabel = payment.purchaseLabel ?? defaultPayLabel;
  const contactPhoneField = (
    <Field
      placeholder="Номер телефона с кодом страны"
      aria-label="Номер телефона"
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      required
      maxLength={40}
      disabled={payment.busy}
      readOnly={payment.contactPhoneLocked}
      value={payment.savedContactPhone ?? contactPhone}
      onValueChange={(value) => setPhoneDraft({ owner: phoneOwner, value })}
      className={classes.guestEmail}
    />
  );
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
      <ScreenStatus>
        <SubscriptionStatus />
      </ScreenStatus>
    );
  }
  if (hasClubAccess && !forceCheckout) {
    return (
      <ClubSubscribed
        purchaseNotice={
          payment.normalRecovery && (payment.hasSavedPurchase || justPaid) ? (
            <section
              aria-label="Результат покупки подписки"
              className={classes.priceSection}
            >
              {payment.accessNotice ? (
                <Typography role="status" className={classes.priceNote}>
                  {payment.accessNotice}
                </Typography>
              ) : null}
              {payError ? (
                <Typography role="alert" className={classes.priceNote}>
                  {payError}
                </Typography>
              ) : null}
              <Action
                disabled={payment.disabled}
                onClick={() => void payment.check()}
                className={classes.action2}
              >
                <Typography className={classes.privacyLink}>
                  {payment.checking ? "Проверяем…" : "Проверить покупку"}
                </Typography>
              </Action>
              {payment.hasSavedPurchase ? contactPhoneField : null}
              {payment.hasSavedPurchase ? (
                <Action
                  disabled={payment.disabled}
                  onClick={() => void payment.prepare()}
                  className={classes.action2}
                >
                  <Typography className={classes.privacyLink}>
                    {payLabel}
                  </Typography>
                </Action>
              ) : null}
            </section>
          ) : undefined
        }
      />
    );
  }
  // ── Subscription Landing Page (including an explicit renewal) ──
  if (!hasClubAccess || forceCheckout) {
    return (
      <ScreenContainer edges={["left", "right"]} backgroundColor="#F5EDE3">
        <Background
          source={{ uri: PAPER_TEXTURE_URI }}
          fit="cover"
          className={classes.background}
        >
          <ScrollArea hideScrollbar>
            {prodamusTest ? (
              <section
                aria-label="Тестовая оплата Prodamus"
                className={classes.testNotice}
              >
                <Typography className={classes.testTitle}>
                  Тестовая оплата Prodamus
                </Typography>
                <Typography className={classes.testDescription}>
                  Демо-платёж 790 ₽ за 30 дней доступа, без автопродления.
                  Возвращение на эту страницу не подтверждает оплату.
                </Typography>
                <Typography className={classes.testDescription}>
                  После тестовой оплаты{" "}
                  {isAuthenticated
                    ? "нажмите «Проверить доступ»."
                    : "войдите с указанной почтой и проверьте доступ."}
                </Typography>
              </section>
            ) : null}
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
                  type="email"
                  aria-label="Почта для чека и входа"
                  autoComplete="email"
                  maxLength={320}
                  disabled={payment.busy}
                  value={payment.savedGuestEmail ?? guestEmail}
                  readOnly={payment.guestEmailLocked}
                  onValueChange={setGuestEmail}
                  className={classes.guestEmail}
                />
              ) : null}
              {contactPhoneField}
              <Action
                style={({ pressed }) => ({
                  transform: cssTransform([{ scale: pressed ? 0.97 : 1 }]),
                })}
                disabled={payment.disabled}
                onClick={() => void payment.prepare()}
                className={({ pressed }) =>
                  [
                    classes.action,
                    pressed || payment.preparing
                      ? classes.opacityState
                      : classes.opacityState2,
                  ]
                    .filter(Boolean)
                    .join(" ")
                }
              >
                {payment.preparing ? (
                  <Spinner color={CREAM} />
                ) : (
                  <MaterialIcons name="star" size={18} color={CREAM} />
                )}
                <Typography className={classes.subscribeButtonText}>
                  {payLabel}
                </Typography>
              </Action>
              {payError ? (
                <Typography role="alert" className={classes.typography}>
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
                              optimizeLocal
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
                              optimizeLocal
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
                              optimizeLocal
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
                              optimizeLocal
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
                  {prodamusTest ? "Тестовый доступ" : "Варианты подписки"}
                </Typography>
                <Typography className={classes.planName}>
                  {prodamusTest ? "На 30 дней" : "Ежемесячно"}
                </Typography>
                <div
                  className={["ui-stack ", classes.priceRow]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Typography className={classes.priceAmount}>
                    {price} ₽
                  </Typography>
                  <Typography className={classes.pricePeriod}>
                    {" "}
                    {prodamusTest ? "/ 30 дней" : "/ месяц"}
                  </Typography>
                </div>
                <Typography className={classes.priceNote}>
                  {prodamusTest
                    ? "Однократная тестовая оплата. Доступ появится после подтверждения сервером; повторно платить для проверки не нужно."
                    : "Автосписание каждый месяц. Отменить можно в профиле в любой момент — доступ сохранится до конца оплаченного периода."}
                </Typography>
                {!isAuthenticated ? (
                  <Field
                    placeholder="Почта для чека и входа"
                    placeholderColor={BROWN_MUTED}
                    autoCapitalize="off"
                    inputMode="email"
                    type="email"
                    aria-label="Почта для чека и входа"
                    autoComplete="email"
                    maxLength={320}
                    disabled={payment.busy}
                    value={payment.savedGuestEmail ?? guestEmail}
                    readOnly={payment.guestEmailLocked}
                    onValueChange={setGuestEmail}
                    className={classes.guestEmail}
                  />
                ) : null}
                {contactPhoneField}
                <Action
                  style={({ pressed }) => ({
                    transform: cssTransform([{ scale: pressed ? 0.97 : 1 }]),
                  })}
                  disabled={payment.disabled}
                  onClick={() => void payment.prepare()}
                  className={({ pressed }) =>
                    [
                      classes.action,
                      pressed || payment.preparing
                        ? classes.opacityState3
                        : classes.opacityState4,
                    ]
                      .filter(Boolean)
                      .join(" ")
                  }
                >
                  {payment.preparing ? (
                    <Spinner color={CREAM} />
                  ) : (
                    <MaterialIcons name="star" size={18} color={CREAM} />
                  )}
                  <Typography className={classes.subscribeButtonText}>
                    {payLabel}
                  </Typography>
                </Action>
                {isAuthenticated || payment.normalRecovery ? (
                  <Action
                    onClick={() => void payment.check()}
                    disabled={payment.disabled}
                    className={classes.action2}
                  >
                    <Typography className={classes.privacyLink}>
                      {payment.checking
                        ? "Проверяем…"
                        : prodamusTest
                          ? "Проверить доступ"
                          : payment.normalRecovery
                            ? "Проверить покупку"
                            : "Я уже оплатила"}
                    </Typography>
                  </Action>
                ) : null}
                {payment.accessNotice ? (
                  <Typography role="status" className={classes.priceNote}>
                    {payment.accessNotice}
                  </Typography>
                ) : null}
                {(justPaid || prodamusTest || payment.hasSavedPurchase) &&
                !isAuthenticated ? (
                  <Action
                    onClick={() =>
                      router.login({
                        pathname: "/club",
                        club: { checkout: false, paymentReturn: !prodamusTest },
                      })
                    }
                    className={classes.action2}
                  >
                    <Typography className={classes.privacyLink}>
                      Войти для проверки доступа
                    </Typography>
                  </Action>
                ) : null}
                {payError ? (
                  <Typography role="alert" className={classes.priceNote}>
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
