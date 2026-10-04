import { useState, useRef, useCallback, useEffect } from "react";
import { ClubSubscribed } from "@/components/club/club-subscribed";
import { useClub } from "@/lib/club-context";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import {
  Text,
  View,
  ScrollView,
  Pressable,
  FlatList,
  StyleSheet,
  Platform,
  Dimensions,
  ImageBackground,
  Linking,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { MaterialIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { TabHeader } from "@/components/tab-header";
import { CLUB_MUSIC_URL } from "@/lib/tab-assets";
import { useColors } from "@/hooks/use-colors";
import { router, useLocalSearchParams } from "expo-router";

// ─── Constants ──────────────────────────────────────────────────────────────

const PAPER_TEXTURE_URI = "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg";
const CLUB_BANNER_URL =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/9e3aec1f0a5d-PUMBhecZrXmmctyT.jpg";

const BROWN = "#5C4033";
const BROWN_MUTED = "#8B7355";
const CREAM = "#FDF8F0";
const OLIVE = "#6B7B5E";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const LETTER_CAROUSEL_IMAGES = [
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d41da8bb49e5-qtTdhxTQTceQjglS.jpeg",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/248794a7bd51-TGjGBKCtCDaiNEGA.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d4c9b66fca3b-SRsjwrPhBzgdUgKP.png",
];

const EXCLUSIVE_CAROUSEL_IMAGES = [
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/1d28efefb09b-mlHctAbwrdujnkAl.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/8d13aefa8185-IZEbDdSSzwHYlZJi.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/0479fc01d16a-MSbIPSMMSqmZweYd.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/2c8069c13604-UBeEtDCkYYkHKSKN.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/234b0e0452ba-vVFccXYZXhHdnGCR.png",
];

const GIVEAWAY_CAROUSEL_IMAGES = [
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/8e13a3ec38f0-KFvjVaUAsIOcwZxo.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/7362db96b0a1-JGyvReRkTzKEFEru.png",
];

const COMMUNITY_CAROUSEL_IMAGES = [
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/0c95d509c862-oewXdFleqUUvImKT.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/75d234e719e4-qRZzKsNlaPRjMabP.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/80167c1dcc6f-vSlkTezTOrkVQWvB.png",
];

const PODBORKI_CAROUSEL_IMAGES = [
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d7d902b3580b-ibiaXiTZueqqzkwU.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/50e90f364a43-MrKdMmoQWEKpOoxG.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/4421e2915127-MHSQScqFnuIJSihl.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/4f6a6814aa8b-mTIjouFpTLtMeseC.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/250423a7ec62-uyAaCmBzfqhlMwpt.PNG",
];

const REVIEWS_CAROUSEL_IMAGES = [
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d7c6da7c51eb-ajKAgiYmRhdfjrvA.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/01ac0596761e-CpXcSOXRRuKDFbNs.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/b0256e249003-fTvlKJxwwRXhliWp.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/77be05fab34c-HWbDueWsSqSewhtK.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/a1a591be13aa-AZYAKPGUhWakANOo.png",
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/1a03ee114023-cCbdKIZtJmsSzKzg.png",
];

const REVIEWS_SLIDES: { type: "single" | "double"; images: string[] }[] = [
  { type: "single", images: [REVIEWS_CAROUSEL_IMAGES[0]] },
  { type: "single", images: [REVIEWS_CAROUSEL_IMAGES[1]] },
  { type: "single", images: [REVIEWS_CAROUSEL_IMAGES[2]] },
  { type: "double", images: [REVIEWS_CAROUSEL_IMAGES[3], REVIEWS_CAROUSEL_IMAGES[4]] },
  { type: "single", images: [REVIEWS_CAROUSEL_IMAGES[5]] },
];

// ─── Data ───────────────────────────────────────────────────────────────────

interface Benefit {
  icon: string;
  title: string;
  description: string;
}

const BENEFITS: Benefit[] = [
  {
    icon: "mail-outline",
    title: "Письмо месяца",
    description: "Личное письмо от Дарьи с историями, размышлениями и рекомендациями",
  },
  {
    icon: "collections-bookmark",
    title: "Подборки",
    description: "Стиль, дом, подарки, кино — со ссылками на доступные магазины и маркетплейсы",
  },
  {
    icon: "auto-awesome",
    title: "Эксклюзивные материалы",
    description: "Статьи, видео, подкасты",
  },
  {
    icon: "forum",
    title: "Доброе комьюнити",
    description: "Каждую среду \u2013 день общения, поддержки и\nтеплых разговоров",
  },
  {
    icon: "card-giftcard",
    title: "Розыгрыши",
    description: "Каждый месяц \u2013 атмосферный подарок\nдля одной из вас",
  },
];

interface ClubPost {
  id: string;
  title: string;
  preview: string;
  date: string;
  type: "letter" | "broadcast" | "discussion" | "exclusive";
}

const CLUB_POSTS: ClubPost[] = [
  {
    id: "cp1",
    title: "Письмо апреля: О красоте несовершенства",
    preview: "Этот месяц научил меня видеть красоту в том, что раньше казалось недостатком...",
    date: "20 апреля 2026",
    type: "letter",
  },
  {
    id: "cp2",
    title: "Эфир: Весенняя уборка с душой",
    preview: "Запись эфира о том, как превратить уборку в медитативный ритуал",
    date: "18 апреля 2026",
    type: "broadcast",
  },
  {
    id: "cp3",
    title: "Обсуждение: Ваш любимый уголок дома",
    preview: "Делитесь фотографиями и историями о самом уютном месте в вашем доме",
    date: "15 апреля 2026",
    type: "discussion",
  },
  {
    id: "cp4",
    title: "Эксклюзив: Рецепт бабушкиного пирога",
    preview: "Семейный рецепт, который передаётся из поколения в поколение",
    date: "12 апреля 2026",
    type: "exclusive",
  },
];

const TYPE_ICONS: Record<string, string> = {
  letter: "mail",
  broadcast: "videocam",
  discussion: "forum",
  exclusive: "auto-awesome",
};

const TYPE_LABELS: Record<string, string> = {
  letter: "Письмо",
  broadcast: "Эфир",
  discussion: "Обсуждение",
  exclusive: "Эксклюзив",
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function ClubScreen() {
  const colors = useColors();
  const { isSubscribed, refreshSubscription, monthlyPrice } = useClub();
  const { isAuthenticated, loading: authLoading, applySession, user } = useAuth();
  const params = useLocalSearchParams<{ paid?: string; checkout?: string }>();
  const checkout = trpc.club.createCheckout.useMutation();
  const claimPending = trpc.club.claimPending.useMutation();
  const [payError, setPayError] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState("");
  const forceCheckout = params.checkout === "1";
  const justPaid = params.paid === "1";

  const openPayUrl = useCallback((url: string) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.assign(url);
      return;
    }
    void Linking.openURL(url);
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
      if (result.user) {
        await applySession(result.user);
      }
      openPayUrl(result.url);
    } catch (error) {
      setPayError(error instanceof Error ? error.message : "Не удалось открыть оплату");
    }
  }, [applySession, checkout, guestEmail, isAuthenticated, openPayUrl, user?.email]);

  useEffect(() => {
    if (!justPaid || authLoading || !isAuthenticated) return;
    let cancelled = false;
    void (async () => {
      try {
        await claimPending.mutateAsync();
      } catch {
        // webhook / return URL may still arrive
      }
      if (!cancelled) refreshSubscription();
    })();
    const timer = setInterval(() => refreshSubscription(), 2500);
    const stop = setTimeout(() => clearInterval(timer), 20000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [justPaid, authLoading, isAuthenticated, refreshSubscription]);
  const [activeLetterIndex, setActiveLetterIndex] = useState(0);
  const letterCardWidth = SCREEN_WIDTH * 0.4;
  const letterSnapInterval = letterCardWidth + 10;
  const onLetterScroll = useCallback((e: any) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (SCREEN_WIDTH * 0.4 + 10));
    setActiveLetterIndex(index);
  }, []);

  // ── Subscribed state ──
  if (isSubscribed && !forceCheckout) {
    return <ClubSubscribed />;
  }

  // ── Subscription Landing Page (not subscribed) ──
  if (!isSubscribed) {
    return (
      <ScreenContainer edges={["left", "right"]} containerClassName="bg-[#F5EDE3]">
      <ImageBackground source={{ uri: PAPER_TEXTURE_URI }} resizeMode="cover" style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Banner with overlaid header */}
          <View style={{ position: "relative" }}>
            <View style={styles.heroBanner}>
              <Image
                source={{ uri: CLUB_BANNER_URL }}
                style={styles.heroBannerImage}
                contentFit="cover"
                transition={400}
              />
            </View>
            <TabHeader musicUrl={CLUB_MUSIC_URL} />
          </View>

          {/* Description */}
          <View style={styles.subtitleContainer}>
            <Text style={styles.subtitleDescription}>
              Безопасное пространство для тех, кому важна красота в жизни, а не только на экране.
            </Text>
            <Text style={styles.dotSeparator}>•</Text>
            <Text style={styles.subtitleDescription}>
              Творческая атмосфера, доброе комьюнити, эксклюзивные материалы и подборки от Дарьи — не просто вдохновение, а часть вашей повседневной жизни.
            </Text>
            <Text style={styles.dotSeparator}>•</Text>
            <Text style={styles.subtitleDescription}>
              Место, где можно быть{" "}
              <Text style={styles.italicText}>ближе</Text> и получать{" "}
              <Text style={styles.italicText}>больше</Text>.
            </Text>
          </View>

          <View style={styles.priceSection}>
            {!isAuthenticated ? (
              <TextInput
                style={styles.guestEmail}
                placeholder="Почта для чека и входа"
                placeholderTextColor={BROWN_MUTED}
                autoCapitalize="none"
                keyboardType="email-address"
                value={guestEmail}
                onChangeText={setGuestEmail}
              />
            ) : null}
            <Pressable
              style={({ pressed }) => [
                styles.subscribeButton,
                {
                  opacity: pressed || checkout.isPending ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
              disabled={checkout.isPending || authLoading}
              onPress={() => void handlePay()}
            >
              {checkout.isPending ? (
                <ActivityIndicator color={CREAM} />
              ) : (
                <MaterialIcons name="star" size={18} color={CREAM} />
              )}
              <Text style={styles.subscribeButtonText}>Оплатить {monthlyPrice} ₽</Text>
            </Pressable>
            {payError ? <Text style={[styles.priceNote, { textAlign: "center", marginTop: 8 }]}>{payError}</Text> : null}
          </View>

          {/* Benefits */}
          <View style={styles.benefitsSection}>
            <Text style={styles.benefitsSectionTitle}>Что входит в подписку:</Text>
            {BENEFITS.map((benefit, index) => (
              <View key={index}>
                <View style={styles.benefitCard}>
                  <View style={styles.benefitIcon}>
                    <MaterialIcons name={benefit.icon as any} size={22} color={OLIVE} />
                  </View>
                  <View style={styles.benefitText}>
                    <Text style={styles.benefitTitle}>{benefit.title}</Text>
                    <Text style={styles.benefitDescription}>{benefit.description}</Text>
                  </View>
                </View>
                {/* Letter carousel after Письмо месяца */}
                {benefit.title === "Эксклюзивные материалы" && (
                  <View style={styles.letterCarouselContainer}>
                    <FlatList
                      data={EXCLUSIVE_CAROUSEL_IMAGES}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      keyExtractor={(_, i) => `exclusive-${i}`}
                      snapToInterval={SCREEN_WIDTH * 0.7 + 10}
                      decelerationRate="fast"
                      contentContainerStyle={{ paddingHorizontal: 20 }}
                      renderItem={({ item }) => (
                        <View style={styles.exclusiveCarouselSlide}>
                          <Image
                            source={{ uri: item }}
                            style={styles.exclusiveCarouselImage}
                            contentFit="contain"
                            transition={300}
                          />
                        </View>
                      )}
                    />
                  </View>
                )}
                {benefit.title === "Розыгрыши" && (
                  <View style={styles.letterCarouselContainer}>
                    <FlatList
                      data={GIVEAWAY_CAROUSEL_IMAGES}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      keyExtractor={(_, i) => `giveaway-${i}`}
                      snapToInterval={SCREEN_WIDTH * 0.75 + 10}
                      decelerationRate="fast"
                      contentContainerStyle={{ paddingHorizontal: 20 }}
                      renderItem={({ item }) => (
                        <View style={styles.giveawayCarouselSlide}>
                          <Image
                            source={{ uri: item }}
                            style={styles.giveawayCarouselImage}
                            contentFit="contain"
                            transition={300}
                          />
                        </View>
                      )}
                    />
                  </View>
                )}
                {benefit.title === "Доброе комьюнити" && (
                  <View style={styles.letterCarouselContainer}>
                    <FlatList
                      data={COMMUNITY_CAROUSEL_IMAGES}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      keyExtractor={(_, i) => `community-${i}`}
                      snapToInterval={SCREEN_WIDTH * 0.75 + 10}
                      decelerationRate="fast"
                      contentContainerStyle={{ paddingHorizontal: 20 }}
                      renderItem={({ item }) => (
                        <View style={styles.communityCarouselSlide}>
                          <Image
                            source={{ uri: item }}
                            style={styles.communityCarouselImage}
                            contentFit="contain"
                            transition={300}
                          />
                        </View>
                      )}
                    />
                  </View>
                )}
                {benefit.title === "Подборки" && (
                  <View style={styles.letterCarouselContainer}>
                    <FlatList
                      data={PODBORKI_CAROUSEL_IMAGES}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      keyExtractor={(_, i) => `podborki-${i}`}
                      snapToInterval={SCREEN_WIDTH * 0.4 + 10}
                      decelerationRate="fast"
                      contentContainerStyle={{ paddingHorizontal: 20 }}
                      renderItem={({ item }) => (
                        <View style={styles.letterCarouselSlide}>
                          <Image
                            source={{ uri: item }}
                            style={styles.letterCarouselImage}
                            contentFit="cover"
                            transition={300}
                          />
                        </View>
                      )}
                    />
                  </View>
                )}
                {benefit.title === "Письмо месяца" && (
                  <View style={styles.letterCarouselContainer}>
                    <FlatList
                      data={LETTER_CAROUSEL_IMAGES}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      keyExtractor={(_, i) => `letter-${i}`}
                      onScroll={onLetterScroll}
                      scrollEventThrottle={16}
                      snapToInterval={SCREEN_WIDTH * 0.4 + 10}
                      decelerationRate="fast"
                      contentContainerStyle={{ paddingHorizontal: 20 }}
                      renderItem={({ item }) => (
                        <View style={styles.letterCarouselSlide}>
                          <Image
                            source={{ uri: item }}
                            style={styles.letterCarouselImage}
                            contentFit="cover"
                            transition={300}
                          />
                        </View>
                      )}
                    />
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Privileges */}
          <View style={styles.privilegesSection}>
            <Text style={styles.privilegesTitle}>Привилегии:</Text>
            <Text style={styles.privilegesItem}>{"\u2022"} доступ к лучшим материалам клуба за 2 года</Text>
            <Text style={styles.privilegesItem}>{"\u2022"} развернутые результаты теста на личную эстетику</Text>
            <Text style={styles.privilegesItem}>{"\u2022"} эксклюзивные гиды и выкройки</Text>
          </View>

          {/* Price & Subscribe */}
          <View style={styles.priceSection}>
            <View style={styles.priceCard}>
              <Text style={styles.priceLabel}>Варианты подписки</Text>
              <Text style={styles.planName}>Ежемесячно</Text>
              <View style={styles.priceRow}>
                <Text style={styles.priceAmount}>{monthlyPrice} ₽</Text>
                <Text style={styles.pricePeriod}> / месяц</Text>
              </View>
              <Text style={styles.priceNote}>
                Автосписание каждый месяц. Отменить можно в профиле в любой момент — доступ сохранится до конца оплаченного периода.
              </Text>
              {!isAuthenticated ? (
                <TextInput
                  style={styles.guestEmail}
                  placeholder="Почта для чека и входа"
                  placeholderTextColor={BROWN_MUTED}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={guestEmail}
                  onChangeText={setGuestEmail}
                />
              ) : null}
              <Pressable
                style={({ pressed }) => [
                  styles.subscribeButton,
                  {
                    opacity: pressed || checkout.isPending ? 0.9 : 1,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
                disabled={checkout.isPending || authLoading}
                onPress={() => void handlePay()}
              >
                {checkout.isPending ? (
                  <ActivityIndicator color={CREAM} />
                ) : (
                  <MaterialIcons name="star" size={18} color={CREAM} />
                )}
                <Text style={styles.subscribeButtonText}>Оплатить {monthlyPrice} ₽</Text>
              </Pressable>
              {isAuthenticated ? (
                <Pressable
                  style={{ marginTop: 12, paddingVertical: 8 }}
                  onPress={async () => {
                    setPayError(null);
                    try {
                      const result = await claimPending.mutateAsync();
                      refreshSubscription();
                      if (!result.granted) {
                        setPayError("Оплата ещё не найдена. Если вы только что заплатили, подождите минуту и нажмите ещё раз.");
                      }
                    } catch (error) {
                      setPayError(error instanceof Error ? error.message : "Не удалось подтвердить оплату");
                    }
                  }}
                >
                  <Text style={styles.privacyLink}>Я уже оплатила</Text>
                </Pressable>
              ) : null}
                {justPaid ? (
                  <Text style={styles.priceNote}>Оплата получена, открываем клуб… обновите страницу, если экран не сменился.</Text>
                ) : null}
                {payError ? <Text style={styles.priceNote}>{payError}</Text> : null}
                <Pressable onPress={() => router.push("/privacy")} style={{ marginTop: 10 }}>
                  <Text style={styles.privacyLink}>Политика конфиденциальности</Text>
                </Pressable>
            </View>
          </View>

          {/* Reviews Carousel */}
          <View style={styles.reviewsSection}>
            <Text style={styles.reviewsSectionTitle}>Отзывы участниц</Text>
            <FlatList
              data={REVIEWS_SLIDES}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, i) => `review-${i}`}
              snapToInterval={SCREEN_WIDTH * 0.75 + 10}
              decelerationRate="fast"
              contentContainerStyle={{ paddingHorizontal: 20 }}
              renderItem={({ item }) => {
                if (item.type === "single") {
                  return (
                    <View style={styles.reviewCarouselSlide}>
                      <Image
                        source={{ uri: item.images[0] }}
                        style={styles.reviewCarouselImage}
                        contentFit="contain"
                        transition={300}
                      />
                    </View>
                  );
                }
                return (
                  <View style={styles.reviewCarouselSlide}>
                    <Image
                      source={{ uri: item.images[0] }}
                      style={styles.reviewCarouselImageHalf}
                      contentFit="contain"
                      transition={300}
                    />
                    <Image
                      source={{ uri: item.images[1] }}
                      style={styles.reviewCarouselImageHalf}
                      contentFit="contain"
                      transition={300}
                    />
                  </View>
                );
              }}
            />
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
        </ImageBackground>
  </ScreenContainer>
    );
  }

  // Unreachable fallback
  return null;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Italic text
  italicText: {
    fontFamily: "EBGaramond-Italic",
    color: "#4A3728",
  },
  dotSeparator: {
    fontSize: 14,
    color: "#8B7355",
    textAlign: "center",
    marginVertical: 3,
  },

  // Banner
  heroBanner: {
    width: "100%",
    aspectRatio: 16 / 9,
    position: "relative",
  },
  heroBannerImage: {
    width: "100%",
    height: "100%",
  },

  // Subtitle (locked state)
  subtitleContainer: {
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 8,
    alignItems: "center",
  },
  subtitleDescription: {
    fontSize: 16,
    fontFamily: "EBGaramond-Regular",
    color: "#4A3728",
    textAlign: "center",
    lineHeight: 22,
  },

  // Benefits
  benefitsSection: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  benefitsSectionTitle: {
    fontSize: 28,
    fontFamily: "Gogol-Regular",
    color: BROWN,
    textAlign: "center",
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "EBGaramond-Regular",
    color: BROWN,
    letterSpacing: 1,
    marginBottom: 14,
  },
  benefitCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderWidth: 1,
    borderColor: "rgba(139,115,85,0.15)",
    marginBottom: 4,
    gap: 14,
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(107,123,94,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: {
    flex: 1,
    gap: 2,
  },
  benefitTitle: {
    fontSize: 15,
    fontFamily: "EBGaramond-SemiBold",
    color: BROWN,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  benefitDescription: {
    fontSize: 13,
    fontFamily: "EBGaramond-Regular",
    color: BROWN_MUTED,
    lineHeight: 18,
  },

  // Privileges
  privilegesSection: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  privilegesTitle: {
    fontSize: 17,
    fontFamily: "EBGaramond-SemiBold",
    color: "#4A3728",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  privilegesItem: {
    fontSize: 15,
    fontFamily: "EBGaramond-Regular",
    color: "#4A3728",
    lineHeight: 22,
    marginBottom: 4,
  },

  // Price
  priceSection: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  priceCard: {
    padding: 24,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(107,123,94,0.3)",
    backgroundColor: "rgba(107,123,94,0.06)",
    alignItems: "center",
    gap: 8,
  },
  priceLabel: {
    fontSize: 12,
    fontFamily: "EBGaramond-Regular",
    color: BROWN_MUTED,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  planName: {
    fontSize: 18,
    fontFamily: "EBGaramond-Regular",
    color: BROWN,
    marginTop: 4,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  priceAmount: {
    fontSize: 36,
    fontFamily: "EBGaramond-Regular",
    color: BROWN,
  },
  pricePeriod: {
    fontSize: 16,
    fontFamily: "EBGaramond-Regular",
    color: BROWN_MUTED,
  },
  subscribeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: OLIVE,
    gap: 8,
    marginTop: 8,
  },
  guestEmail: {
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(107,123,94,0.35)",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: "EBGaramond-Regular",
    fontSize: 16,
    color: BROWN,
    backgroundColor: "rgba(253,248,240,0.9)",
    marginBottom: 4,
  },
  subscribeButtonText: {
    color: CREAM,
    fontSize: 16,
    fontFamily: "EBGaramond-SemiBold",
    letterSpacing: 0.5,
  },
  priceNote: {
    fontSize: 12,
    fontFamily: "EBGaramond-Italic",
    color: BROWN_MUTED,
    marginTop: 4,
    textAlign: "center",
  },
  privacyLink: {
    fontSize: 13,
    fontFamily: "EBGaramond-Regular",
    color: OLIVE,
    textAlign: "center",
    textDecorationLine: "underline",
  },

  // Reviews carousel
  reviewsSection: {
    marginTop: 28,
    marginHorizontal: -20,
  },
  reviewsSectionTitle: {
    fontSize: 28,
    fontFamily: "Gogol-Regular",
    color: BROWN,
    textAlign: "center",
    marginBottom: 16,
  },
  reviewCarouselSlide: {
    width: SCREEN_WIDTH * 0.75,
    marginRight: 10,
    backgroundColor: "#F5EDE3",
    borderRadius: 16,
    padding: 8,
    overflow: "hidden",
  },
  reviewCarouselImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 12,
  },
  reviewCarouselImageHalf: {
    width: "100%",
    flex: 1,
    borderRadius: 12,
  },

  // ── Subscribed state ──
  memberHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    alignItems: "flex-start",
  },
  memberBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(107,123,94,0.12)",
    gap: 5,
  },
  memberBadgeText: {
    fontSize: 12,
    fontFamily: "EBGaramond-SemiBold",
    color: OLIVE,
    letterSpacing: 0.3,
  },
  broadcastBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(107,123,94,0.2)",
    backgroundColor: "rgba(107,123,94,0.06)",
    gap: 12,
  },
  broadcastBannerText: {
    flex: 1,
    gap: 2,
  },
  broadcastTitle: {
    fontSize: 14,
    fontFamily: "EBGaramond-SemiBold",
    color: BROWN,
  },
  broadcastTime: {
    fontSize: 12,
    fontFamily: "EBGaramond-Regular",
    color: BROWN_MUTED,
  },
  postList: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 100,
    gap: 12,
  },
  postCard: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(139,115,85,0.12)",
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  postContent: {
    padding: 14,
    gap: 4,
  },
  postTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  postTypeLabel: {
    fontSize: 12,
    fontFamily: "EBGaramond-SemiBold",
    color: OLIVE,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  postTitle: {
    fontSize: 16,
    fontFamily: "EBGaramond-Regular",
    color: BROWN,
    lineHeight: 22,
    marginTop: 2,
  },
  postPreview: {
    fontSize: 13,
    fontFamily: "EBGaramond-Regular",
    color: BROWN_MUTED,
    lineHeight: 19,
    marginTop: 2,
  },
  postDate: {
    fontSize: 12,
    fontFamily: "EBGaramond-Regular",
    color: BROWN_MUTED,
    marginTop: 4,
  },

  // ── Letter Carousel ──
  letterCarouselContainer: {
    marginTop: 2,
    marginBottom: 20,
    marginHorizontal: -20,
  },
  letterCarouselSlide: {
    width: SCREEN_WIDTH * 0.4,
    marginRight: 10,
  },
  letterCarouselImage: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 16,
  },
  exclusiveCarouselSlide: {
    width: SCREEN_WIDTH * 0.7,
    marginRight: 10,
    borderRadius: 16,
    overflow: "hidden",
  },
  exclusiveCarouselImage: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 16,
  },
  communityCarouselSlide: {
    width: SCREEN_WIDTH * 0.75,
    marginRight: 10,
    backgroundColor: "#F5EDE3",
    borderRadius: 16,
    padding: 8,
    overflow: "hidden",
  },
  communityCarouselImage: {
    width: "100%",
    aspectRatio: 2.2 / 1,
    borderRadius: 12,
  },
  giveawayCarouselSlide: {
    width: SCREEN_WIDTH * 0.75,
    marginRight: 10,
    backgroundColor: "#F5EDE3",
    borderRadius: 16,
    padding: 8,
  },
  giveawayCarouselImage: {
    width: "100%",
    aspectRatio: 1.8 / 1,
    borderRadius: 12,
  },
  letterPagination: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 10,
    gap: 6,
  },
  letterPaginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D4C4A8",
  },
  letterPaginationDotActive: {
    backgroundColor: "#8B7355",
    width: 18,
    borderRadius: 3,
  },
});
