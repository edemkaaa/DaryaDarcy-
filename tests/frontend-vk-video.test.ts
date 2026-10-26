import { describe, expect, it } from "vitest";
import { getVkVideoEmbedUrl } from "../apps/frontend/src/shared/media/vk-video-url";

const query = "oid=-227034863&id=456239527&hash=99fae216cf20dcdc";
describe("exported VK player sources", () => {
  it.each(["vk.com", "vk.ru", "vkvideo.ru"])(
    "accepts an export without an access hash on %s",
    (host) => {
      expect(
        getVkVideoEmbedUrl(
          `https://${host}/video_ext.php?oid=-1&id=2&autoplay=1`,
        ),
      ).toBe(`https://${host}/video_ext.php?oid=-1&id=2&autoplay=0`);
    },
  );
  it.each(["vk.com", "vk.ru", "vkvideo.ru"])(
    "keeps the exported identity and hash on %s without autoplay or foreign parameters",
    (host) => {
      const value = getVkVideoEmbedUrl(
        `https://${host}/video_ext.php?${query}&hd=3&autoplay=1&redirect=https://foreign.test#private`,
      );
      expect(value).toBe(
        `https://${host}/video_ext.php?${query}&hd=3&autoplay=0`,
      );
    },
  );
  it.each([
    `http://vk.com/video_ext.php?${query}`,
    `https://vk.com.foreign.test/video_ext.php?${query}`,
    `https://foreign.test/video_ext.php?${query}`,
    `https://member:password@vk.com/video_ext.php?${query}`,
    `https://vk.com:444/video_ext.php?${query}`,
    "https://vk.com/video-227034863_456239527",
    "https://vk.com/video_ext.php?oid=-1&id=2&hash=",
    "https://vk.com/video_ext.php?oid=-1&id=2&hash=x",
    `https://vk.com/video_ext.php?${query}&oid=1`,
    `https://vk.com/video_ext.php?${query}&id=1`,
    `https://vk.com/video_ext.php?${query}&hash=anotherhash`,
    "https://vk.com/video_ext.php?oid=0&id=2&hash=99fae216cf20dcdc",
    "javascript:alert(1)",
    `<iframe src="https://vk.com/video_ext.php?${query}"></iframe>`,
    " ",
    "x".repeat(2049),
  ])("refuses an unsafe, ambiguous or incomplete source %s", (source) => {
    expect(getVkVideoEmbedUrl(source)).toBeNull();
  });
});
