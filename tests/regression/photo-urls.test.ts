/** Проверяем допустимые адреса фотографий, включая закрытые канонические пути и старые подписанные URL. */
import { describe, expect, it } from "vitest";
import { sanitizePhotoUrls } from "../../apps/frontend/src/shared/media/photo-urls";

/** Вход API рассматривается как недоверенные данные; порядок разрешённых адресов сохраняется. */
describe("API photo URLs", () => {
  /** Подпись зависит от точного адреса: допустимые HTTP(S) URL не переписываем. */
  it("keeps valid signed URLs unchanged and in order", () => {
    const urls = [
      "https://cdn.example/a.jpg?signature=abc%2Fdef",
      "http://cdn.example/b.png",
    ];
    expect(sanitizePhotoUrls(urls)).toEqual(urls);
  });
  /** Отбрасываем нетекстовые значения, локальные схемы, исполняемые URL и встроенные реквизиты. */
  it("rejects invalid types, local and executable URLs", () => {
    expect(
      sanitizePhotoUrls([
        null,
        {},
        4,
        "",
        "javascript:alert(1)",
        "file:///etc/passwd",
        "https://u:p@cdn.example/a",
        "not a URL",
      ]),
    ).toEqual([]);
    expect(sanitizePhotoUrls(null)).toEqual([]);
  });
  /** Совместимые адреса сохраняем с повторами; произвольные относительные пути, traversal и параметры закрытой выдачи отклоняем. */
  it("retains canonical uploaded photos alongside old signed CDN URLs", () => {
    const url = "/api/media/content-files/11111111-1111-4111-8111-111111111111";
    const old = "https://cdn.example/old.jpg?signature=abc%2Fdef";
    expect(sanitizePhotoUrls([old, url, old])).toEqual([old, url, old]);
    expect(
      sanitizePhotoUrls([
        "//cdn.example/photo.jpg",
        "/api/auth/logout",
        `${url}/../other`,
        `${url}?redirect=https://outside.example`,
        `${url}#fragment`,
        ` ${url}`,
        "/api/media/content-files/not-an-id",
        "/api/media/content-files/%2e%2e",
        "/\\outside.example/photo.jpg",
      ]),
    ).toEqual([]);
  });
});
