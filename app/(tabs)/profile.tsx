import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Text,
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Platform,
  TextInput,
  ImageBackground,
  Linking,
} from "react-native";
import { Image } from "expo-image";
import { MaterialIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { TabHeader } from "@/components/tab-header";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/hooks/use-auth";
import { useClub } from "@/lib/club-context";
import { AvatarCropper } from "@/components/club/avatar-cropper";
import { SafeAreaView } from "react-native-safe-area-context";
import { AESTHETIC_NAMES, type AestheticKey } from "@/lib/quiz-data";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { trpc } from "@/lib/trpc";
import { displayPostTitle } from "@/lib/media-label";
import { SmsCodeForm } from "@/components/sms-code-form";
import { formatRuPhone } from "@/lib/phone";
// ─── Constants ──────────────────────────────────────────────────────────────

const PAPER_TEXTURE_URI = "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg";
const BROWN = "#5C4033";
const BROWN_MUTED = "#8B7355";
const CREAM = "#FDF8F0";
const OLIVE = "#6B7B5E";

const PROFILE_NAME_KEY = "@darcy_club_profile_name";
const PROFILE_GENDER_KEY = "@darcy_club_profile_gender";
const PROFILE_AVATAR_KEY = "@darcy_club_profile_avatar";

// ─── Types ──────────────────────────────────────────────────────────────────

type SavedTab = "feed" | "club";

function formatRuDate(date: Date): string {
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

const SUPPORT_EMAIL = "daryadarcy19@gmail.com";

function openSupportMail(subject: string) {
  void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`);
}

async function uriToBase64(uri: string): Promise<string> {
  if (uri.startsWith("data:")) {
    return uri.split(",")[1] || "";
  }
  const response = await fetch(uri);
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

interface CropperImage {
  uri: string;
  width: number;
  height: number;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, logout, isAuthenticated, loading: authLoading, refresh, isOwner: isAuthOwner, applySession } = useAuth();
  const { isSubscribed, expiresAt, cancelAtPeriodEnd, isOwner, monthlyPrice, refreshSubscription } = useClub();
  const cancelSub = trpc.club.cancel.useMutation();
  const updateProfile = trpc.profile.update.useMutation();
  const uploadAvatar = trpc.profile.uploadAvatar.useMutation();
  const savedFromApi = trpc.feed.savedPosts.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });
  const [profileName, setProfileName] = useState<string | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [savedTab, setSavedTab] = useState<SavedTab>("feed");
  const [cropperImage, setCropperImage] = useState<CropperImage | null>(null);
  const [quizResult, setQuizResult] = useState<{
    primaryKey: AestheticKey;
    primaryTitle: string;
    secondaryKey: AestheticKey | null;
    isBlend: boolean;
  } | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");

  const [savedFeedIds, setSavedFeedIds] = useState<number[]>([]);
  const [savedClubIds, setSavedClubIds] = useState<string[]>([]);

  // Reload profile data every time this tab gains focus
  const loadProfileData = useCallback(() => {
    Promise.all([
      AsyncStorage.getItem(PROFILE_NAME_KEY),
      AsyncStorage.getItem(PROFILE_AVATAR_KEY),
      AsyncStorage.getItem("@darcy_quiz_result"),
      AsyncStorage.getItem("@darcy_saved_feed"),
      AsyncStorage.getItem("@darcy_saved_club"),
    ]).then(([name, avatar, quizRaw, feedRaw, clubRaw]) => {
      if (name) setProfileName(name);
      if (avatar && avatar.startsWith("http")) setAvatarUri(avatar);
      if (quizRaw) {
        try {
          const parsed = JSON.parse(quizRaw);
          setQuizResult(parsed);
        } catch {}
      }
      if (feedRaw) {
        try { setSavedFeedIds(JSON.parse(feedRaw)); } catch {}
      }
      if (clubRaw) {
        try { setSavedClubIds(JSON.parse(clubRaw)); } catch {}
      }
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfileData();
      if (isAuthenticated) {
        void savedFromApi.refetch();
      }
    }, [isAuthenticated, loadProfileData, savedFromApi.refetch]),
  );

  const displayName = profileName || user?.name || "Участница";
  const serverAvatar = user?.avatarUrl && /^https?:\/\//.test(user.avatarUrl) ? user.avatarUrl : null;
  const displayAvatar = avatarUri || serverAvatar;

  useEffect(() => {
    if (!serverAvatar) return;
    setAvatarUri((current) => (current === serverAvatar ? current : serverAvatar));
    void AsyncStorage.setItem(PROFILE_AVATAR_KEY, serverAvatar);
  }, [serverAvatar]);

  const savedPosts = useMemo(() => {
    const rows = savedFromApi.data || [];
    const feedRows = rows.filter((p: any) => p.target !== "club");
    const clubRows = rows.filter((p: any) => p.target === "club" || p.target === "both");
    if (savedTab === "feed") {
      return feedRows.length > 0 ? feedRows : rows;
    }
    return clubRows.length > 0 ? clubRows : rows;
  }, [savedTab, savedFromApi.data]);

  const isLoadingSaved = savedFromApi.isLoading;

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setCropperImage({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
      });
    }
  };

  const handleCropComplete = async (croppedUri: string) => {
    setAvatarUri(croppedUri);
    setCropperImage(null);
    try {
      const base64 = await uriToBase64(croppedUri);
      if (base64) {
        const result = await uploadAvatar.mutateAsync({ base64, filename: "avatar.jpg", mimeType: "image/jpeg" });
        if (result?.url) {
          setAvatarUri(result.url);
          await AsyncStorage.setItem(PROFILE_AVATAR_KEY, result.url);
        }
        await refresh();
      }
    } catch {
      // keep local preview until the next successful upload
    }
  };

  const handleCropCancel = () => {
    setCropperImage(null);
  };

  // Show cropper full-screen
  if (cropperImage) {
    return (
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.cropperContainer}>
        <AvatarCropper
          imageUri={cropperImage.uri}
          imageWidth={cropperImage.width}
          imageHeight={cropperImage.height}
          onCrop={handleCropComplete}
          onCancel={handleCropCancel}
        />
      </SafeAreaView>
    );
  }

  // Render saved post card
  const handlePostPress = (post: any) => {
    if (savedTab === "feed" && post.id) {
      // Navigate to feed post detail
      router.push(`/post/${post.id}` as any);
    } else if (savedTab === "club") {
      // Navigate to club tab
      router.push("/(tabs)/club" as any);
    }
  };

  const renderSavedPost = ({ item }: { item: any }) => (
    <Pressable
      style={({ pressed }) => [
        styles.savedPostCard,
        pressed && { opacity: 0.8 },
      ]}
      onPress={() => handlePostPress(item)}
    >
      {item.photos && item.photos.length > 0 ? (
        <Image
          source={{ uri: item.photos[0] }}
          style={styles.savedPostImage}
          contentFit="cover"
        />
      ) : (
        <View style={styles.savedPostTextOnly}>
          <Text style={styles.savedPostTitle} numberOfLines={2}>
            {item.title || displayPostTitle(item.text)}
          </Text>
          <Text style={styles.savedPostPreview} numberOfLines={3}>
            {item.text || item.preview || ""}
          </Text>
        </View>
      )}
    </Pressable>
  );



  // Auth / subscription gates
  if (authLoading) {
    return (
      <ScreenContainer containerClassName="bg-[#FDF8F0]">
        <ImageBackground source={{ uri: PAPER_TEXTURE_URI }} resizeMode="cover" style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={BROWN_MUTED} />
        </ImageBackground>
      </ScreenContainer>
    );
  }

  if (!isAuthenticated) {
    return (
      <ScreenContainer containerClassName="bg-[#FDF8F0]">
      <ImageBackground source={{ uri: PAPER_TEXTURE_URI }} resizeMode="cover" style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
          <TabHeader transparent={false} />
          <View style={styles.lockedContainer}>
            <MaterialIcons name="person-outline" size={48} color={BROWN_MUTED} />
            <Text style={styles.lockedTitle}>DARCY</Text>
            <Text style={styles.lockedText}>
              Войдите, чтобы открыть личный кабинет: сохранённое, эстетика, подписка и профиль.
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.lockedButton,
                pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
              ]}
              onPress={() => router.push("/login?next=/profile" as any)}
            >
              <Text style={styles.lockedButtonText}>Войти →</Text>
            </Pressable>
          </View>
        </ScrollView>
        </ImageBackground>
  </ScreenContainer>
    );
  }

  if (!isSubscribed) {
    return (
      <ScreenContainer containerClassName="bg-[#FDF8F0]">
      <ImageBackground source={{ uri: PAPER_TEXTURE_URI }} resizeMode="cover" style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
          <TabHeader transparent={false} />
          <View style={styles.lockedContainer}>
            <MaterialIcons name="lock-outline" size={48} color={BROWN_MUTED} />
            <Text style={styles.lockedTitle}>DARCY</Text>
            <Text style={styles.lockedText}>
              Личный профиль с возможностью сохранять публикации и результаты интерактивов доступен для участниц клуба Darcy
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.lockedButton,
                pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
              ]}
              onPress={() => router.push("/(tabs)/club" as any)}
            >
              <Text style={styles.lockedButtonText}>Вступить в клуб →</Text>
            </Pressable>
          </View>
        </ScrollView>
        </ImageBackground>
  </ScreenContainer>
    );
  }

  return (
    <ScreenContainer containerClassName="bg-[#FDF8F0]">
      <ImageBackground source={{ uri: PAPER_TEXTURE_URI }} resizeMode="cover" style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <TabHeader transparent={false} />

        {/* ─── Profile Header ─── */}
        <View style={styles.profileHeader}>
          <Pressable
            style={({ pressed }) => [
              styles.avatarContainer,
              pressed && { opacity: 0.8 },
            ]}
            onPress={pickImage}
          >
            {displayAvatar ? (
              <Image
                source={{ uri: displayAvatar }}
                style={styles.avatar}
                contentFit="cover"
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <MaterialIcons name="person" size={40} color={BROWN_MUTED} />
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <MaterialIcons name="edit" size={12} color="#FFF" />
            </View>
          </Pressable>

          {isEditingName ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={styles.nameInput}
                value={editNameValue}
                onChangeText={setEditNameValue}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={async () => {
                  const trimmed = editNameValue.trim();
                  if (trimmed) {
                    setProfileName(trimmed);
                    await AsyncStorage.setItem(PROFILE_NAME_KEY, trimmed);
                    try {
                      await updateProfile.mutateAsync({ name: trimmed });
                      await refresh();
                    } catch {}
                  }
                  setIsEditingName(false);
                }}
                onBlur={async () => {
                  const trimmed = editNameValue.trim();
                  if (trimmed) {
                    setProfileName(trimmed);
                    await AsyncStorage.setItem(PROFILE_NAME_KEY, trimmed);
                    try {
                      await updateProfile.mutateAsync({ name: trimmed });
                      await refresh();
                    } catch {}
                  }
                  setIsEditingName(false);
                }}
              />
            </View>
          ) : (
            <Pressable
              onPress={() => {
                setEditNameValue(displayName);
                setIsEditingName(true);
              }}
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={styles.nameRow}>
                <Text style={styles.profileName}>{displayName}</Text>
                <MaterialIcons name="edit" size={14} color={BROWN_MUTED} style={{ marginLeft: 6 }} />
              </View>
            </Pressable>
          )}

          {isSubscribed && (
            <View style={styles.subscriptionBadge}>
              <MaterialIcons name="star" size={13} color={OLIVE} />
              <Text style={styles.subscriptionBadgeText}>Клуб Darcy</Text>
            </View>
          )}
        </View>

        {/* ─── Saved Posts Tabs ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="bookmark-border" size={18} color={BROWN_MUTED} />
            <Text style={styles.sectionTitle}>Сохранённое</Text>
          </View>
          <View style={styles.tabRow}>
            <Pressable
              style={[
                styles.tabButton,
                savedTab === "feed" && styles.tabButtonActive,
              ]}
              onPress={() => setSavedTab("feed")}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  savedTab === "feed" && styles.tabButtonTextActive,
                ]}
              >
                Из ленты
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.tabButton,
                savedTab === "club" && styles.tabButtonActive,
              ]}
              onPress={() => setSavedTab("club")}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  savedTab === "club" && styles.tabButtonTextActive,
                ]}
              >
                Из клуба
              </Text>
            </Pressable>
          </View>

          {/* Saved posts grid */}
          {isLoadingSaved ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={BROWN_MUTED} />
            </View>
          ) : savedPosts.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="bookmark-border" size={36} color={BROWN_MUTED} />
              <Text style={styles.emptyStateText}>
                {savedTab === "feed"
                  ? "Здесь будут сохранённые посты из ленты"
                  : "Здесь будут сохранённые посты из клуба"}
              </Text>
            </View>
          ) : (
            <View style={styles.savedGrid}>
              {savedPosts.map((post: any) => (
                <View key={post.id} style={styles.savedGridItem}>
                  {renderSavedPost({ item: post })}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ─── Aesthetics Section ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="auto-stories" size={18} color={BROWN_MUTED} />
            <Text style={styles.sectionTitle}>Эстетика</Text>
          </View>
          {quizResult ? (
            <Pressable
              style={({ pressed }) => [
                styles.aestheticResultCard,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => router.push("/quiz" as any)}
            >
              <View style={styles.aestheticResultHeader}>
                <MaterialIcons name="auto-stories" size={22} color={OLIVE} />
                <Text style={styles.aestheticResultTitle}>
                  {AESTHETIC_NAMES[quizResult.primaryKey]}
                </Text>
              </View>
              <Text style={styles.aestheticResultSubtitle}>
                {quizResult.primaryTitle}
              </Text>
              {quizResult.isBlend && quizResult.secondaryKey && (
                <Text style={styles.aestheticBlendNote}>
                  Бленд с {AESTHETIC_NAMES[quizResult.secondaryKey]}
                </Text>
              )}
              <Text style={styles.aestheticViewMore}>Посмотреть результат →</Text>
            </Pressable>
          ) : (
            <View style={styles.card}>
              <MaterialIcons name="palette" size={24} color={BROWN_MUTED} />
              <Text style={styles.cardText}>
                Пройди тест, чтобы узнать свою эстетику
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.cardButton,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => router.push("/quiz" as any)}
              >
                <Text style={styles.cardButtonText}>Пройти тест →</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* ─── Moodboards Section ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="dashboard" size={18} color={BROWN_MUTED} />
            <Text style={styles.sectionTitle}>Мои мудборды</Text>
          </View>
          {quizResult ? (
            <Pressable
              style={({ pressed }) => [
                styles.aestheticResultCard,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => router.push("/library/aesthetics-guide" as any)}
            >
              <MaterialIcons name="dashboard" size={24} color={OLIVE} />
              <Text style={styles.cardText}>
                Мудборд: {AESTHETIC_NAMES[quizResult.primaryKey]}
              </Text>
              <Text style={styles.aestheticViewMore}>Открыть подборку →</Text>
            </Pressable>
          ) : (
            <View style={styles.card}>
              <MaterialIcons name="dashboard" size={24} color={BROWN_MUTED} />
              <Text style={styles.cardText}>
                Здесь появится твой мудборд
              </Text>
              <Pressable
                style={({ pressed }) => [styles.cardButton, pressed && { opacity: 0.8 }]}
                onPress={() => router.push("/interactive" as any)}
              >
                <Text style={styles.cardButtonText}>Создать мудборд →</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* ─── Subscription Section ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="card-membership" size={18} color={BROWN_MUTED} />
            <Text style={styles.sectionTitle}>Подписка на клуб DARCY</Text>
          </View>
          <View style={styles.subscriptionCard}>
            {isSubscribed ? (
              <>
                <View style={styles.subscriptionStatus}>
                  <View style={styles.statusDot} />
                  <Text style={styles.subscriptionStatusText}>
                    {cancelAtPeriodEnd ? "Отменена, доступ сохранён" : "Активна"}
                  </Text>
                </View>
                <Text style={styles.subscriptionInfo}>
                  {isOwner
                    ? expiresAt
                      ? `Профиль владелицы клуба. Доступ открыт до ${formatRuDate(expiresAt)}`
                      : "Профиль владелицы клуба, доступ без оплаты"
                    : cancelAtPeriodEnd && expiresAt
                      ? `Автосписание отключено. Доступ до ${formatRuDate(expiresAt)}`
                      : expiresAt
                        ? `Следующее списание: ${formatRuDate(expiresAt)} · ${monthlyPrice} ₽ / месяц`
                        : `Ежемесячная подписка ${monthlyPrice} ₽`}
                </Text>
                {!isOwner && !cancelAtPeriodEnd ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.subscriptionButtonDanger,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={() => {
                      const ok = Platform.OS === "web"
                        ? (typeof window !== "undefined" ? window.confirm("Отменить автосписание? Клуб останется открытым до конца оплаченного периода.") : true)
                        : true;
                      if (!ok) return;
                      void cancelSub.mutateAsync().then(() => {
                        refreshSubscription();
                      }).catch((error) => {
                        const message = error instanceof Error ? error.message : "Не удалось отменить";
                        if (Platform.OS === "web" && typeof window !== "undefined") window.alert(message);
                      });
                    }}
                  >
                    <Text style={styles.subscriptionButtonDangerText}>
                      {cancelSub.isPending ? "Отменяем…" : "Отменить подписку"}
                    </Text>
                  </Pressable>
                ) : null}
                {!isOwner ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.subscribeButton,
                      { marginTop: 10 },
                      pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
                    ]}
                    onPress={() => router.push({ pathname: "/(tabs)/club", params: { checkout: "1" } } as any)}
                  >
                    <Text style={styles.subscribeButtonText}>Продлить клуб →</Text>
                  </Pressable>
                ) : null}
              </>
            ) : (
              <>
                <Text style={styles.subscriptionInfo}>
                  У тебя нет активной подписки
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.subscribeButton,
                    pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
                  ]}
                  onPress={() => router.push("/(tabs)/club" as any)}
                >
                  <Text style={styles.subscribeButtonText}>Вступить в Клуб Darcy →</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>

        {/* ─── Ask Question Section ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="chat-bubble-outline" size={18} color={BROWN_MUTED} />
            <Text style={styles.sectionTitle}>Задать вопрос</Text>
          </View>
          <View style={styles.askRow}>
            <Pressable
              style={({ pressed }) => [
                styles.askCard,
                pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
              ]}
              onPress={() => openSupportMail("Вопрос по подписке Клуб Darcy")}
            >
              <MaterialIcons name="payment" size={22} color={OLIVE} />
              <Text style={styles.askCardTitle}>По подписке</Text>
              <Text style={styles.askCardSubtitle}>Специалист по подпискам</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.askCard,
                pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
              ]}
              onPress={() => openSupportMail("Вопрос по приложению DARYADARCY")}
            >
              <MaterialIcons name="build" size={22} color={OLIVE} />
              <Text style={styles.askCardTitle}>По приложению</Text>
              <Text style={styles.askCardSubtitle}>Технический специалист</Text>
            </Pressable>
          </View>
        </View>

        {/* ─── Admin ─── */}
        {(isOwner || isAuthOwner) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="admin-panel-settings" size={18} color={BROWN_MUTED} />
              <Text style={styles.sectionTitle}>Админка</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.aestheticResultCard, pressed && { opacity: 0.85 }]}
              onPress={() => router.push("/admin" as any)}
            >
              <Text style={styles.cardText}>Посты, календарь, участницы и оплаты клуба</Text>
              <Text style={styles.aestheticViewMore}>Открыть админку →</Text>
            </Pressable>
          </View>
        )}

        {/* ─── Account ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="person-outline" size={18} color={BROWN_MUTED} />
            <Text style={styles.sectionTitle}>Аккаунт</Text>
          </View>
          {user ? (
            <View style={styles.card}>
              <Text style={styles.cardText}>
                {user.email || user.name || (user.phone ? formatRuPhone(user.phone) : "Вы вошли")}
              </Text>
              {user.phone && (user.email || user.name) ? (
                <Text style={styles.cardText}>{formatRuPhone(user.phone)}</Text>
              ) : null}
              {user.phone ? null : (
                <View style={{ width: "100%", marginTop: 4 }}>
                  <Text style={styles.cardText}>Привяжите телефон, чтобы входить по SMS</Text>
                  <SmsCodeForm
                    purpose="bind"
                    onSuccess={async (apiUser) => {
                      await applySession(apiUser);
                      await refresh();
                    }}
                  />
                </View>
              )}
              <Pressable
                style={({ pressed }) => [styles.logoutButton, pressed && { opacity: 0.8 }]}
                onPress={async () => {
                  await logout();
                }}
              >
                <Text style={styles.logoutButtonText}>Выйти</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardText}>Войдите, чтобы сохранять посты и открыть админку</Text>
              <Pressable
                style={({ pressed }) => [styles.lockedButton, pressed && { opacity: 0.8 }]}
                onPress={() => router.push("/login?next=/profile" as any)}
              >
                <Text style={styles.lockedButtonText}>Войти</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
      </ImageBackground>
  </ScreenContainer>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  cropperContainer: {
    flex: 1,
    backgroundColor: CREAM,
  },

  // Profile Header
  profileHeader: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 20,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "rgba(139,115,85,0.2)",
    position: "relative",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  avatarPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(139,115,85,0.06)",
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: OLIVE,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: CREAM,
  },
  profileName: {
    fontFamily: "Gogol-Regular",
    fontSize: 24,
    color: BROWN,
    textAlign: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  nameEditRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  nameInput: {
    fontFamily: "Gogol-Regular",
    fontSize: 24,
    color: BROWN,
    textAlign: "center",
    borderBottomWidth: 1,
    borderBottomColor: OLIVE,
    paddingVertical: 4,
    paddingHorizontal: 12,
    minWidth: 120,
  },
  subscriptionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(107,123,94,0.1)",
  },
  subscriptionBadgeText: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 13,
    color: OLIVE,
  },

  // Sections
  section: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  sectionTitle: {
    fontFamily: "EBGaramond-SemiBold",
    fontSize: 14,
    color: BROWN,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },

  // Tabs
  tabRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  tabButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(139,115,85,0.2)",
    backgroundColor: "rgba(253,248,240,0.9)",
  },
  tabButtonActive: {
    backgroundColor: OLIVE,
    borderColor: OLIVE,
  },
  tabButtonText: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 14,
    color: BROWN_MUTED,
  },
  tabButtonTextActive: {
    fontFamily: "EBGaramond-SemiBold",
    color: "#FFFFFF",
  },

  // Saved grid
  savedGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  savedGridItem: {
    width: "31%",
  },
  savedPostCard: {
    borderRadius: 10,
    overflow: "hidden",
    aspectRatio: 1,
  },
  savedPostImage: {
    width: "100%",
    height: "100%",
  },
  savedPostTextOnly: {
    flex: 1,
    backgroundColor: "rgba(253,248,240,0.95)",
    borderWidth: 1,
    borderColor: "rgba(212,196,168,0.4)",
    borderRadius: 10,
    padding: 8,
    justifyContent: "center",
  },
  savedPostTitle: {
    fontFamily: "EBGaramond-SemiBold",
    fontSize: 11,
    color: BROWN,
    lineHeight: 14,
    marginBottom: 3,
  },
  savedPostPreview: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 10,
    color: BROWN_MUTED,
    lineHeight: 13,
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  emptyStateText: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 14,
    color: BROWN_MUTED,
    textAlign: "center",
  },

  // Card
  card: {
    backgroundColor: "rgba(253,248,240,0.95)",
    borderWidth: 1,
    borderColor: "rgba(212,196,168,0.4)",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    gap: 10,
  },
  cardText: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 15,
    color: BROWN_MUTED,
    textAlign: "center",
  },
  cardButton: {
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "rgba(107,123,94,0.1)",
  },
  cardButtonText: {
    fontFamily: "EBGaramond-SemiBold",
    fontSize: 14,
    color: OLIVE,
  },

  // Aesthetic result
  aestheticResultCard: {
    backgroundColor: "rgba(253,248,240,0.95)",
    borderWidth: 1,
    borderColor: "rgba(212,196,168,0.4)",
    borderRadius: 12,
    padding: 20,
    gap: 6,
  },
  aestheticResultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  aestheticResultTitle: {
    fontFamily: "Gogol-Regular",
    fontSize: 20,
    color: OLIVE,
  },
  aestheticResultSubtitle: {
    fontFamily: "EBGaramond-Italic",
    fontSize: 14,
    color: BROWN_MUTED,
    lineHeight: 20,
  },
  aestheticBlendNote: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 13,
    color: BROWN_MUTED,
    marginTop: 2,
  },
  aestheticViewMore: {
    fontFamily: "EBGaramond-SemiBold",
    fontSize: 13,
    color: OLIVE,
    marginTop: 8,
  },

  // Subscription
  subscriptionCard: {
    backgroundColor: "rgba(253,248,240,0.95)",
    borderWidth: 1,
    borderColor: "rgba(212,196,168,0.4)",
    borderRadius: 12,
    padding: 20,
    gap: 12,
  },
  subscriptionStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4CAF50",
  },
  subscriptionStatusText: {
    fontFamily: "EBGaramond-SemiBold",
    fontSize: 15,
    color: OLIVE,
  },
  subscriptionInfo: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 14,
    color: BROWN_MUTED,
    lineHeight: 20,
  },
  subscriptionActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  subscriptionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(139,115,85,0.2)",
  },
  subscriptionButtonText: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 13,
    color: BROWN,
  },
  subscriptionButtonDanger: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(139,115,85,0.2)",
  },
  subscriptionButtonDangerText: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 13,
    color: BROWN_MUTED,
  },
  subscribeButton: {
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: OLIVE,
    alignItems: "center",
    marginTop: 4,
  },
  subscribeButtonText: {
    fontFamily: "EBGaramond-SemiBold",
    fontSize: 15,
    color: CREAM,
  },

  // Ask Question
  askRow: {
    flexDirection: "row",
    gap: 12,
  },
  askCard: {
    flex: 1,
    backgroundColor: "rgba(253,248,240,0.95)",
    borderWidth: 1,
    borderColor: "rgba(212,196,168,0.4)",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  askCardTitle: {
    fontFamily: "EBGaramond-SemiBold",
    fontSize: 14,
    color: BROWN,
    textAlign: "center",
  },
  askCardSubtitle: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 12,
    color: BROWN_MUTED,
    textAlign: "center",
  },

  // Locked profile (non-subscriber)
  lockedContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingVertical: 80,
    gap: 16,
  },
  lockedTitle: {
    fontFamily: "EBGaramond-SemiBold",
    fontSize: 24,
    color: BROWN,
    letterSpacing: 3,
    marginTop: 8,
  },
  lockedText: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 16,
    color: BROWN_MUTED,
    textAlign: "center",
    lineHeight: 24,
  },
  lockedButton: {
    marginTop: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: OLIVE,
  },
  lockedButtonText: {
    fontFamily: "EBGaramond-SemiBold",
    fontSize: 15,
    color: CREAM,
  },
  logoutButton: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(139,115,85,0.35)",
  },
  logoutButtonText: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 15,
    color: BROWN,
    textAlign: "center",
  },
});
