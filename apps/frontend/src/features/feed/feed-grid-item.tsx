"use client";
import { useViewport } from "@/shared/browser/viewport";

import { getFeedScreenLayout } from "./feed-screen.layout";
import classes from "./feed-grid-item.module.scss";
import Link from "next/link";
import { Picture } from "@/shared/media/image";
import { MaterialIcons } from "@/shared/ui/icons";
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

  return (
    <Link
      href={href}
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
