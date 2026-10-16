"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/domain/session/session-context";
import type { ScopedOperation } from "@/shared/browser/operation-scope";
import { isPersonalDataOwner } from "@/shared/browser/storage";
import {
  privatePostVideoReference,
  selectPrivatePostVideos,
  validatePrivatePostVideo,
  type PrivatePostVideo,
} from "@/domain/post/private-video-upload";
import { extractVideoPosterBlob } from "@/shared/media/video-poster";

export async function preparePrivatePostVideo(
  file: File,
  operation: ScopedOperation,
  withPoster = false,
): Promise<PrivatePostVideo> {
  operation.assertCurrent();
  const video: PrivatePostVideo = { key: crypto.randomUUID(), file };
  validatePrivatePostVideo(video);
  if (withPoster) {
    let poster: Blob | null = null;
    try {
      poster = await extractVideoPosterBlob(file, operation.signal);
    } catch {
      // A codec/cover error must not lose the original selected video.
      operation.assertCurrent();
    }
    operation.assertCurrent();
    if (poster) {
      video.poster = {
        key: crypto.randomUUID(),
        file: new File([poster], "video-poster.jpg", {
          type: poster.type || "image/jpeg",
        }),
      };
      validatePrivatePostVideo(video);
    }
  }
  return video;
}

const empty: PrivatePostVideo[] = [];
type VideoScope = {
  ownerId: number | undefined;
  active: boolean;
  slot: string | number;
  alive: boolean;
  posters: Map<string, string>;
};

/** Only optional preview URLs are temporary. Original File/key pairs go to the journal. */
export function usePrivatePostVideos(active: boolean, slot: string | number) {
  const { user } = useAuth();
  const ownerId = user?.id;
  const resources = useMemo<VideoScope>(
    () => ({ ownerId, active, slot, alive: true, posters: new Map() }),
    [ownerId, active, slot],
  );
  const [selection, setSelection] = useState<{
    resources: VideoScope;
    videos: PrivatePostVideo[];
  } | null>(null);
  const release = useCallback(() => {
    for (const url of resources.posters.values()) URL.revokeObjectURL(url);
    resources.posters.clear();
  }, [resources]);
  useEffect(() => {
    resources.alive = true;
    return () => {
      resources.alive = false;
      release();
    };
  }, [resources, release]);
  const reset = useCallback(() => {
    release();
    setSelection(null);
  }, [release]);
  const assertOwner = () => {
    if (
      !active ||
      !resources.alive ||
      !ownerId ||
      !isPersonalDataOwner(ownerId)
    )
      throw new DOMException("Операция отменена", "AbortError");
  };
  const addPreview = (video: PrivatePostVideo) => {
    if (video.poster)
      resources.posters.set(
        privatePostVideoReference(video),
        URL.createObjectURL(video.poster.file),
      );
  };
  return {
    videos:
      active && selection?.resources === resources ? selection.videos : empty,
    poster: (reference: string) => resources.posters.get(reference),
    add: async (file: File, operation: ScopedOperation, withPoster = false) => {
      assertOwner();
      const video = await preparePrivatePostVideo(file, operation, withPoster);
      operation.assertCurrent();
      assertOwner();
      addPreview(video);
      setSelection((previous) => ({
        resources,
        videos: [
          ...(previous?.resources === resources ? previous.videos : []),
          video,
        ],
      }));
      return privatePostVideoReference(video);
    },
    remove: (reference: string) => {
      assertOwner();
      const url = resources.posters.get(reference);
      if (url) URL.revokeObjectURL(url);
      resources.posters.delete(reference);
      // Keep File/receipt aliases until the next save selects current references.
      // A recovered idle coordinator may still refer to a now-unselected video.
    },
    restore: (videos: PrivatePostVideo[], references: string[]) => {
      assertOwner();
      const selected = selectPrivatePostVideos(references, videos);
      release();
      for (const video of selected) addPreview(video);
      setSelection({ resources, videos });
    },
    reset,
  };
}
