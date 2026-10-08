"use client";
import classes from "./profile-screen.module.scss";
import { useSubscriptionCancellation } from "./use-subscription-cancellation";
import {
  Action,
  Typography,
  Background,
  ScrollArea,
  Field,
} from "@/shared/ui/elements";
import { openExternalUrl } from "@/shared/browser/actions";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Picture } from "@/shared/media/image";
import { MaterialIcons } from "@/shared/ui/icons";
import { ScreenContainer } from "@/shared/ui/screen-container";

import * as ImagePicker from "@/shared/browser/file-picker";
import AsyncStorage, { isPersonalDataOwner } from "@/shared/browser/storage";
import { useAuth } from "@/domain/session/session-context";
import { SessionStatus } from "@/domain/session/session-status";
import { SubscriptionStatus } from "@/domain/subscription/subscription-status";
import { useClub } from "@/domain/subscription/subscription-context";
import { AvatarCropper } from "@/shared/media/avatar-cropper";
import { SafeArea } from "@/shared/ui/safe-area";
import { AESTHETIC_NAMES, type AestheticKey } from "@/domain/quiz/quiz-data";
import { useRouter } from "@/shared/navigation/router";
import { useFocusEffect } from "@/shared/navigation/router";
import { QueryRetryState } from "@/shared/ui/query-retry-state";
import { LoadingIndicator } from "@/shared/ui/loading-indicator";
import { ContentPlaceholder } from "@/shared/ui/content-placeholder";
import { trpc } from "@/shared/api/trpc";
import type { ApiOutputs } from "@/shared/api/types";
import { useCapabilities } from "@/shared/api/capabilities";
import { displayPostTitle } from "@/shared/media/media-label";
import { SmsCodeForm } from "@/features/auth/sms-code-form";
import { formatRuPhone } from "@/domain/session/phone";
import {
  PAPER_TEXTURE_URI,
  BROWN_MUTED,
  OLIVE,
  PROFILE_NAME_KEY,
  PROFILE_AVATAR_KEY,
  SUPPORT_EMAIL,
  PERSONAL_MOODBOARDS_ENABLED,
} from "./profile-screen.content";
type SavedPost = ApiOutputs["feed"]["savedPosts"][number];
type SavedTab = "feed" | "club";
function formatRuDate(date: Date): string {
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
function openSupportMail(subject: string) {
  void openExternalUrl(
    `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`,
  );
}
async function uriToBase64(uri: string): Promise<string> {
  if (uri.startsWith("data:")) {
    return uri.split(",")[1] || "";
  }
  const response = await fetch(uri);
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
interface CropperImage {
  uri: string;
  width: number;
  height: number;
}
export default function ProfileScreen() {
  const capabilities = useCapabilities();
  const router = useRouter();
  const {
    user,
    logout,
    isAuthenticated,
    loading: authLoading,
    refresh,
    isOwner: isAuthOwner,
    applySession,
    error: sessionError,
  } = useAuth();
  const {
    isSubscribed,
    expiresAt,
    cancelAtPeriodEnd,
    isOwner,
    monthlyPrice,
    status: subscriptionStatus,
  } = useClub();
  const cancellation = useSubscriptionCancellation();
  const updateProfile = trpc.profile.update.useMutation();
  const uploadAvatar = trpc.profile.uploadAvatar.useMutation();
  const savedFromApi = trpc.feed.savedPosts.useQuery(undefined, {
    enabled: isAuthenticated,
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
  const [, setSavedFeedIds] = useState<number[]>([]);
  const [, setSavedClubIds] = useState<string[]>([]);
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
        try {
          setSavedFeedIds(JSON.parse(feedRaw));
        } catch {}
      }
      if (clubRaw) {
        try {
          setSavedClubIds(JSON.parse(clubRaw));
        } catch {}
      }
    });
  }, []);
  const refetchSavedPosts = savedFromApi.refetch;
  useFocusEffect(
    useCallback(() => {
      loadProfileData();
      if (isAuthenticated) {
        void refetchSavedPosts();
      }
    }, [isAuthenticated, loadProfileData, refetchSavedPosts]),
  );
  const displayName = profileName || user?.name || "Участница";
  const serverAvatar =
    user?.avatarUrl && /^https?:\/\//.test(user.avatarUrl)
      ? user.avatarUrl
      : null;
  const displayAvatar = avatarUri || serverAvatar;
  useEffect(() => {
    if (!serverAvatar) return;
    setAvatarUri((current) =>
      current === serverAvatar ? current : serverAvatar,
    );
    void AsyncStorage.setItem(PROFILE_AVATAR_KEY, serverAvatar);
  }, [serverAvatar]);
  const savedPosts = useMemo(() => {
    const rows = savedFromApi.data || [];
    const feedRows = rows.filter((p) => p.target !== "club");
    const clubRows = rows.filter(
      (p) => p.target === "club" || p.target === "both",
    );
    if (savedTab === "feed") {
      return feedRows;
    }
    return clubRows;
  }, [savedTab, savedFromApi.data]);
  const isLoadingSaved = savedFromApi.isLoading;
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    }).catch((error: unknown) => {
      window.alert(
        error instanceof Error ? error.message : "Не удалось выбрать фото",
      );
      return { canceled: true, assets: [] };
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
    const ownerId = user?.id;
    if (!ownerId || !isPersonalDataOwner(ownerId)) return;
    setAvatarUri(croppedUri);
    setCropperImage(null);
    try {
      const base64 = await uriToBase64(croppedUri);
      if (base64 && isPersonalDataOwner(ownerId)) {
        const result = await uploadAvatar.mutateAsync({
          base64,
          filename: "avatar.jpg",
          mimeType: "image/jpeg",
        });
        if (result?.url && isPersonalDataOwner(ownerId)) {
          setAvatarUri(result.url);
          await AsyncStorage.setItem(PROFILE_AVATAR_KEY, result.url);
        }
        await refresh();
      }
    } catch {}
  };
  const handleCropCancel = () => {
    setCropperImage(null);
  };
  // Show cropper full-screen
  if (cropperImage) {
    return (
      <SafeArea
        edges={["top", "bottom", "left", "right"]}
        className={classes.cropperContainer}
      >
        <AvatarCropper
          imageUri={cropperImage.uri}
          imageWidth={cropperImage.width}
          imageHeight={cropperImage.height}
          onCrop={handleCropComplete}
          onCancel={handleCropCancel}
        />
      </SafeArea>
    );
  }
  // Render saved post card
  const handlePostPress = (post: SavedPost) => {
    if (savedTab === "feed" && post.id) {
      // Navigate to feed post detail
      router.push(`/post/${post.id}`);
    } else if (savedTab === "club") {
      // Navigate to club tab
      router.push("/club");
    }
  };
  const renderSavedPost = ({ item }: { item: SavedPost }) => (
    <Action
      onClick={() => handlePostPress(item)}
      className={({ pressed }) =>
        [classes.action, pressed ? classes.opacityState : ""]
          .filter(Boolean)
          .join(" ")
      }
    >
      {item.photos && item.photos.length > 0 ? (
        <Picture
          source={{ uri: item.photos[0] }}
          contentFit="cover"
          className={classes.savedPostImage}
        />
      ) : (
        <div
          className={["ui-stack ", classes.savedPostTextOnly]
            .filter(Boolean)
            .join(" ")}
        >
          <Typography lines={2} className={classes.savedPostTitle}>
            {displayPostTitle(item.text)}
          </Typography>
          <Typography lines={3} className={classes.savedPostPreview}>
            {item.text || ""}
          </Typography>
        </div>
      )}
    </Action>
  );
  // Auth / subscription gates
  if (sessionError) return <SessionStatus />;
  if (authLoading) {
    return (
      <ScreenContainer backgroundColor="#FDF8F0">
        <Background
          source={{ uri: PAPER_TEXTURE_URI }}
          fit="cover"
          className={classes.background}
        >
          <LoadingIndicator label="Проверяем доступ…" />
        </Background>
      </ScreenContainer>
    );
  }
  if (!isAuthenticated) {
    return (
      <ScreenContainer backgroundColor="#FDF8F0">
        <Background
          source={{ uri: PAPER_TEXTURE_URI }}
          fit="cover"
          className={classes.background2}
        >
          <ScrollArea
            hideScrollbar
            contentClassName={classes.scrollAreacontent}
          >
            <div
              className={["ui-stack ", classes.lockedContainer]
                .filter(Boolean)
                .join(" ")}
            >
              <MaterialIcons
                name="person-outline"
                size={48}
                color={BROWN_MUTED}
              />
              <Typography className={classes.lockedTitle}>DARCY</Typography>
              <Typography className={classes.lockedText}>
                Войдите, чтобы открыть личный кабинет: сохранённое, эстетика,
                подписка и профиль.
              </Typography>
              <Action
                onClick={() => router.push("/login?next=/profile")}
                className={({ pressed }) =>
                  [
                    classes.action2,
                    pressed ? classes.opacityState2 : "",
                    pressed ? classes.transformState : "",
                  ]
                    .filter(Boolean)
                    .join(" ")
                }
              >
                <Typography className={classes.lockedButtonText}>
                  Войти →
                </Typography>
              </Action>
            </div>
          </ScrollArea>
        </Background>
      </ScreenContainer>
    );
  }
  if (subscriptionStatus === "checking" || subscriptionStatus === "error") {
    return (
      <ScreenContainer backgroundColor="#FDF8F0">
        <SubscriptionStatus />
      </ScreenContainer>
    );
  }
  if (!isSubscribed) {
    return (
      <ScreenContainer backgroundColor="#FDF8F0">
        <Background
          source={{ uri: PAPER_TEXTURE_URI }}
          fit="cover"
          className={classes.background2}
        >
          <ScrollArea
            hideScrollbar
            contentClassName={classes.scrollAreacontent}
          >
            <div
              className={["ui-stack ", classes.lockedContainer]
                .filter(Boolean)
                .join(" ")}
            >
              <MaterialIcons
                name="lock-outline"
                size={48}
                color={BROWN_MUTED}
              />
              <Typography className={classes.lockedTitle}>DARCY</Typography>
              <Typography className={classes.lockedText}>
                Личный профиль с возможностью сохранять публикации и результаты
                интерактивов доступен для участниц клуба Darcy
              </Typography>
              <Action
                onClick={() => router.push("/club")}
                className={({ pressed }) =>
                  [
                    classes.action2,
                    pressed ? classes.opacityState3 : "",
                    pressed ? classes.transformState2 : "",
                  ]
                    .filter(Boolean)
                    .join(" ")
                }
              >
                <Typography className={classes.lockedButtonText}>
                  Вступить в клуб →
                </Typography>
              </Action>
            </div>
          </ScrollArea>
        </Background>
      </ScreenContainer>
    );
  }
  return (
    <ScreenContainer backgroundColor="#FDF8F0">
      <Background
        source={{ uri: PAPER_TEXTURE_URI }}
        fit="cover"
        className={classes.background2}
      >
        <ScrollArea hideScrollbar>
          {/* ─── Profile Header ─── */}
          <div
            className={["ui-stack ", classes.profileHeader]
              .filter(Boolean)
              .join(" ")}
          >
            <Action
              onClick={pickImage}
              aria-label="Выбрать фото профиля"
              className={({ pressed }) =>
                [classes.action3, pressed ? classes.opacityState4 : ""]
                  .filter(Boolean)
                  .join(" ")
              }
            >
              {displayAvatar ? (
                <Picture
                  source={{ uri: displayAvatar }}
                  contentFit="cover"
                  className={classes.savedPostImage}
                />
              ) : (
                <div
                  className={["ui-stack ", classes.avatarPlaceholder]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <MaterialIcons name="person" size={40} color={BROWN_MUTED} />
                </div>
              )}
              <div
                className={["ui-stack ", classes.avatarEditBadge]
                  .filter(Boolean)
                  .join(" ")}
              >
                <MaterialIcons name="edit" size={12} color="#FFF" />
              </div>
            </Action>

            {isEditingName ? (
              <div
                className={["ui-stack ", classes.nameEditRow]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Field
                  value={editNameValue}
                  onValueChange={setEditNameValue}
                  autoFocus
                  onSubmit={async () => {
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
                  className={classes.nameInput}
                />
              </div>
            ) : (
              <Action
                onClick={() => {
                  setEditNameValue(displayName);
                  setIsEditingName(true);
                }}
                className={({ pressed }) =>
                  pressed ? classes.opacityState5 : classes.opacityState6
                }
              >
                <div
                  className={["ui-stack ", classes.nameRow]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Typography className={classes.profileName}>
                    {displayName}
                  </Typography>
                  <MaterialIcons
                    name="edit"
                    size={14}
                    color={BROWN_MUTED}
                    className={classes.materialIcons}
                  />
                </div>
              </Action>
            )}

            {isSubscribed && (
              <div
                className={["ui-stack ", classes.subscriptionBadge]
                  .filter(Boolean)
                  .join(" ")}
              >
                <MaterialIcons name="star" size={13} color={OLIVE} />
                <Typography className={classes.subscriptionBadgeText}>
                  Клуб Darcy
                </Typography>
              </div>
            )}
          </div>

          {/* ─── Saved Posts Tabs ─── */}
          <div
            className={["ui-stack ", classes.section].filter(Boolean).join(" ")}
          >
            <div
              className={["ui-stack ", classes.sectionHeader]
                .filter(Boolean)
                .join(" ")}
            >
              <MaterialIcons
                name="bookmark-border"
                size={18}
                color={BROWN_MUTED}
              />
              <Typography className={classes.sectionTitle}>
                Сохранённое
              </Typography>
            </div>
            <div
              className={["ui-stack ", classes.tabRow]
                .filter(Boolean)
                .join(" ")}
            >
              <Action
                onClick={() => setSavedTab("feed")}
                className={[
                  classes.tabButtonActive,
                  savedTab === "feed"
                    ? classes.appearanceState
                    : classes.appearanceState2,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Typography
                  className={[
                    classes.tabButtonTextActive,
                    savedTab === "feed"
                      ? classes.appearanceState3
                      : classes.appearanceState4,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  Из ленты
                </Typography>
              </Action>
              <Action
                onClick={() => setSavedTab("club")}
                className={[
                  classes.tabButtonActive,
                  savedTab === "club"
                    ? classes.appearanceState5
                    : classes.appearanceState6,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Typography
                  className={[
                    classes.tabButtonTextActive,
                    savedTab === "club"
                      ? classes.appearanceState7
                      : classes.appearanceState8,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  Из клуба
                </Typography>
              </Action>
            </div>

            {/* Saved posts grid */}
            {isLoadingSaved ? (
              <div
                className={["ui-stack ", classes.emptyState]
                  .filter(Boolean)
                  .join(" ")}
              >
                <ContentPlaceholder kind="feed" />
              </div>
            ) : savedFromApi.isError ? (
              <QueryRetryState
                isLoading={false}
                isError
                onRetry={() => void savedFromApi.refetch()}
                message="Не удалось загрузить сохранённые посты"
              />
            ) : savedPosts.length === 0 ? (
              <div
                className={["ui-stack ", classes.emptyState]
                  .filter(Boolean)
                  .join(" ")}
              >
                <MaterialIcons
                  name="bookmark-border"
                  size={36}
                  color={BROWN_MUTED}
                />
                <Typography className={classes.emptyStateText}>
                  {savedTab === "feed"
                    ? "Здесь будут сохранённые посты из ленты"
                    : "Здесь будут сохранённые посты из клуба"}
                </Typography>
              </div>
            ) : (
              <div
                className={["ui-stack ", classes.savedGrid]
                  .filter(Boolean)
                  .join(" ")}
              >
                {savedPosts.map((post) => (
                  <div
                    key={post.id}
                    className={["ui-stack ", classes.savedGridItem]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {renderSavedPost({ item: post })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─── Aesthetics Section ─── */}
          <div
            className={["ui-stack ", classes.section].filter(Boolean).join(" ")}
          >
            <div
              className={["ui-stack ", classes.sectionHeader]
                .filter(Boolean)
                .join(" ")}
            >
              <MaterialIcons
                name="auto-stories"
                size={18}
                color={BROWN_MUTED}
              />
              <Typography className={classes.sectionTitle}>Эстетика</Typography>
            </div>
            {quizResult ? (
              <Action
                onClick={() => router.push("/quiz")}
                className={({ pressed }) =>
                  [classes.action4, pressed ? classes.opacityState7 : ""]
                    .filter(Boolean)
                    .join(" ")
                }
              >
                <div
                  className={["ui-stack ", classes.aestheticResultHeader]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <MaterialIcons name="auto-stories" size={22} color={OLIVE} />
                  <Typography className={classes.aestheticResultTitle}>
                    {AESTHETIC_NAMES[quizResult.primaryKey]}
                  </Typography>
                </div>
                <Typography className={classes.aestheticResultSubtitle}>
                  {quizResult.primaryTitle}
                </Typography>
                {quizResult.isBlend && quizResult.secondaryKey && (
                  <Typography className={classes.aestheticBlendNote}>
                    Бленд с {AESTHETIC_NAMES[quizResult.secondaryKey]}
                  </Typography>
                )}
                <Typography className={classes.aestheticViewMore}>
                  Посмотреть результат →
                </Typography>
              </Action>
            ) : (
              <div
                className={["ui-stack ", classes.card]
                  .filter(Boolean)
                  .join(" ")}
              >
                <MaterialIcons name="palette" size={24} color={BROWN_MUTED} />
                <Typography className={classes.cardText}>
                  Пройди тест, чтобы узнать свою эстетику
                </Typography>
                <Action
                  onClick={() => router.push("/quiz")}
                  className={({ pressed }) =>
                    [classes.action5, pressed ? classes.opacityState8 : ""]
                      .filter(Boolean)
                      .join(" ")
                  }
                >
                  <Typography className={classes.cardButtonText}>
                    Пройти тест →
                  </Typography>
                </Action>
              </div>
            )}
          </div>

          {/* ─── Moodboards Section ─── */}
          {PERSONAL_MOODBOARDS_ENABLED && (
            <div
              className={["ui-stack ", classes.section]
                .filter(Boolean)
                .join(" ")}
            >
              <div
                className={["ui-stack ", classes.sectionHeader]
                  .filter(Boolean)
                  .join(" ")}
              >
                <MaterialIcons name="dashboard" size={18} color={BROWN_MUTED} />
                <Typography className={classes.sectionTitle}>
                  Мои мудборды
                </Typography>
              </div>
              {quizResult ? (
                <Action
                  onClick={() => router.push("/library/aesthetics-guide")}
                  className={({ pressed }) =>
                    [classes.action4, pressed ? classes.opacityState9 : ""]
                      .filter(Boolean)
                      .join(" ")
                  }
                >
                  <MaterialIcons name="dashboard" size={24} color={OLIVE} />
                  <Typography className={classes.cardText}>
                    Мудборд: {AESTHETIC_NAMES[quizResult.primaryKey]}
                  </Typography>
                  <Typography className={classes.aestheticViewMore}>
                    Открыть подборку →
                  </Typography>
                </Action>
              ) : (
                <div
                  className={["ui-stack ", classes.card]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <MaterialIcons
                    name="dashboard"
                    size={24}
                    color={BROWN_MUTED}
                  />
                  <Typography className={classes.cardText}>
                    Здесь появится твой мудборд
                  </Typography>
                  <Action
                    onClick={() => router.push("/interactive")}
                    className={({ pressed }) =>
                      [classes.action5, pressed ? classes.opacityState10 : ""]
                        .filter(Boolean)
                        .join(" ")
                    }
                  >
                    <Typography className={classes.cardButtonText}>
                      Создать мудборд →
                    </Typography>
                  </Action>
                </div>
              )}
            </div>
          )}

          {/* ─── Subscription Section ─── */}
          <div
            className={["ui-stack ", classes.section].filter(Boolean).join(" ")}
          >
            <div
              className={["ui-stack ", classes.sectionHeader]
                .filter(Boolean)
                .join(" ")}
            >
              <MaterialIcons
                name="card-membership"
                size={18}
                color={BROWN_MUTED}
              />
              <Typography className={classes.sectionTitle}>
                Подписка на клуб DARCY
              </Typography>
            </div>
            <div
              className={["ui-stack ", classes.subscriptionCard]
                .filter(Boolean)
                .join(" ")}
            >
              {isSubscribed ? (
                <>
                  <div
                    className={["ui-stack ", classes.subscriptionStatus]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <div
                      className={["ui-stack ", classes.statusDot]
                        .filter(Boolean)
                        .join(" ")}
                    />
                    <Typography className={classes.subscriptionStatusText}>
                      {cancelAtPeriodEnd
                        ? "Отменена, доступ сохранён"
                        : "Активна"}
                    </Typography>
                  </div>
                  <Typography className={classes.subscriptionInfo}>
                    {isOwner
                      ? expiresAt
                        ? `Профиль владелицы клуба. Доступ открыт до ${formatRuDate(expiresAt)}`
                        : "Профиль владелицы клуба, доступ без оплаты"
                      : cancelAtPeriodEnd && expiresAt
                        ? `Автосписание отключено. Доступ до ${formatRuDate(expiresAt)}`
                        : expiresAt
                          ? `Следующее списание: ${formatRuDate(expiresAt)} · ${monthlyPrice} ₽ / месяц`
                          : `Ежемесячная подписка ${monthlyPrice} ₽`}
                  </Typography>
                  {!isOwner && !cancelAtPeriodEnd ? (
                    <Action
                      onClick={() => void cancellation.cancel()}
                      disabled={cancellation.blocked}
                      className={({ pressed }) =>
                        [
                          classes.action6,
                          pressed || cancellation.blocked
                            ? classes.opacityState11
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")
                      }
                    >
                      <Typography
                        className={classes.subscriptionButtonDangerText}
                      >
                        {cancellation.pending === "cancel-subscription"
                          ? "Отменяем…"
                          : "Отменить подписку"}
                      </Typography>
                    </Action>
                  ) : null}
                  {cancellation.notice ? (
                    <>
                      <Typography
                        role="status"
                        className={classes.subscriptionInfo}
                      >
                        {cancellation.notice.message}
                      </Typography>
                      {cancellation.notice.status === "unknown" ? (
                        <Action
                          onClick={() => void cancellation.check()}
                          disabled={cancellation.busy}
                          className={({ pressed }) =>
                            [
                              classes.action6,
                              pressed || cancellation.busy
                                ? classes.opacityState11
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" ")
                          }
                        >
                          <Typography
                            className={classes.subscriptionButtonDangerText}
                          >
                            {cancellation.pending === "check-cancellation"
                              ? "Проверяем…"
                              : "Проверить отмену"}
                          </Typography>
                        </Action>
                      ) : null}
                    </>
                  ) : null}
                  {!isOwner ? (
                    <Action
                      onClick={() =>
                        router.push({
                          pathname: "/club",
                          params: { checkout: "1" },
                        })
                      }
                      className={({ pressed }) =>
                        [
                          classes.action7,
                          pressed ? classes.opacityState12 : "",
                          pressed ? classes.transformState3 : "",
                        ]
                          .filter(Boolean)
                          .join(" ")
                      }
                    >
                      <Typography className={classes.lockedButtonText}>
                        Продлить клуб →
                      </Typography>
                    </Action>
                  ) : null}
                </>
              ) : (
                <>
                  <Typography className={classes.subscriptionInfo}>
                    У тебя нет активной подписки
                  </Typography>
                  <Action
                    onClick={() => router.push("/club")}
                    className={({ pressed }) =>
                      [
                        classes.action8,
                        pressed ? classes.opacityState13 : "",
                        pressed ? classes.transformState4 : "",
                      ]
                        .filter(Boolean)
                        .join(" ")
                    }
                  >
                    <Typography className={classes.lockedButtonText}>
                      Вступить в Клуб Darcy →
                    </Typography>
                  </Action>
                </>
              )}
            </div>
          </div>

          {/* ─── Ask Question Section ─── */}
          <div
            className={["ui-stack ", classes.section].filter(Boolean).join(" ")}
          >
            <div
              className={["ui-stack ", classes.sectionHeader]
                .filter(Boolean)
                .join(" ")}
            >
              <MaterialIcons
                name="chat-bubble-outline"
                size={18}
                color={BROWN_MUTED}
              />
              <Typography className={classes.sectionTitle}>
                Задать вопрос
              </Typography>
            </div>
            <div
              className={["ui-stack ", classes.askRow]
                .filter(Boolean)
                .join(" ")}
            >
              <Action
                onClick={() => openSupportMail("Вопрос по подписке Клуб Darcy")}
                className={({ pressed }) =>
                  [
                    classes.action9,
                    pressed ? classes.opacityState14 : "",
                    pressed ? classes.transformState5 : "",
                  ]
                    .filter(Boolean)
                    .join(" ")
                }
              >
                <MaterialIcons name="payment" size={22} color={OLIVE} />
                <Typography className={classes.askCardTitle}>
                  По подписке
                </Typography>
                <Typography className={classes.askCardSubtitle}>
                  Специалист по подпискам
                </Typography>
              </Action>
              <Action
                onClick={() =>
                  openSupportMail("Вопрос по приложению DARYADARCY")
                }
                className={({ pressed }) =>
                  [
                    classes.action9,
                    pressed ? classes.opacityState15 : "",
                    pressed ? classes.transformState6 : "",
                  ]
                    .filter(Boolean)
                    .join(" ")
                }
              >
                <MaterialIcons name="build" size={22} color={OLIVE} />
                <Typography className={classes.askCardTitle}>
                  По приложению
                </Typography>
                <Typography className={classes.askCardSubtitle}>
                  Технический специалист
                </Typography>
              </Action>
            </div>
          </div>

          {/* ─── Admin ─── */}
          {(isOwner || isAuthOwner || user?.role === "moderator") && (
            <div
              className={["ui-stack ", classes.section]
                .filter(Boolean)
                .join(" ")}
            >
              <div
                className={["ui-stack ", classes.sectionHeader]
                  .filter(Boolean)
                  .join(" ")}
              >
                <MaterialIcons
                  name="admin-panel-settings"
                  size={18}
                  color={BROWN_MUTED}
                />
                <Typography className={classes.sectionTitle}>
                  {user?.role === "moderator" ? "Модерация" : "Админка"}
                </Typography>
              </div>
              <Action
                onClick={() => router.push("/admin")}
                className={({ pressed }) =>
                  [classes.action4, pressed ? classes.opacityState16 : ""]
                    .filter(Boolean)
                    .join(" ")
                }
              >
                <Typography className={classes.cardText}>
                  {user?.role === "moderator"
                    ? "Жалобы и модерация комментариев"
                    : "Посты, календарь, участницы и оплаты клуба"}
                </Typography>
                <Typography className={classes.aestheticViewMore}>
                  {user?.role === "moderator"
                    ? "Открыть модерацию →"
                    : "Открыть админку →"}
                </Typography>
              </Action>
            </div>
          )}

          {/* ─── Account ─── */}
          <div
            className={["ui-stack ", classes.section].filter(Boolean).join(" ")}
          >
            <div
              className={["ui-stack ", classes.sectionHeader]
                .filter(Boolean)
                .join(" ")}
            >
              <MaterialIcons
                name="person-outline"
                size={18}
                color={BROWN_MUTED}
              />
              <Typography className={classes.sectionTitle}>Аккаунт</Typography>
            </div>
            {user ? (
              <div
                className={["ui-stack ", classes.card]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Typography className={classes.cardText}>
                  {user.email ||
                    user.name ||
                    (user.phone ? formatRuPhone(user.phone) : "Вы вошли")}
                </Typography>
                {user.phone && (user.email || user.name) ? (
                  <Typography className={classes.cardText}>
                    {formatRuPhone(user.phone)}
                  </Typography>
                ) : null}
                {user.phone || !capabilities.smsLogin ? null : (
                  <div
                    className={["ui-stack ", classes.div]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <Typography className={classes.cardText}>
                      Привяжите телефон, чтобы входить по SMS
                    </Typography>
                    <SmsCodeForm
                      purpose="bind"
                      onSuccess={async (apiUser) => {
                        await applySession(apiUser);
                        await refresh();
                      }}
                    />
                  </div>
                )}
                <Action
                  onClick={async () => {
                    await logout();
                  }}
                  className={({ pressed }) =>
                    [classes.action10, pressed ? classes.opacityState17 : ""]
                      .filter(Boolean)
                      .join(" ")
                  }
                >
                  <Typography className={classes.logoutButtonText}>
                    Выйти
                  </Typography>
                </Action>
              </div>
            ) : (
              <div
                className={["ui-stack ", classes.card]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Typography className={classes.cardText}>
                  Войдите, чтобы сохранять посты и открыть админку
                </Typography>
                <Action
                  onClick={() => router.push("/login?next=/profile")}
                  className={({ pressed }) =>
                    [classes.action2, pressed ? classes.opacityState18 : ""]
                      .filter(Boolean)
                      .join(" ")
                  }
                >
                  <Typography className={classes.lockedButtonText}>
                    Войти
                  </Typography>
                </Action>
              </div>
            )}
          </div>

          <div
            className={["ui-stack ", classes.div2].filter(Boolean).join(" ")}
          />
        </ScrollArea>
      </Background>
    </ScreenContainer>
  );
}
