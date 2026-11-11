/** Серверная схема VK принимает экспорт без hash, сохраняя строгую идентичность источника. */
import { describe, expect, it } from "vitest";
import {
  parseVkEmbed,
  vkVideoInput,
} from "../apps/backend/src/content/vk-video-input";

const identity = "oid=-211171256&id=456239238";
const bare = `https://vk.ru/video_ext.php?${identity}`;

/** Проверяем parse и входную Zod-схему одинаковой матрицей, без загрузки VK. */
describe("VK exports with an optional access hash", () => {
  /** Публичный export разрешён на трёх VK host; сервер не придумывает hash и отключает autoplay. */
  it.each(["vk.ru", "vk.com", "vkvideo.ru"])(
    "accepts an exported player without inventing a hash on %s",
    (host) => {
      const source = `https://${host}/video_ext.php?${identity}&autoplay=1`;
      expect(parseVkEmbed(source)).toEqual({
        embedUrl: `https://${host}/video_ext.php?${identity}&autoplay=0`,
        sourceKey: expect.any(String),
      });
      expect(
        vkVideoInput.safeParse({
          embedUrl: source,
          title: "Synthetic export",
          access: "club",
          published: false,
        }).success,
      ).toBe(true);
    },
  );
  /** Изменение hash/hd не создаёт другую sourceKey для тех же oid/id. */
  it("keeps source identity stable with or without a valid hash", () => {
    const withHash = parseVkEmbed(`${bare}&hash=synthetic_hash`);
    const withoutHash = parseVkEmbed(`${bare}&hd=2`);
    expect(withoutHash).not.toBeNull();
    expect(withoutHash?.sourceKey).toBe(withHash?.sourceKey);
    expect(withHash?.embedUrl).toBe(`${bare}&hash=synthetic_hash&autoplay=0`);
    expect(withoutHash?.embedUrl).toBe(`${bare}&hd=2&autoplay=0`);
  });
  /** Повторы query, неверные значения, чужие origin, credentials и iframe HTML не принимаются. */
  it.each([
    `${bare}&hash=`,
    `${bare}&hash=x`,
    `${bare}&hash=${"x".repeat(129)}`,
    `${bare}&hash=invalid%20hash`,
    `${bare}&hash=synthetic_hash&hash=another_hash`,
    `${bare}&hash=&hash=synthetic_hash`,
    `${bare}&oid=-1`,
    `${bare}&id=1`,
    `${bare}&autoplay=1&autoplay=0`,
    `${bare}&hd=2&hd=3`,
    `${bare}&redirect=https://outside.test`,
    `${bare}#fragment`,
    bare.replace("https:", "http:"),
    bare.replace("vk.ru", "vk.ru.outside.test"),
    bare.replace("vk.ru", "user:password@vk.ru"),
    bare.replace("vk.ru", "vk.ru:8443"),
    bare.replace("/video_ext.php", "/wall-211171256_41982"),
    bare.replace("oid=-211171256", "oid=0"),
    bare.replace("id=456239238", "id=1.5"),
    `<iframe src="${bare}"></iframe>`,
  ])("rejects unsafe or ambiguous input even without a hash: %s", (source) => {
    expect(parseVkEmbed(source)).toBeNull();
    expect(
      vkVideoInput.safeParse({
        embedUrl: source,
        title: "Synthetic export",
        access: "club",
        published: false,
      }).success,
    ).toBe(false);
  });
});
