"use client";
/** Карточка ленты отделяет переход в публикацию, просмотр медиа и действия лайка или сохранения. */
import classes from "./post-card.module.scss";
import { cssTransform } from "@/shared/ui/css";
import { Action, Typography } from "@/shared/ui/elements";
import { useState } from "react";
import { useCollectionItemRetention } from "@/shared/ui/collection-item-window";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "@/shared/browser/motion";
import { MaterialIcons } from "@/shared/ui/icons";
import { resolvePostVideos } from "@/domain/post/resolve-post-video";
import { PostMenuButton } from "@/shared/ui/post-menu-button";
import { PostMediaSection } from "@/shared/media/post-media-section";
import { NaturalPhotoStack } from "@/shared/media/natural-photo-stack";
import { postTagLabel } from "@/domain/post/post-tags";
import { RichTextRenderer } from "@/domain/content/rich-text-renderer";
import {
  MAX_TEXT_LINES,
  BROWN_LIGHT,
  GREEN_ACCENT,
} from "./feed-screen.content";
import type { FeedPost } from "./feed-screen.content";
export function PostCard({
  post,
  isLiked,
  isSaved,
  likePending = false,
  savePending = false,
  onLike,
  onSave,
  onClick,
  onPhotoPress,
  onMenuPress,
}: {
  post: FeedPost;
  isLiked: boolean;
  isSaved: boolean;
  likePending?: boolean;
  savePending?: boolean;
  onLike: (postId: number) => void;
  onSave: (postId: number) => void;
  onClick: (postId: number) => void;
  onPhotoPress?: (photos: string[], index: number) => void;
  onMenuPress?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  useCollectionItemRetention(expanded);
  const saveScale = useSharedValue(1);
  const likeScale = useSharedValue(1);
  const saveAnimStyle = useAnimatedStyle(() => ({
    transform: cssTransform([{ scale: saveScale.value }]),
  }));
  const likeAnimStyle = useAnimatedStyle(() => ({
    transform: cssTransform([{ scale: likeScale.value }]),
  }));
  const needsExpand =
    post.text.length > 0 &&
    (post.text.split("\n").length > MAX_TEXT_LINES || post.text.length > 150);
  const handleLike = () => {
    likeScale.value = withTiming(
      1.3,
      { duration: 100, easing: Easing.out(Easing.ease) },
      () => {
        likeScale.value = withTiming(1, { duration: 150 });
      },
    );
    onLike(post.id);
  };
  const handleSave = () => {
    saveScale.value = withTiming(
      1.3,
      { duration: 100, easing: Easing.out(Easing.ease) },
      () => {
        saveScale.value = withTiming(1, { duration: 150 });
      },
    );
    onSave(post.id);
  };
  const tagLabels = (post.tags || [])
    .map((slug) => postTagLabel(slug))
    .filter(Boolean);
  const { videos, stackPhotos } = resolvePostVideos(post.photos, post.media);
  const hasVideo = videos.length > 0;
  const otherMedia = (post.media || []).filter((item) => item.type !== "video");
  return (
    <article
      onClick={() => onClick(post.id)}
      className={["ui-stack ui-clickable-card", classes.postCard]
        .filter(Boolean)
        .join(" ")}
      tabIndex={0}
      aria-label="Открыть публикацию"
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === event.currentTarget) {
          event.preventDefault();
          event.currentTarget.click();
        }
      }}
    >
      {hasVideo || (stackPhotos && stackPhotos.length > 0) ? (
        <NaturalPhotoStack
          photos={stackPhotos || []}
          videos={videos}
          onPhotoPress={
            onPhotoPress
              ? (index) => onPhotoPress(stackPhotos || [], index)
              : undefined
          }
        />
      ) : null}
      <div
        className={["ui-stack ", classes.postContent].filter(Boolean).join(" ")}
      >
        {expanded ? (
          <RichTextRenderer
            richText={post.richText}
            plainText={post.text}
            textClassName={classes.postText}
          />
        ) : (
          <RichTextRenderer
            richText={post.richText}
            plainText={post.text}
            lines={MAX_TEXT_LINES}
            textClassName={classes.postText}
          />
        )}
        {post.articleId ? (
          <Action
            onClick={() => onClick(post.id)}
            className={classes.expandButton}
          >
            <Typography className={classes.expandButtonText}>
              читать →
            </Typography>
          </Action>
        ) : needsExpand && !expanded ? (
          <Action
            onClick={() => setExpanded(true)}
            className={classes.expandButton}
          >
            <Typography className={classes.expandButtonText}>
              Читать дальше →
            </Typography>
          </Action>
        ) : null}
        {expanded && !post.articleId && (
          <Action
            onClick={() => setExpanded(false)}
            className={classes.expandButton}
          >
            <Typography className={classes.expandButtonText}>
              свернуть
            </Typography>
          </Action>
        )}

        {otherMedia.length > 0 ? (
          <PostMediaSection media={otherMedia} posterUrl={post.photos?.[0]} />
        ) : null}

        <div
          className={["ui-stack ", classes.postTagsRow]
            .filter(Boolean)
            .join(" ")}
        >
          {tagLabels.map((label, i) => (
            <div
              key={i}
              className={["ui-stack ", classes.postTag]
                .filter(Boolean)
                .join(" ")}
            >
              <Typography className={classes.postTagText}>#{label}</Typography>
            </div>
          ))}
        </div>

        <div
          className={["ui-stack ", classes.postFooter]
            .filter(Boolean)
            .join(" ")}
        >
          <Typography className={classes.postDate}>{post.date}</Typography>
          <div
            className={["ui-stack ", classes.postActions]
              .filter(Boolean)
              .join(" ")}
          >
            <Action
              onClick={handleLike}
              aria-label="Нравится"
              aria-pressed={isLiked}
              disabled={likePending}
              className={classes.actionButton}
            >
              <Animated.div style={likeAnimStyle}>
                <MaterialIcons
                  name={isLiked ? "favorite" : "favorite-border"}
                  size={20}
                  color={isLiked ? "#A85C5C" : BROWN_LIGHT}
                />
              </Animated.div>
              <Typography
                className={[
                  classes.typography,
                  isLiked ? classes.colorState : classes.colorState2,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {Math.max(0, post.likeCount)}
              </Typography>
            </Action>
            <Action
              onClick={handleSave}
              aria-label="Сохранить пост"
              aria-pressed={isSaved}
              disabled={savePending}
              className={classes.actionButton}
            >
              <Animated.div style={saveAnimStyle}>
                <MaterialIcons
                  name={isSaved ? "work" : "work-outline"}
                  size={19}
                  color={isSaved ? GREEN_ACCENT : BROWN_LIGHT}
                />
              </Animated.div>
            </Action>
            {onMenuPress && <PostMenuButton onClick={onMenuPress} />}
          </div>
        </div>
      </div>
    </article>
  );
}
