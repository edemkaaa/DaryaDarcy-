/** Подменёнными VK HTML/CDN и storage проверяем безопасное автоматическое получение устойчивой обложки поста; настоящий VK и S3 не используются. */
import { beforeEach, describe, expect, it, vi } from "vitest";
const stored = "https://s3.twcstorage.ru/daryadarcy-s3/covers/vk-v1/cover.webp";
/** Модуль сохранения подменяется до импорта resolver, чтобы никакой preview не записывался в S3. */
const storage = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("../apps/backend/src/media/vk-poster-object", () => ({
  saveVkPoster: storage.save,
}));
import { resolveVkPostPosters } from "../apps/backend/src/content/vk-post-posters";

const link =
  "https://vkvideo.ru/video_ext.php?oid=-211171256&id=456239243&hash=a1b2c3d4e5f60708&autoplay=0";
const small = "https://sun9-8.userapi.com/cover.jpg?size=320x180&sign=small";
const large = "https://sun9-8.userapi.com/cover.jpg?size=1280x720&sign=large";
/** Строит inert HTML fixture с video.get metadata; overrides моделируют чужое видео, unsafe image и first-frame fallback. */
function page(overrides: Record<string, unknown> = {}) {
  const value = {
    apiPrefetchCache: [
      {
        method: "video.get",
        response: {
          items: [
            {
              owner_id: -211171256,
              id: 456239243,
              image: [
                { url: small, width: 320, height: 180 },
                { url: large, width: 1280, height: 720 },
                { url: large + "&proxy=1", width: 2048, height: 1152 },
              ],
              ...overrides,
            },
          ],
        },
      },
      { method: "video.getPlayerConfig", response: { config: {} } },
    ],
  };
  return `<script>;window.cur = Object.assign(window.cur || {}, ${JSON.stringify(value)}, {screen:"embed"}); otherCode();</script>`;
}
/** Отделяет фиксированный VK metadata-host от CDN-ответа с минимальной JPEG-сигнатурой. */
const transport = (html = page()) =>
  vi.fn<typeof fetch>().mockImplementation(async (destination) =>
    new URL(String(destination)).hostname === "vk.com"
      ? new Response(html)
      : new Response(new Uint8Array([255, 216, 255, 0]), {
          headers: { "Content-Type": "image/jpeg" },
        }),
  );

