import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getVkCatalogEmbedUrl,
  isVkCatalogEnabled,
  nextVideoCursor,
  parseVideoCatalog,
  parseVideoPlayback,
  requireVkVideoId,
  stalledVideoCursor,
} from "../apps/frontend/src/features/videos/catalog-api";
import { PlaybackLifecycle } from "../apps/frontend/src/features/videos/playback-lifecycle";

const embed = "https://vkvideo.ru/video_ext.php?oid=-1&id=2&hash=abcdefgh";
const card = {
  id: 2,
  title: "Видео",
  duration: null,
  access: "club",
  canWatch: false,
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("catalog contracts", () => {
  it("keeps the integration off unless explicitly enabled", () => {
    for (const value of ["", "false", "1", "TRUE"]) {
      vi.stubEnv("NEXT_PUBLIC_VK_CATALOG_ENABLED", value);
      expect(isVkCatalogEnabled()).toBe(false);
    }
    vi.stubEnv("NEXT_PUBLIC_VK_CATALOG_ENABLED", "true");
    expect(isVkCatalogEnabled()).toBe(true);
  });
  it("accepts a card without exposing an embed or provider", () => {
    expect(parseVideoCatalog({ items: [card], nextCursor: 2 })).toEqual({
      items: [card],
      nextCursor: 2,
    });
  });
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
  it.each(["vk.com", "vk.ru", "vkvideo.ru"])(
    "canonicalizes exported %s URLs",
    (host) => {
      const url = embed.replace("vkvideo.ru", host);
      expect(getVkCatalogEmbedUrl(url + "&hd=3&autoplay=1")).toBe(
        url + "&hd=3&autoplay=0",
      );
    },
  );
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
