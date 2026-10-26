"use client";
import { useViewport } from "@/shared/browser/viewport";

import { getFeedScreenLayout } from "./feed-screen.layout";
import classes from "./feed-grid-item.module.scss";
import Link from "next/link";
import { Picture } from "@/shared/media/image";
import { imageSlotSizes } from "@/shared/media/image-sizes";
import { MaterialIcons } from "@/shared/ui/icons";
import { sanitizePlainPostText } from "@/domain/content/post-text-sanitize";
import { truncateSelectionPreview } from "@shared/rich-text-edit";
import type { FeedPost } from "./feed-screen.content";
export function GridItem({
  item,
  isVideo,
  href,
}: {
  item: FeedPost;
  isVideo: boolean;
  href: string;
}) {
  const viewport = useViewport();
  const { stylesLayout } = getFeedScreenLayout(viewport);
  const preview = truncateSelectionPreview(
    sanitizePlainPostText(item.text) ||
      sanitizePlainPostText(
        item.richText
          ?.map((block) => block.children.map((inline) => inline.text).join(""))
          .join("\n") ?? "",
      ),
  );
  const action = item.articleId ? "Открыть статью" : "Открыть публикацию";
  const label = preview
    ? `${action}: ${preview}`
    : item.date
      ? `${action} от ${item.date}`
      : action;

  return (
    <Link
      href={href}
      prefetch={false}
      aria-label={label}
      style={{
        width: stylesLayout.gridItem.width,
        height: stylesLayout.gridItem.height,
      }}
      className={`ui-action ui-navigation-card ${classes.gridItem}`}
    >
      <div className={`ui-stack ${classes.div}`}>
        {item.photos?.[0] ? (
          <Picture
            source={{ uri: item.photos[0] }}
            sizes={imageSlotSizes(3)}
            contentFit="cover"
            transition={200}
            className={classes.gridImage}
          />
        ) : (
          <div
            className={["ui-stack ", classes.div2].filter(Boolean).join(" ")}
          />
        )}
        {isVideo && (
          <div
            className={["ui-stack ", classes.gridPlayIcon]
              .filter(Boolean)
              .join(" ")}
          >
            <MaterialIcons
              name="play-circle-filled"
              size={20}
              color="rgba(255,255,255,0.9)"
            />
          </div>
        )}
        {(item.photos?.length ?? 0) > 1 && !isVideo && (
          <div
            className={["ui-stack ", classes.gridPlayIcon]
              .filter(Boolean)
              .join(" ")}
          >
            <MaterialIcons
              name="collections"
              size={18}
              color="rgba(255,255,255,0.9)"
            />
          </div>
        )}
      </div>
    </Link>
  );
}
