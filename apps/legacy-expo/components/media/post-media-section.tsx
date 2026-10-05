import React from "react";
import { View } from "react-native";
import { AudioPlayerCard } from "./audio-player";
import { VideoPreviewCard } from "./video-preview";
import { DocumentAttachmentCard } from "./document-attachment";

export interface PostMediaItem {
  id: number;
  type: "video" | "audio" | "document";
  url: string;
  filename?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  duration?: number | null;
}

interface PostMediaSectionProps {
  media: PostMediaItem[];
  posterUrl?: string;
  topAligned?: boolean;
}

export function PostMediaSection({ media, posterUrl, topAligned }: PostMediaSectionProps) {
  if (!media || media.length === 0) return null;

  return (
    <View>
      {media.map((item) => {
        switch (item.type) {
          case "video":
            return (
              <VideoPreviewCard
                key={item.id}
                url={item.url}
                thumbnailUrl={posterUrl}
                filename={item.filename ?? undefined}
                duration={item.duration ?? undefined}
                topAligned={topAligned}
              />
            );
          case "audio":
            return (
              <AudioPlayerCard
                key={item.id}
                url={item.url}
                filename={item.filename ?? undefined}
                duration={item.duration ?? undefined}
              />
            );
          case "document":
            return (
              <DocumentAttachmentCard
                key={item.id}
                url={item.url}
                filename={item.filename ?? undefined}
                mimeType={item.mimeType ?? undefined}
                fileSize={item.fileSize ?? undefined}
              />
            );
          default:
            return null;
        }
      })}
    </View>
  );
}
