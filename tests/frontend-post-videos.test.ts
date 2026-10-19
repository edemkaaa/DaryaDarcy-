import { expect, it } from "vitest";
import { resolvePostVideos } from "../apps/frontend/src/domain/post/resolve-post-video";

const first = {
  type: "video",
  url: "/api/media/post-attachments/11",
  filename: "one.webm",
  posterUrl: "/one.jpg",
};
const second = {
  type: "video",
  url: "/api/media/post-attachments/12",
  filename: "two.webm",
  posterUrl: "/two.jpg",
};
it("preserves all persisted videos in their media order with their own posters", () => {
  const photos = ["/gallery.jpg"];
  const media = [second, { type: "audio", url: "/audio" }, first];
  expect(resolvePostVideos(photos, media)).toEqual({
    videos: [
      { url: second.url, filename: "two.webm", posterUrl: "/two.jpg" },
      { url: first.url, filename: "one.webm", posterUrl: "/one.jpg" },
    ],
    stackPhotos: photos,
  });
  expect(media[0]).toBe(second);
  expect(photos).toEqual(["/gallery.jpg"]);
});
it("keeps a missing private poster empty and preserves every gallery photo", () => {
  expect(
    resolvePostVideos(
      ["/gallery.jpg"],
      [first, { ...second, posterUrl: null }],
    ),
  ).toMatchObject({
    videos: [{ posterUrl: "/one.jpg" }, { posterUrl: undefined }],
    stackPhotos: ["/gallery.jpg"],
  });
});
it("matches separate legacy thumbnails without consuming unrelated gallery photos", () => {
  const a = "https://media.test/one.mp4",
    b = "https://media.test/two.mp4";
  expect(
    resolvePostVideos(
      ["/gallery.jpg", "/two_thumb.jpg", "/one_thumb.jpg"],
      [
        { type: "video", url: b },
        { type: "video", url: a },
      ],
    ),
  ).toMatchObject({
    videos: [
      { url: b, posterUrl: "/two_thumb.jpg" },
      { url: a, posterUrl: "/one_thumb.jpg" },
    ],
    stackPhotos: ["/gallery.jpg"],
  });
});
it("does not invent a shared cover for multiple legacy videos", () => {
  expect(
    resolvePostVideos(
      ["/gallery.jpg"],
      [
        { type: "video", url: "https://media.test/one.mp4" },
        { type: "video", url: "https://media.test/two.mp4" },
      ],
    ),
  ).toMatchObject({
    videos: [{ posterUrl: undefined }, { posterUrl: undefined }],
    stackPhotos: ["/gallery.jpg"],
  });
});
it("finds all legacy photo-array videos without duplicating their media representation", () => {
  const a = "https://media.test/one.mp4",
    b = "https://media.test/two.webm?signature=kept";
  expect(
    resolvePostVideos([a, "/gallery.jpg", b], [{ type: "video", url: a }]),
  ).toMatchObject({
    videos: [{ url: a }, { url: b }],
    stackPhotos: ["/gallery.jpg"],
  });
});
it("does not silently drop distinct persisted media rows with the same URL", () => {
  expect(resolvePostVideos([], [first, first]).videos).toHaveLength(2);
});
it("retains a photo-only post unchanged", () => {
  expect(resolvePostVideos(["/one.jpg", "/two.jpg"], [])).toEqual({
    videos: [],
    stackPhotos: ["/one.jpg", "/two.jpg"],
  });
});
