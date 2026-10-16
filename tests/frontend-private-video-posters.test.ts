import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { resolvePostVideo } from "../apps/frontend/src/domain/post/resolve-post-video";
import { PostMediaSection } from "../apps/frontend/src/shared/media/post-media-section";
import { PostCard } from "../apps/frontend/src/features/feed/post-card";
import type { FeedPost } from "../apps/frontend/src/features/feed/feed-screen.content";

const gallery = [
  "/api/media/content/11111111-1111-4111-a111-111111111111",
  "https://images.example.test/other.jpg",
];
const poster = "/api/media/content/22222222-2222-4222-a222-222222222222";
const privateVideo = {
  id: 42,
  type: "video" as const,
  url: "/api/media/post-attachments/42",
  filename: "lesson.mp4",
};
it("uses an explicit private video poster without removing a gallery photo", () => {
  const photos = [...gallery];
  expect(
    resolvePostVideo(photos, [{ ...privateVideo, posterUrl: poster }]),
  ).toMatchObject({
    hasVideo: true,
    videoUrl: privateVideo.url,
    posterUrl: poster,
    stackPhotos: gallery,
  });
  expect(photos).toEqual(gallery);
});
it.each([null, undefined])(
  "does not guess a private video cover from the first gallery photo: %s",
  (posterUrl) => {
    expect(
      resolvePostVideo(gallery, [{ ...privateVideo, posterUrl }]),
    ).toMatchObject({ posterUrl: undefined, stackPhotos: gallery });
  },
);
it("retains the legacy public thumb and first-photo fallback", () => {
  const video = {
    ...privateVideo,
    url: "https://files.example.test/lesson.mp4",
    posterUrl: null,
  };
  const thumb = "https://images.example.test/lesson_thumb.jpg";
  expect(resolvePostVideo([...gallery, thumb], [video])).toMatchObject({
    posterUrl: thumb,
    stackPhotos: gallery,
  });
  expect(resolvePostVideo(gallery, [video])).toMatchObject({
    posterUrl: gallery[0],
    stackPhotos: gallery.slice(1),
  });
  expect(resolvePostVideo(gallery, [])).toEqual({
    hasVideo: false,
    stackPhotos: gallery,
  });
});
it("uses each video's own poster in the existing media player", () => {
  const secondPoster = "https://images.example.test/second.jpg";
  const markup = renderToStaticMarkup(
    createElement(PostMediaSection, {
      media: [
        { ...privateVideo, posterUrl: poster },
        {
          ...privateVideo,
          id: 43,
          url: "/api/media/post-attachments/43",
          posterUrl: secondPoster,
        },
      ],
      posterUrl: "https://images.example.test/wrong-fallback.jpg",
    }),
  );
  expect(markup).toContain(`poster="${poster}"`);
  expect(markup).toContain(`poster="${secondPoster}"`);
  expect(markup).not.toContain("wrong-fallback");
});
it("does not share another video's poster with a private video lacking one", () => {
  const markup = renderToStaticMarkup(
    createElement(PostMediaSection, {
      media: [privateVideo],
      posterUrl: "https://images.example.test/wrong-fallback.jpg",
    }),
  );
  expect(markup).toContain(`src="${privateVideo.url}"`);
  expect(markup).not.toContain("poster=");
});
it("keeps the old media-section poster fallback for a legacy video", () => {
  const markup = renderToStaticMarkup(
    createElement(PostMediaSection, {
      media: [
        { ...privateVideo, url: "https://files.example.test/legacy.mp4" },
      ],
      posterUrl: gallery[0],
    }),
  );
  expect(markup).toContain(`poster="${gallery[0]}"`);
});
it.each([poster, null])(
  "feed cards keep the whole private-video gallery and explicit poster: %s",
  (posterUrl) => {
    const post: FeedPost = {
      id: 1,
      text: "Video",
      date: "16 октября",
      photos: gallery,
      tags: [],
      likeCount: 0,
      media: [{ ...privateVideo, posterUrl }],
    };
    const markup = renderToStaticMarkup(
      createElement(PostCard, {
        post,
        isLiked: false,
        isSaved: false,
        onLike() {},
        onSave() {},
        onClick() {},
      }),
    );
    for (const photo of gallery) expect(markup).toContain(`src="${photo}"`);
    expect(markup.match(/aria-label="Открыть фото"/g)).toHaveLength(2);
    if (posterUrl) expect(markup).toContain(`src="${posterUrl}"`);
  },
);
