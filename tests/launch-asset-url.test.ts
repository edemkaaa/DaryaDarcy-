/** Схема сезонного оформления различает прямой источник картинки и страницу общего доступа. */
import { describe, expect, it } from "vitest";
import {
  defaultLaunchConfiguration,
  launchConfigurationSchema,
} from "../apps/backend/src/launch/settings";

/** Проверяем оба поля оформления на копиях default-конфигурации, не меняя сохранённые настройки. */
describe("season artwork URLs are image sources, not file-sharing pages", () => {
  /** Невалидные URL дают неуспешный safeParse вместо исключения из URL-конструктора. */
  it.each(["not a URL", "https://", ""])(
    "rejects malformed input without throwing: %s",
    (url) => {
      const config = structuredClone(defaultLaunchConfiguration);
      config.seasons.winter.bannerUrl = url;
      expect(launchConfigurationSchema.safeParse(config).success).toBe(false);
    },
  );
  /** Яндекс sharing-страницы, включая нормализацию host, отклоняются с подсказкой о прямой ссылке. */
  it.each([
    "https://disk.yandex.ru/i/iXiEA9lCjqzCkA",
    "https://disk.yandex.ru/d/example",
    "https://disk.yandex.com/i/example",
    "https://yadi.sk/i/example",
    "https://DISK.YANDEX.RU./i/example",
  ])("rejects the sharing page %s for both seasonal fields", (url) => {
    for (const field of ["bannerUrl", "backgroundUrl"] as const) {
      const config = structuredClone(defaultLaunchConfiguration);
      config.seasons.winter[field] = url;
      const result = launchConfigurationSchema.safeParse(config);
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues[0].message).toContain("прямую ссылку");
    }
  });

  /** Null сохраняет встроенное оформление; прямые HTTPS-источники не требуют файлового расширения. */
  it.each([
    null,
    "https://s3.twcstorage.ru/daryadarcy-s3/covers/banner.webp",
    "https://assets.example.test/banner.png",
    "https://images.example.test/render?id=123",
  ])("keeps existing direct-image and default URLs valid: %s", (url) => {
    const config = structuredClone(defaultLaunchConfiguration);
    config.seasons.winter.bannerUrl = url;
    expect(launchConfigurationSchema.safeParse(config).success).toBe(true);
  });
});
