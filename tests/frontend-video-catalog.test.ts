/** Проверяем клиентский контракт каталога, безопасные обложки и playback lifecycle на чистых данных и EventTarget без настоящего VK-плеера. */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getVkCatalogEmbedUrl,
  isVkCatalogEnabled,
  nextVideoCursor,
  parseVideoCatalog,
  parseVideoPlayback,
  requireVkVideoId,
  stalledVideoCursor,
  videoThumbnailUrl,
  isVideoThumbnailsEnabled,
  videoCatalogInput,
  normalizeVkThumbnailUrl,
} from "../apps/frontend/src/features/videos/catalog-api";
import { PlaybackLifecycle } from "../apps/frontend/src/features/videos/playback-lifecycle";
import { publicCatalogThumbnail } from "../apps/backend/src/content/video-thumbnail";

const embed = "https://vkvideo.ru/video_ext.php?oid=-1&id=2&hash=abcdefgh";
const card = {
  id: 2,
  title: "Видео",
  duration: null,
  access: "club",
  canWatch: false,
};
/** Снимаем публичные build flags и браузерные globals, подменённые отдельным сценарием. */
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
/** Каталог содержит только карточки; playback URL и право воспроизведения проверяются отдельно. */
describe("catalog contracts", () => {
  /** Только строка true включает includeThumbnails на каждой странице, сохраняя старый вход при выключенном флаге. */
  it("keeps thumbnail opt-in out of old requests and includes it on every enabled page", () => {
    for (const value of ["", "false", "1", "TRUE"]) {
      vi.stubEnv("NEXT_PUBLIC_VIDEO_THUMBNAILS_ENABLED", value);
      expect(isVideoThumbnailsEnabled()).toBe(false);
      expect(videoCatalogInput(20)).toEqual({ limit: 20 });
      expect(videoCatalogInput(20, 42)).toEqual({ limit: 20, cursor: 42 });
    }
    vi.stubEnv("NEXT_PUBLIC_VIDEO_THUMBNAILS_ENABLED", "true");
    expect(videoCatalogInput(20)).toEqual({
      limit: 20,
      includeThumbnails: true,
    });
    expect(videoCatalogInput(20, 42)).toEqual({
      limit: 20,
      includeThumbnails: true,
      cursor: 42,
    });
    expect(videoCatalogInput(20)).not.toEqual({ limit: 20 });
  });
  /** Разрешены конкретные публичные asset/S3-префиксы с удалением внешних пробелов. */
  it.each([
    "/assets/responsive/cover.webp",
    "/assets/responsive/COVER.AVIF",
    "/assets/responsive/cover.png",
    "/assets/responsive/cover.jpeg",
    "https://s3.twcstorage.ru/daryadarcy-s3/feed/cover.jpg",
    "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/videos/cover.png",
    "https://s3.twcstorage.ru/daryadarcy-s3/covers/public-v1/12345678-1234-4234-8234-123456789abc.webp",
    "https://s3.twcstorage.ru/daryadarcy-s3/covers/12345678-1234-4234-8234-123456789abc.webp",
    `https://s3.twcstorage.ru/daryadarcy-s3/covers/vk-v1/${"a".repeat(64)}/${"b".repeat(64)}.webp`,
  ])("accepts documented public cover location %s", (value) => {
    expect(normalizeVkThumbnailUrl(`  ${value}  `)).toBe(value);
    expect(normalizeVkThumbnailUrl(value)).toBe(publicCatalogThumbnail(value));
  });
  /** Адрес приватного файла, активная схема, traversal, подпись, credentials или произвольный CDN не принимаются как публичная обложка. */
  it.each([
    "",
    " ",
    "javascript:alert(1)",
    "data:image/png;base64,abc",
    "/api/media/content-files/1",
    "/assets/responsive/",
    "/assets/responsive/cover.svg",
    "/assets/responsive/cover.html",
    "/assets/responsive/cover.mp4",
    "/assets/responsive/cover",
    "/assets/responsive/nested/cover.webp",
    `/assets/responsive/${"a".repeat(2048)}.webp`,
    "/assets/responsive/../private.jpg",
    "/assets/responsive/%2e%2e/private.jpg",
    "/assets/responsive/a.webp?signature=secret",
    "https://vk.ru/video_ext.php?oid=-1&id=2&hash=abcdefgh",
    "https://cdn.example.test/cover.jpg",
    "http://s3.twcstorage.ru/daryadarcy-s3/feed/cover.jpg",
    "https://s3.twcstorage.ru/daryadarcy-s3/private/cover.jpg",
    "https://s3.twcstorage.ru/daryadarcy-s3/feed/cover.jpg?X-Amz-Signature=secret",
    "https://s3.twcstorage.ru/daryadarcy-s3/feed/cover.jpg#private",
    "https://s3.twcstorage.ru/daryadarcy-s3/feed/cover.svg",
    "https://s3.twcstorage.ru/daryadarcy-s3/feed/cover.mp4",
    "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/cover.html",
    "https://s3.twcstorage.ru/daryadarcy-s3/feed/cover",
    "https://user:password@s3.twcstorage.ru/daryadarcy-s3/feed/cover.jpg",
    "//s3.twcstorage.ru/daryadarcy-s3/covers/public-v1/12345678-1234-4234-8234-123456789abc.webp",
    "https://s3.twcstorage.ru:8443/daryadarcy-s3/covers/public-v1/12345678-1234-4234-8234-123456789abc.webp",
    "https://cdn.example.test/daryadarcy-s3/covers/public-v1/12345678-1234-4234-8234-123456789abc.webp",
    "https://s3.twcstorage.ru/daryadarcy-s3/content/private-v1/12345678-1234-4234-8234-123456789abc.webp",
    "https://s3.twcstorage.ru/daryadarcy-s3/covers/private/12345678-1234-4234-8234-123456789abc.webp",
    "https://s3.twcstorage.ru/daryadarcy-s3/covers/public-v1/not-a-uuid.webp",
    "https://s3.twcstorage.ru/daryadarcy-s3/covers/public-v1/12345678-1234-1234-8234-123456789abc.webp",
    "https://s3.twcstorage.ru/daryadarcy-s3/covers/public-v1/12345678-1234-4234-7234-123456789abc.webp",
    "https://s3.twcstorage.ru/daryadarcy-s3/covers/public-v1/12345678-1234-4234-8234-123456789abc.svg",
    "https://s3.twcstorage.ru/daryadarcy-s3/covers/vk-v1/cover.webp",
    `https://s3.twcstorage.ru/daryadarcy-s3/covers/vk-v1/${"a".repeat(63)}/${"b".repeat(64)}.webp`,
    `https://s3.twcstorage.ru/daryadarcy-s3/covers/vk-v1/${"g".repeat(64)}/${"b".repeat(64)}.webp`,
    "https://s3.twcstorage.ru/daryadarcy-s3/covers/public-v1/../12345678-1234-4234-8234-123456789abc.webp",
    "https://s3.twcstorage.ru/daryadarcy-s3/covers/public-v1/%31%32.webp",
    "https://s3.twcstorage.ru/daryadarcy-s3/covers/pub\nlic-v1/12345678-1234-4234-8234-123456789abc.webp",
    "https://s3.twcstorage.ru/daryadarcy-s3/covers/public-v1\\12345678-1234-4234-8234-123456789abc.webp",
    "https://s3.twcstorage.ru/daryadarcy-s3/covers/public-v1/12345678-1234-4234-8234-123456789abc.webp?signature=private",
    "https://s3.twcstorage.ru/daryadarcy-s3/covers/public-v1/12345678-1234-4234-8234-123456789abc.webp#private",
  ])("rejects private or ambiguous cover input %s", (value) => {
    expect(normalizeVkThumbnailUrl(value)).toBeNull();
    expect(normalizeVkThumbnailUrl(value)).toBe(publicCatalogThumbnail(value));
  });
  /** Универсальный reader обложки не открывает закрытые API, iframe и активные схемы как изображение. */
  it.each([
    "javascript:alert(1)",
    "data:image/png;base64,abc",
    "mailto:a@example.test",
    "/api/media/post-attachments/1",
    "https://app.example.test/api/media/content-files/id",
    embed,
    "https://www.youtube.com/embed/abc_DEF-123",
  ])("does not load private media or a player as a thumbnail: %s", (value) => {
    expect(videoThumbnailUrl(value)).toBeNull();
  });
  /** Функция использует только переданный безопасный адрес и не угадывает источник по видео. */
  it("uses only the supplied public thumbnail URL", () => {
    expect(videoThumbnailUrl("/media/yt-thumb/abc_DEF-123/hqdefault.jpg")).toBe(
      "/media/yt-thumb/abc_DEF-123/hqdefault.jpg",
    );
    expect(videoThumbnailUrl("https://images.example.test/cover.webp")).toBe(
      "https://images.example.test/cover.webp",
    );
    expect(videoThumbnailUrl(undefined)).toBeNull();
    expect(videoThumbnailUrl(null)).toBeNull();
  });
  /** VK-каталог включается только явной строкой true, без приведения других truthy значений. */
  it("keeps the integration off unless explicitly enabled", () => {
    for (const value of ["", "false", "1", "TRUE"]) {
      vi.stubEnv("NEXT_PUBLIC_VK_CATALOG_ENABLED", value);
      expect(isVkCatalogEnabled()).toBe(false);
    }
    vi.stubEnv("NEXT_PUBLIC_VK_CATALOG_ENABLED", "true");
    expect(isVkCatalogEnabled()).toBe(true);
  });
  /** Карточка закрытого видео остаётся безопасной метаинформацией без iframe/provider. */
  it("accepts a card without exposing an embed or provider", () => {
    expect(parseVideoCatalog({ items: [card], nextCursor: 2 })).toEqual({
      items: [card],
      nextCursor: 2,
    });
  });
  /** Необязательная обложка не разрешает расширить ответ карточки чувствительным embedUrl. */
  it.each([null, "https://images.example.test/public-cover.webp"])(
    "accepts the optional public thumbnail field without relaxing other fields: %s",
    (thumbnailUrl) => {
      const item = { ...card, thumbnailUrl };
      expect(
        parseVideoCatalog({ items: [item], nextCursor: null }).items,
      ).toEqual([item]);
      expect(() =>
        parseVideoCatalog({
          items: [{ ...item, embedUrl: embed }],
          nextCursor: null,
        }),
      ).toThrow();
    },
  );
  /** Проверяются типы, access enum, размер страницы и целый положительный курсор, а лишний embed запрещён. */
  it.each([
    { items: [{ ...card, embedUrl: embed }], nextCursor: null },
    { items: [{ ...card, canWatch: "true" }], nextCursor: null },
    { items: [{ ...card, access: "private" }], nextCursor: null },
    { items: [card], nextCursor: 0 },
    { items: [card], nextCursor: 2.5 },
    { items: Array(101).fill(card), nextCursor: null },
  ])("rejects damaged or overexposed catalog responses", (data) =>
    expect(() => parseVideoCatalog(data)).toThrow(),
  );
  /** Повтор или движение курсора назад останавливают пагинацию; новый курсор клиент сам не вычисляет. */
  it("stops repeated and descending cursors without inventing a cursor", () => {
    const page = { items: [], nextCursor: 2 };
    expect(nextVideoCursor(page, [undefined])).toBe(2);
    expect(nextVideoCursor(page, [undefined, 2])).toBeUndefined();
    expect(nextVideoCursor(page, [undefined, 3])).toBeUndefined();
    expect(stalledVideoCursor(page, [undefined, 2])).toBe(true);
    expect(
      stalledVideoCursor({ items: [], nextCursor: null }, [undefined]),
    ).toBe(false);
  });
  /** Разрешённые VK-хосты сохраняются, параметры нормализуются и autoplay принудительно выключается. */
  it.each(["vk.com", "vk.ru", "vkvideo.ru"])(
    "canonicalizes exported %s URLs",
    (host) => {
      const url = embed.replace("vkvideo.ru", host);
      expect(getVkCatalogEmbedUrl(url + "&hd=3&autoplay=1")).toBe(
        url + "&hd=3&autoplay=0",
      );
    },
  );
  /** Повторяющиеся или неизвестные параметры, неверные hd/autoplay и fragment делают embed недопустимым. */
  it.each([
    "&foreign=1",
    "&hd=4",
    "&hd=1&hd=2",
    "&autoplay=2",
    "&autoplay=0&autoplay=1",
    "&id=3",
    "#private",
  ])("rejects catalog-only invalid parameters %s", (suffix) =>
    expect(getVkCatalogEmbedUrl(embed + suffix)).toBeNull(),
  );
  /** Playback должен соответствовать запрошенному ID; совместимый YouTube-ответ не смешивается с VK. */
  it("uses the requested identity and validated provider", () => {
    expect(
      parseVideoPlayback({ id: 2, provider: "vk", embedUrl: embed }, 2),
    ).toEqual({ id: 2, provider: "vk", embedUrl: embed + "&autoplay=0" });
    expect(
      parseVideoPlayback(
        {
          id: 2,
          provider: "youtube",
          youtubeId: "abc_DEF-123",
          videoUrl: null,
        },
        2,
      ).provider,
    ).toBe("youtube");
    expect(
      parseVideoPlayback(
        {
          id: 2,
          provider: "youtube",
          youtubeId: "abc_DEF-123",
          videoUrl: "/media/test.mp4",
        },
        2,
      ).provider,
    ).toBe("youtube");
  });
  /** Подмена ID/provider, небезопасный media URL и несовместимые поля отклоняются до плеера. */
  it.each([
    { id: 3, provider: "vk", embedUrl: embed },
    { id: 2, provider: "vk", embedUrl: embed + "&unknown=1" },
    { id: 2, provider: "youtube", youtubeId: "invalid", videoUrl: null },
    {
      id: 2,
      provider: "youtube",
      youtubeId: "abc_DEF-123",
      videoUrl: "javascript:alert(1)",
    },
    { id: 2, provider: "youtube", youtubeId: "abc_DEF-123", videoUrl: embed },
    { id: 2, provider: "vk", embedUrl: embed, youtubeId: "abc_DEF-123" },
  ])("rejects mismatched or unsafe playback", (data) =>
    expect(() => parseVideoPlayback(data, 2)).toThrow(),
  );
  /** Ответ создания обязан быть объектом с безопасным числовым ID, а не неявно приведённым скаляром. */
  it("does not accept a bare or invalid admin ID", () => {
    expect(requireVkVideoId({ id: 42 })).toBe(42);
    for (const value of [
      42,
      { id: 0 },
      { id: "42" },
      { id: Number.MAX_SAFE_INTEGER + 1 },
    ])
      expect(() => requireVkVideoId(value)).toThrow();
  });
  /** Уход страницы отзывает playback epoch; возврат, видимость и online требуют новой эпохи, unsubscribe снимает listener. */
  it("removes authority on pagehide and needs a new epoch on resume", () => {
    const doc = Object.assign(new EventTarget(), { hidden: false });
    const win = new EventTarget();
    vi.stubGlobal("document", doc);
    vi.stubGlobal("window", win);
    const lifecycle = new PlaybackLifecycle();
    const notify = vi.fn();
    const unsubscribe = lifecycle.subscribe(notify);
    win.dispatchEvent(new Event("pagehide"));
    expect(lifecycle.getSnapshot()).toEqual({ visible: false, epoch: 1 });
    win.dispatchEvent(new Event("pageshow"));
    expect(lifecycle.getSnapshot()).toEqual({ visible: true, epoch: 2 });
    doc.hidden = true;
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(lifecycle.getSnapshot()).toEqual({ visible: false, epoch: 3 });
    doc.hidden = false;
    win.dispatchEvent(new Event("online"));
    expect(lifecycle.getSnapshot()).toEqual({ visible: true, epoch: 4 });
    unsubscribe();
    win.dispatchEvent(new Event("focus"));
    expect(notify).toHaveBeenCalledTimes(4);
  });
});
