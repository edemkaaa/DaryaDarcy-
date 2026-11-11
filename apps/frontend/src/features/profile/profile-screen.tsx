"use client";
/** Профиль объединяет подтверждённые данные аккаунта, подписку и страницы сохранённого; клубные карточки скрываются после потери доступа. */
import classes from "./profile-screen.module.scss";
import { useSubscriptionCancellation } from "./use-subscription-cancellation";
import { ProfileNameEditor } from "./profile-name-editor";
import { getClubPaymentMode } from "@/features/club/payment-mode";
import {
  Action,
  Typography,
  Background,
  ScrollArea,
} from "@/shared/ui/elements";
import { openExternalUrl } from "@/shared/browser/actions";
import { useState, useCallback, useMemo, useRef } from "react";
import { CursorPagePrevious } from "@/shared/ui/cursor-page-previous";
import { CollectionScrollAnchor } from "@/shared/ui/collection";
import { Picture } from "@/shared/media/image";
import { MaterialIcons } from "@/shared/ui/icons";
import { ScreenContainer } from "@/shared/ui/screen-container";

import * as ImagePicker from "@/shared/browser/file-picker";
import { MAX_AVATAR_SOURCE_BYTES } from "@/shared/browser/file-operations";
import AsyncStorage, { isPersonalDataOwner } from "@/shared/browser/storage";
import { useAuth } from "@/domain/session/session-context";
import { SessionStatus } from "@/domain/session/session-status";
import { SubscriptionStatus } from "@/domain/subscription/subscription-status";
import { useClub } from "@/domain/subscription/subscription-context";
import { AvatarCropper } from "@/shared/media/avatar-cropper";
import { SafeArea } from "@/shared/ui/safe-area";
import { AESTHETIC_NAMES, type AestheticKey } from "@/domain/quiz/quiz-data";
import { parseSavedQuizResult } from "@/domain/quiz/saved-result";
import { useRouter } from "@/shared/navigation/router";
import { useFocusEffect } from "@/shared/navigation/router";
import { QueryRetryState } from "@/shared/ui/query-retry-state";
import { useBackgroundNotice } from "@/shared/ui/background-notice";
import { isTemporaryRequestError } from "@/shared/api/errors";
import { LoadingIndicator } from "@/shared/ui/loading-indicator";
import { ContentPlaceholder } from "@/shared/ui/content-placeholder";
import { useProfileAvatar } from "@/domain/profile/use-profile-avatar";
import { downloadText } from "@/shared/browser/download-text";
import { trpc } from "@/shared/api/trpc";
import { getQueryKey } from "@trpc/react-query";
import { useCursorPages } from "@/shared/api/use-cursor-pages";
import { useScreenActive } from "@/shared/navigation/screen-activity";
import type { ApiOutputs } from "@/shared/api/types";
import { useCapabilities } from "@/shared/api/capabilities";
import { friendlyMediaName } from "@/shared/media/media-label";
import { resolvePostVideos } from "@/domain/post/resolve-post-video";
import { postHref } from "@/shared/navigation/post-address";
import { articleIdFromSource } from "@/domain/content/article-blocks";
import { sanitizePlainPostText } from "@/domain/content/post-text-sanitize";
import { truncateSelectionPreview } from "@shared/rich-text-edit";
import { SmsCodeForm } from "@/features/auth/sms-code-form";
import { formatRuPhone } from "@/domain/session/phone";
import {
  PAPER_TEXTURE_URI,
  BROWN_MUTED,
  OLIVE,
  SUPPORT_EMAIL,
  PERSONAL_MOODBOARDS_ENABLED,
} from "./profile-screen.content";
type SavedPost = ApiOutputs["feed"]["savedPostsPage"]["items"][number];
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
interface CropperImage {
  uri: string;
  width: number;
  height: number;
}
export default function ProfileScreen() {
  const active = useScreenActive();
  const prodamusTest = getClubPaymentMode() === "prodamus-test";
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
    hasClubAccess,
    hasServiceAccess,
    isSubscribed,
    expiresAt,
    cancellationStatus,
    isOwner,
    monthlyPrice,
    status: subscriptionStatus,
  } = useClub();
  const cancellation = useSubscriptionCancellation();
  const cancellationConfirmed = cancellationStatus === "confirmed";
  const avatar = useProfileAvatar();
  const [savedTab, setSavedTab] = useState<SavedTab>("feed");
  const profileScroll = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();
  const savedInput = { target: savedTab, limit: 20 };
  const savedFromApi = useCursorPages({
    key: getQueryKey(trpc.feed.savedPostsPage, savedInput, "query"),
    scope: `${user?.id ?? "guest"}:${hasClubAccess}`,
    enabled: active && isAuthenticated,
    fetchPage: (cursor, signal) =>
      utils.client.feed.savedPostsPage.query(
        { ...savedInput, cursor },
        { signal },
      ),
  });
  const savedRefreshError =
    savedFromApi.data !== undefined &&
    savedFromApi.isError &&
    !savedFromApi.isFetchNextPageError &&
    !savedFromApi.isFetchPreviousPageError &&
    isTemporaryRequestError(savedFromApi.error);
  useBackgroundNotice({
    when: savedRefreshError,
    message: "Не удалось обновить сохранённые посты",
    onRetry: () => savedFromApi.refetch({ cancelRefetch: false }),
  });
  const avatarDraft = avatar.draft;
  useBackgroundNotice({
    when: Boolean(avatar.error),
    message: avatar.error ?? "",
    priority: 1,
    busy: avatar.busy,
    onRetry: avatar.unknown ? avatar.check : undefined,
    actions: [
      ...(avatar.corrupt
        ? [
            {
              id: "download-avatar-draft",
              label: "Скачать копию",
              onClick: () => {
                if (avatar.corrupt)
                  downloadText(avatar.corrupt.raw, "profile-photo-draft.txt");
              },
            },
            {
              id: "reset-avatar-draft",
              label: "Сбросить черновик",
              onClick: () => {
                if (
                  window.confirm(
                    "Сбросить повреждённый черновик фото на этом устройстве? Сначала скачайте копию, если она нужна. Сброс не отменяет ранее отправленную загрузку и не удаляет текущее фото профиля.",
                  )
                )
                  return avatar.resetCorrupt();
              },
            },
          ]
        : []),
      ...(avatar.canRetry && avatarDraft
        ? [
            {
              id: "retry-avatar-upload",
              label: "Повторить загрузку фото",
              onClick: () => saveAvatar(avatarDraft),
            },
          ]
        : []),
    ],
  });
  const [cropperImage, setCropperImage] = useState<CropperImage | null>(null);
  const [quizResult, setQuizResult] = useState<{
    primaryKey: AestheticKey;
    primaryTitle: string;
    secondaryKey: AestheticKey | null;
    isBlend: boolean;
  } | null>(null);
  useFocusEffect(
    useCallback(() => {
      const ownerId = user?.id;
      if (!ownerId) return;
      let current = true;
      void AsyncStorage.getItem("@darcy_quiz_result").then((raw) => {
        if (!current || !isPersonalDataOwner(ownerId)) return;
        const quiz = parseSavedQuizResult(raw);
        setQuizResult(
          quiz
            ? {
                primaryKey: quiz.primary.key,
                primaryTitle: quiz.primary.title,
                secondaryKey: quiz.secondary?.key ?? null,
                isBlend: quiz.isBlend,
              }
            : null,
        );
      });
      return () => {
        current = false;
      };
    }, [user?.id]),
  );
  const displayName = user?.name || "Участница";
  const serverAvatar =
    user?.avatarUrl && /^https?:\/\//.test(user.avatarUrl)
      ? user.avatarUrl
      : null;
  const displayAvatar = serverAvatar;
  // Проверка локального показа дополняет сервер: оставшийся в памяти клубный список не показывается после утраты прав.
  const savedPosts = useMemo(() => {
    // A retained response must not expose club-only cards after access is lost.
    const rows = savedFromApi.items.filter(
      (post) => hasClubAccess || post.target !== "club",
    );
    const feedRows = rows.filter((p) => p.target !== "club");
    const clubRows = rows.filter(
      (p) => p.target === "club" || p.target === "both",
    );
    if (savedTab === "feed") {
      return feedRows;
    }
    return clubRows;
  }, [savedTab, savedFromApi.items, hasClubAccess]);
  const isLoadingSaved = savedFromApi.isLoading;
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      maxBytes: MAX_AVATAR_SOURCE_BYTES,
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
  const saveAvatar = async (uri: string) => {
    await avatar.upload(uri);
  };
  const handleCropComplete = async (croppedUri: string) => {
    setCropperImage(null);
    await saveAvatar(croppedUri);
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
    const articleId = articleIdFromSource(post.source);
    if (articleId) router.push(`/library/article/${articleId}`);
    else if (post.id) router.push(postHref(post));
  };
  const renderSavedPost = ({ item }: { item: SavedPost }) => {
    const preview = truncateSelectionPreview(
      sanitizePlainPostText(item.text) ||
        sanitizePlainPostText(
          item.richText
            ?.map((block) =>
              block.children.map((inline) => inline.text).join(""),
            )
            .join("\n") ?? "",
        ),
    );
    const { videos, stackPhotos } = resolvePostVideos(item.photos, item.media);
    const videoFilename = item.media?.find(
      (media) => media.type === "video",
    )?.filename;
    const attachment = item.media?.find((media) => media.type !== "video");
    const cover = videos[0]?.posterUrl || stackPhotos[0];
    const kind = videos.length
      ? "Видео"
      : attachment?.type === "audio"
        ? "Аудио"
        : attachment?.type === "document"
          ? "Документ"
          : articleIdFromSource(item.source)
            ? "Статья"
            : "Публикация";
    const title =
      preview ||
      (videos.length
        ? friendlyMediaName(videoFilename, "video")
        : attachment
          ? friendlyMediaName(attachment.filename, attachment.type)
          : null) ||
      kind;
    const icon = videos.length
      ? "play-arrow"
      : attachment?.type === "audio"
        ? "audiotrack"
        : attachment?.type === "document"
          ? "description"
          : "article";
    const badgeLabel = videos.length
      ? videos.length > 1
        ? `Видео · ${videos.length}`
        : "Видео"
      : attachment
        ? kind
        : stackPhotos.length > 1
          ? `${stackPhotos.length} фото`
          : null;
    const action = articleIdFromSource(item.source)
      ? "Открыть статью"
      : "Открыть публикацию";
    const date = new Date(item.publishedAt ?? item.createdAt);
    const label =
      preview || videos.length || attachment
        ? `${action}: ${title}`
        : Number.isFinite(date.getTime())
          ? `${action} от ${formatRuDate(date)}`
          : action;
    return (
      <Action
        aria-label={label}
        onClick={() => handlePostPress(item)}
        className={({ pressed }) =>
          [classes.action, pressed ? classes.opacityState : ""]
            .filter(Boolean)
            .join(" ")
        }
      >
        {cover ? (
          <Picture
            source={{ uri: cover }}
            contentFit="cover"
            aria-label={title}
            className={classes.savedPostImage}
            sizes="(max-width: 480px) calc(31vw - 12.4px), 136.4px"
          />
        ) : (
          <div
            className={[
              "ui-stack ",
              classes.savedPostTextOnly,
              badgeLabel ? classes.savedPostWithBadge : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {!preview ? (
              <MaterialIcons name={icon} size={22} color={BROWN_MUTED} />
            ) : null}
            <Typography lines={3} className={classes.savedPostTitle}>
              {title}
            </Typography>
          </div>
        )}
        {badgeLabel ? (
          <span className={classes.savedPostBadge}>
            {videos.length ? (
              <MaterialIcons name="play-arrow" size={13} />
            ) : null}
            {badgeLabel}
          </span>
        ) : null}
      </Action>
    );
  };
  const logoutAction = (
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
      <Typography className={classes.logoutButtonText}>Выйти</Typography>
    </Action>
  );
  // Personal bookmarks require a session, not club membership.
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
                onClick={() => router.login("/profile")}
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
  const cancellationNotice = cancellation.notice ? (
    <>
      <Typography role="status" className={classes.subscriptionInfo}>
        {cancellation.notice.message}
      </Typography>
      {cancellation.notice.status === "unknown" ? (
        <Action
          onClick={() => void cancellation.check()}
          disabled={cancellation.busy}
          className={({ pressed }) =>
            [
              classes.action6,
              pressed || cancellation.busy ? classes.opacityState11 : "",
            ]
              .filter(Boolean)
              .join(" ")
          }
        >
          <Typography className={classes.subscriptionButtonDangerText}>
            {cancellation.pending === "check-cancellation"
              ? "Проверяем…"
              : "Проверить отмену"}
          </Typography>
        </Action>
      ) : null}
    </>
  ) : null;
  return (
    <ScreenContainer backgroundColor="#FDF8F0">
      <Background
        source={{ uri: PAPER_TEXTURE_URI }}
        fit="cover"
        className={classes.background2}
      >
        <ScrollArea
          hideScrollbar
          ref={profileScroll}
          style={{ overflowAnchor: "none" }}
        >
          {/* ─── Profile Header ─── */}
          <div
            className={["ui-stack ", classes.profileHeader]
              .filter(Boolean)
              .join(" ")}
          >
            <Action
              onClick={pickImage}
              disabled={avatar.busy || !avatar.canChoose}
              aria-label="Выбрать фото профиля"
              className={({ pressed }) =>
                [classes.action3, pressed ? classes.opacityState4 : ""]
                  .filter(Boolean)
                  .join(" ")
              }
            >
              <div className={["ui-stack", classes.avatarFrame].join(" ")}>
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
                    <MaterialIcons
                      name="person"
                      size={40}
                      color={BROWN_MUTED}
                    />
                  </div>
                )}
              </div>
              <div
                className={["ui-stack ", classes.avatarEditBadge]
                  .filter(Boolean)
                  .join(" ")}
              >
                <MaterialIcons name="edit" size={12} color="#FFF" />
              </div>
            </Action>

            {avatarDraft && (
              <div className={["ui-stack", classes.nameError].join(" ")}>
                {avatarDraft && (
                  <>
                    <Typography className={classes.nameErrorText}>
                      Черновик фото
                    </Typography>
                    <Picture
                      source={{ uri: avatarDraft }}
                      contentFit="cover"
                      style={{ width: 80, height: 80 }}
                    />
                  </>
                )}
                {avatar.busy && (
                  <Typography role="status" className={classes.nameErrorText}>
                    Сохраняем фото…
                  </Typography>
                )}
              </div>
            )}
            <ProfileNameEditor displayName={displayName} />

            {hasClubAccess && (
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
            <CollectionScrollAnchor
              trackLayout
              root={profileScroll}
              data={savedPosts}
              itemKeys={savedPosts.map((post) => String(post.id))}
            >
              <CursorPagePrevious
                query={savedFromApi}
                label="Предыдущие сохранённые"
              />
              {isLoadingSaved ? (
                <div
                  className={["ui-stack ", classes.emptyState]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <ContentPlaceholder kind="feed" />
                </div>
              ) : savedFromApi.isError &&
                !savedRefreshError &&
                (savedFromApi.denied ||
                  (!savedFromApi.isFetchNextPageError &&
                    !savedFromApi.isFetchPreviousPageError)) ? (
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
                  {savedPosts.map((post, index) => (
                    <div
                      key={post.id}
                      data-item-index={index}
                      className={["ui-stack ", classes.savedGridItem]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {renderSavedPost({ item: post })}
                    </div>
                  ))}
                </div>
              )}
              {savedFromApi.hasNextPage && !savedFromApi.denied ? (
                <Action
                  onClick={() => void savedFromApi.fetchNextPage()}
                  disabled={
                    savedFromApi.isFetching || savedFromApi.isFetchingNextPage
                  }
                  aria-busy={savedFromApi.isFetchingNextPage}
                >
                  <Typography className={classes.emptyStateText}>
                    {savedFromApi.isFetchingNextPage
                      ? "Загрузка…"
                      : savedFromApi.isFetchNextPageError
                        ? "Повторить загрузку сохранённых"
                        : "Загрузить ещё сохранённые"}
                  </Typography>
                </Action>
              ) : null}
            </CollectionScrollAnchor>
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
                onClick={() => router.push("/quiz/result")}
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
              {subscriptionStatus === "checking" ||
              subscriptionStatus === "error" ? (
                <SubscriptionStatus />
              ) : hasServiceAccess ? (
                <>
                  <Typography className={classes.subscriptionStatusText}>
                    Служебный доступ
                  </Typography>
                  <Typography className={classes.subscriptionInfo}>
                    Клуб открыт для модерации. Оплаченной подписки нет.
                  </Typography>
                </>
              ) : isSubscribed ? (
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
                      {cancellationConfirmed
                        ? "Отменена, доступ сохранён"
                        : "Активна"}
                    </Typography>
                  </div>
                  <Typography className={classes.subscriptionInfo}>
                    {isOwner
                      ? expiresAt
                        ? `Профиль владелицы клуба. Доступ открыт до ${formatRuDate(expiresAt)}`
                        : "Профиль владелицы клуба, доступ без оплаты"
                      : prodamusTest
                        ? `Тестовый доступ${expiresAt ? ` до ${formatRuDate(expiresAt)}` : ""}. Без автопродления.`
                        : cancellationConfirmed && expiresAt
                          ? `Автосписание отключено. Доступ до ${formatRuDate(expiresAt)}`
                          : expiresAt
                            ? `Следующее списание: ${formatRuDate(expiresAt)} · ${monthlyPrice} ₽ / месяц`
                            : `Ежемесячная подписка ${monthlyPrice} ₽`}
                  </Typography>
                  {!isOwner && !cancellationConfirmed && !prodamusTest ? (
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
                  {cancellationNotice}
                  {!isOwner ? (
                    <Action
                      onClick={() => router.clubCheckout()}
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
              {!isSubscribed ? cancellationNotice : null}
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
                {logoutAction}
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
                  onClick={() => router.login("/profile")}
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