/** Обложка выдаётся только после безопасного разбора metadata, проверки изображения и сохранения собственной копии. */
describe("VK post covers", () => {
  /** Сбрасываем storage mock и возвращаем подтверждённый устойчивый URL для нового сценария. */
  beforeEach(() => {
    storage.save.mockReset().mockResolvedValue(stored);
  });
  /** Дубликаты ссылок объединяются, export hash сохраняется, а signed image URL не переписывается произвольными параметрами. */
  it("uses the exact hash at a fixed VK host and keeps the largest signed image intact", async () => {
    const fetchImpl = transport();
    const result = await resolveVkPostPosters([link, link], { fetchImpl });
    expect([...result]).toEqual([[link, stored]]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [destination, options] = fetchImpl.mock.calls[0];
    const url = new URL(String(destination));
    expect(url.origin).toBe("https://vk.com");
    expect(url.pathname).toBe("/video_ext.php");
    expect(url.searchParams.get("hash")).toBe("a1b2c3d4e5f60708");
    expect(options).toMatchObject({ redirect: "error", credentials: "omit" });
    expect(String(fetchImpl.mock.calls[1][0])).toBe(large);
    expect(storage.save).toHaveBeenCalledTimes(1);
  });
  /** После отказа основной обложки допускается согласованный first-frame из безопасного CDN. */
  it("falls back to a matching VK first frame when the cover CDN refuses it", async () => {
    const frame =
      "https://iv.okcdn.ru/getVideoPreview?id=own-video&tkn=synthetic";
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      const value = String(url);
      if (new URL(value).hostname === "vk.com")
        return new Response(
          page({ first_frame: [{ url: frame, width: 1280, height: 720 }] }),
        );
      if (value === frame)
        return new Response(new Uint8Array([255, 216, 255, 0]), {
          headers: { "Content-Type": "image/jpeg" },
        });
      return new Response("Missing", { status: 404 });
    });
    expect((await resolveVkPostPosters([link], { fetchImpl })).get(link)).toBe(
      stored,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
  /** Ошибка storage не приводит к выдаче временной signed VK-ссылки вместо устойчивой копии. */
  it("does not return a transient VK URL if storing its stable copy fails", async () => {
    storage.save.mockRejectedValue(new Error("storage unavailable"));
    expect(
      (await resolveVkPostPosters([link], { fetchImpl: transport() })).size,
    ).toBe(0);
  });
  /** Невалидный host, share wall, приватный API и повтор ID отвергаются до любого fetch. */
  it("never requests arbitrary hosts, share pages, private uploads or duplicate parameters", async () => {
    const fetchImpl = transport();
    expect(
      (
        await resolveVkPostPosters(
          [
            "http://127.0.0.1/video_ext.php?oid=-1&id=2",
            link.replace("vkvideo.ru", "vkvideo.ru.evil.test"),
            link + "&id=12",
            "/api/media/post-attachments/30",
            "https://vk.ru/wall-211171256_41982",
          ],
          { fetchImpl },
        )
      ).size,
    ).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  /** Metadata обязана соответствовать owner/video и содержать HTTPS URL допустимого CDN с корректными размерами. */
  it.each([
    { id: 456239244 },
    { owner_id: 1 },
    {
      image: [{ url: "https://evil.test/cover.jpg", width: 1280, height: 720 }],
    },
    {
      image: [
        {
          url: "https://sun9-8.userapi.com@evil.test/a.jpg",
          width: 1280,
          height: 720,
        },
      ],
    },
    {
      image: [
        { url: "http://sun9-8.userapi.com/a.jpg", width: 1280, height: 720 },
      ],
    },
    { image: [{ url: large, width: 0, height: 720 }] },
  ])("ignores mismatched or unsafe metadata: %j", async (overrides) => {
    expect(
      (
        await resolveVkPostPosters([link], {
          fetchImpl: transport(page(overrides)),
        })
      ).size,
    ).toBe(0);
  });
  /** Padding учитывается отдельно от геометрического размера, чтобы большая картинка с полями не выигрывала автоматически. */
  it("prefers a real unpadded image over a larger padded thumbnail", async () => {
    const html = page({
      image: [
        { url: large, width: 1280, height: 720, with_padding: 1 },
        { url: small, width: 320, height: 180 },
      ],
    });
    expect(
      (await resolveVkPostPosters([link], { fetchImpl: transport(html) })).get(
        link,
      ),
    ).toBe(stored);
  });
  /** Отказ VK и повреждённый JSON не ломают сохранение поста; содержимое script никогда не исполняется. */
  it.each([
    "<html>Access denied</html>",
    "window.cur = Object.assign(window.cur || {}, {malformed});",
  ])("fails softly without interpreting scripts", async (html) => {
    expect(
      (await resolveVkPostPosters([link], { fetchImpl: transport(html) })).size,
    ).toBe(0);
  });
  /** Разделители внутри JSON-строк не должны оборвать extraction или превратиться в исполняемый код. */
  it("handles JSON strings containing braces and script-like text as data", async () => {
    expect(
      (
        await resolveVkPostPosters([link], {
          fetchImpl: transport(page({ title: '}); doNotExecute(); {"' })),
        })
      ).get(link),
    ).toBe(stored);
  });
  /** 403, network exception и превышение HTML-лимита дают отсутствие обложки, а не отказ основной операции. */
  it("does not turn refusal, network errors or oversized bodies into a save failure", async () => {
    for (const fetchImpl of [
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("Denied", { status: 403 })),
      vi.fn<typeof fetch>().mockRejectedValue(new Error("offline")),
      transport("x".repeat(1024 * 1024 + 1)),
    ])
      expect((await resolveVkPostPosters([link], { fetchImpl })).size).toBe(0);
  });
  /** HTTP успех без картинки и 403/404/429 одинаково запрещают сохранение невалидного preview. */
  it.each([403, 404, 429, 200])(
    "does not persist metadata for a missing/non-image cover (%s)",
    async (status) => {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockImplementation(async (destination) =>
          new URL(String(destination)).hostname === "vk.com"
            ? new Response(page())
            : new Response("Not an image", { status }),
        );
      expect((await resolveVkPostPosters([link], { fetchImpl })).size).toBe(0);
    },
  );
  /** MIME не заменяет проверку сигнатуры и лимита тела изображения. */
  it("checks image bytes and rejects an oversized preview", async () => {
    for (const response of [
      new Response("fake JPEG", { headers: { "Content-Type": "image/jpeg" } }),
      new Response(new Uint8Array([255, 216, 255]), {
        headers: {
          "Content-Type": "image/jpeg",
          "Content-Length": String(4 * 1024 * 1024 + 1),
        },
      }),
    ]) {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockImplementation(async (url) =>
          new URL(String(url)).hostname === "vk.com"
            ? new Response(page())
            : response,
        );
      expect((await resolveVkPostPosters([link], { fetchImpl })).size).toBe(0);
    }
  });
  /** Общий deadline охватывает зависшее тело CDN и вызывает отмену stream. */
  it("cancels a stalled image body under the same save deadline", async () => {
    let cancelled = false;
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (url) =>
      new URL(String(url)).hostname === "vk.com"
        ? new Response(page())
        : new Response(
            new ReadableStream({
              cancel() {
                cancelled = true;
              },
            }),
            {
              headers: { "Content-Type": "image/jpeg" },
            },
          ),
    );
    expect(
      (await resolveVkPostPosters([link], { fetchImpl, timeoutMs: 20 })).size,
    ).toBe(0);
    expect(cancelled).toBe(true);
  });
  /** Та же отмена действует на metadata stream после заголовков, не только на ожидание fetch. */
  it("cancels a body stalled after headers when the shared deadline expires", async () => {
    let cancelled = false;
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        new ReadableStream({
          cancel() {
            cancelled = true;
          },
        }),
      ),
    );
    expect(
      (await resolveVkPostPosters([link], { fetchImpl, timeoutMs: 20 })).size,
    ).toBe(0);
    expect(cancelled).toBe(true);
  });
  /** Одна операция сохранения не превращается в неограниченное число VK metadata запросов. */
  it("bounds lookups per save", async () => {
    const fetchImpl = transport();
    await resolveVkPostPosters(
      Array.from({ length: 20 }, (_, i) =>
        link.replace("id=456239243", `id=${456239243 + i}`),
      ),
      { fetchImpl },
    );
    expect(
      fetchImpl.mock.calls.filter(
        ([url]) => new URL(String(url)).hostname === "vk.com",
      ).length,
    ).toBeLessThanOrEqual(8);
  });
});
