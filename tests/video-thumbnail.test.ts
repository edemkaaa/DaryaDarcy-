/** Один публичный контракт обложек применяется при записи и чтении видеокаталога. */
import { describe, expect, it } from "vitest";
import { publicCatalogThumbnail } from "../apps/backend/src/content/video-thumbnail";
import { vkVideoInput } from "../apps/backend/src/content/vk-video-input";

const bucket = "https://s3.twcstorage.ru/daryadarcy-s3/";
const publicCover =
  "covers/public-v1/12345678-1234-4234-8234-123456789abc.webp";
const vkCover = `covers/vk-v1/${"a".repeat(64)}/${"b".repeat(64)}.webp`;
const input = {
  embedUrl: "https://vk.ru/video_ext.php?oid=-100&id=200",
  title: "Synthetic public cover",
  access: "public",
  published: false,
};

/** Ключи публичных namespace проверяются без загрузки изображений или изменения S3. */
describe("VK public cover contract", () => {
  /** Разрешённые public/VK и совместимые старые cover-пути сохраняются одинаково в обеих границах. */
  it.each([
    publicCover,
    vkCover,
    "covers/12345678-1234-4234-8234-123456789abc.webp",
    "feed/cover.webp",
    "app-assets/videos/cover.jpg",
  ])("accepts the public cover on write and read: %s", (key) => {
    const url = bucket + key;
    expect(
      vkVideoInput.parse({ ...input, thumbnailUrl: url }).thumbnailUrl,
    ).toBe(url);
    expect(publicCatalogThumbnail(url)).toBe(url);
  });
  /** Приватные префиксы, неверная форма UUID/hash, SVG, query/fragment и обход пути отвергаются. */
  it.each([
    "content/private-v1/cover.webp",
    "covers/private/cover.webp",
    "covers/public-v1/not-a-uuid.webp",
    publicCover.replace(".webp", ".svg"),
    "covers/vk-v1/cover.webp",
    vkCover.replace("a".repeat(64), "a".repeat(63)),
    `${publicCover}?signature=private`,
    `${publicCover}#fragment`,
    `feed/../${publicCover}`,
    publicCover.replace("public-v1/", "public-v1\\"),
    publicCover.replace("public-v1/", "public-v1/%2e%2e/"),
    publicCover.replace("public-v1/", "public-\nv1/"),
  ])("refuses private, malformed and ambiguous addresses: %s", (key) => {
    expect(publicCatalogThumbnail(bucket + key)).toBeNull();
    expect(
      vkVideoInput.safeParse({ ...input, thumbnailUrl: bucket + key }).success,
    ).toBe(false);
  });
  /** Совпадение public-префикса не разрешает произвольный внешний origin. */
  it("does not accept a public namespace on another origin", () => {
    expect(
      publicCatalogThumbnail(`https://outside.example.test/${publicCover}`),
    ).toBeNull();
  });
});
