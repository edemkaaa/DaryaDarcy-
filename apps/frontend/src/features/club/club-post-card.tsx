"use client";
import classes from "./club-post-card.module.scss";
import { cssTransform } from "@/shared/ui/css";
import { Background, Action, Typography } from "@/shared/ui/elements";
import { Picture } from "@/shared/media/image";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "@/shared/browser/motion";
import { PostMenuButton } from "@/shared/ui/post-menu-button";
import { resolvePostVideos } from "@/domain/post/resolve-post-video";
import { PostMediaSection } from "@/shared/media/post-media-section";
import { NaturalPhotoStack } from "@/shared/media/natural-photo-stack";
import { RichTextRenderer } from "@/domain/content/rich-text-renderer";
import {
  clubTagLabel,
  isClubRubricTag,
  visibleClubTags,
} from "@/domain/post/club-tags";
import { ClubComments } from "@/features/club/club-comments";
import { useRouter } from "@/shared/navigation/router";
import {
  PAPER_TEXTURE_URI,
  STICKER_LIKE,
  STICKER_SAVE,
} from "./club-subscribed.content";
import type { ClubPost } from "./club-subscribed.content";
export function ClubPostCard({
  item,
  isSaved,
  likePending = false,
  savePending = false,
  isLiked,
  onSave,
  onLike,
  onMenuPress,
  onPhotoPress,
}: {
  item: ClubPost;
  isSaved: boolean;
  likePending?: boolean;
  savePending?: boolean;
  isLiked: boolean;
  onSave: () => void;
  onLike: () => void;
  onMenuPress?: () => void;
  onPhotoPress?: (photos: string[], index: number) => void;
}) {
  const router = useRouter();
  const likeScale = useSharedValue(1);
  const saveScale = useSharedValue(1);
  const postId = Number(item.id);
  const canOpen = Number.isFinite(postId) && postId > 0;
  const openPost = () => {
    if (!canOpen) return;
    router.push(`/post/${postId}`);
  };
  const likeAnimStyle = useAnimatedStyle(() => ({
    transform: cssTransform([{ scale: likeScale.value }]),
  }));
  const saveAnimStyle = useAnimatedStyle(() => ({
    transform: cssTransform([{ scale: saveScale.value }]),
  }));
  const handleLike = () => {
    likeScale.value = withTiming(
      1.3,
      { duration: 100, easing: Easing.out(Easing.ease) },
      () => {
        likeScale.value = withTiming(1, { duration: 150 });
      },
    );
    onLike();
  };
  const handleSave = () => {
    saveScale.value = withTiming(
      1.3,
      { duration: 100, easing: Easing.out(Easing.ease) },
      () => {
        saveScale.value = withTiming(1, { duration: 150 });
      },
    );
    onSave();
  };
  const resolved = resolvePostVideos(item.photos, item.media);
  const stackPhotos = resolved.stackPhotos;
  const hasVideo = resolved.videos.length > 0;
  const showPhotoStack = stackPhotos.length > 0 || hasVideo;
  const otherMedia = item.media?.filter((m) => m.type !== "video") || [];
  return (
    <div className={["ui-stack ", classes.postCard].filter(Boolean).join(" ")}>
      <Background
        source={{ uri: PAPER_TEXTURE_URI }}
        fit="cover"
        className={classes.postCardInner}
        imageClassName={classes.backgroundimage}
      >
        {showPhotoStack ? (
          <div
            className={["ui-stack ", classes.postPhotoWrap]
              .filter(Boolean)
              .join(" ")}
          >
            <NaturalPhotoStack
              photos={stackPhotos}
              videos={resolved.videos}
              onPhotoPress={
                onPhotoPress
                  ? (index) => onPhotoPress(stackPhotos, index)
                  : undefined
              }
            />
            {onMenuPress ? (
              <div
                className={["ui-stack ", classes.photoMenu]
                  .filter(Boolean)
                  .join(" ")}
              >
                <PostMenuButton onClick={onMenuPress} />
              </div>
            ) : null}
          </div>
        ) : null}
        <div
          className={["ui-stack ", classes.postContent]
            .filter(Boolean)
            .join(" ")}
        >
          {!showPhotoStack && onMenuPress ? (
            <div
              className={["ui-stack ", classes.menuOnlyRow]
                .filter(Boolean)
                .join(" ")}
            >
              <PostMenuButton onClick={onMenuPress} />
            </div>
          ) : null}
          <div className="ui-stack">
            <RichTextRenderer
              richText={item.richText}
              plainText={item.preview}
              selectable={false}
              textClassName={classes.postPreview}
            />
          </div>
          {item.articleId || canOpen ? (
            <Action
              onClick={
                item.articleId
                  ? () => router.push(`/library/article/${item.articleId}`)
                  : openPost
              }
              aria-label={item.articleId ? undefined : "Открыть публикацию"}
              className={classes.readArticleBtn}
            >
              <Typography className={classes.readArticleText}>
                читать →
              </Typography>
            </Action>
          ) : null}
          {otherMedia.length > 0 ? (
            <PostMediaSection media={otherMedia} posterUrl={item.photos?.[0]} />
          ) : null}
          {!Number.isNaN(Number(item.id)) ? (
            <ClubComments
              postId={Number(item.id)}
              tags={item.tags}
              createdAt={item.createdAt || null}
              commentCount={item.commentCount}
            />
          ) : null}
          {visibleClubTags(item.tags).length > 0 ? (
            <div
              className={["ui-stack ", classes.postTagsRow]
                .filter(Boolean)
                .join(" ")}
            >
              {visibleClubTags(item.tags).map((tag, i) => {
                const rubric = isClubRubricTag(tag);
                return (
                  <div
                    key={i}
                    className={[
                      [
                        `ui-stack club-post-tag ${rubric ? "club-post-tag-rubric" : ""}`,
                        classes.postTagRubric,
                      ]
                        .filter(Boolean)
                        .join(" "),
                      rubric
                        ? classes.backgroundColorState
                        : classes.backgroundColorState2,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <Typography
                      className={[
                        classes.postTagRubricText,
                        rubric ? classes.colorState : classes.colorState2,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {clubTagLabel(tag)}
                    </Typography>
                  </div>
                );
              })}
            </div>
          ) : null}
          <div
            className={["ui-stack ", classes.postActions]
              .filter(Boolean)
              .join(" ")}
          >
            <Typography className={classes.postDate}>{item.date}</Typography>
            <div
              className={["ui-stack ", classes.div].filter(Boolean).join(" ")}
            />
            <Action
              onClick={handleLike}
              aria-label="Нравится"
              aria-pressed={isLiked}
              disabled={likePending}
              className={({ pressed }) =>
                [classes.action, pressed ? classes.opacityState2 : ""]
                  .filter(Boolean)
                  .join(" ")
              }
            >
              <Animated.div style={likeAnimStyle}>
                <Picture
                  source={{ uri: STICKER_LIKE }}
                  contentFit="contain"
                  className={[
                    classes.picture,
                    isLiked ? classes.opacityState3 : classes.opacityState4,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
              </Animated.div>
            </Action>
            <Action
              onClick={handleSave}
              aria-label="Сохранить пост"
              aria-pressed={isSaved}
              disabled={savePending}
              className={({ pressed }) =>
                [classes.action, pressed ? classes.opacityState5 : ""]
                  .filter(Boolean)
                  .join(" ")
              }
            >
              <Animated.div style={saveAnimStyle}>
                <Picture
                  source={{ uri: STICKER_SAVE }}
                  contentFit="contain"
                  className={[
                    classes.picture,
                    isSaved ? classes.opacityState6 : classes.opacityState7,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
              </Animated.div>
            </Action>
          </div>
        </div>
      </Background>
    </div>
  );
}
