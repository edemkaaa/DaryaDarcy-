/** Измеритель картинки проверяется управляемым Image-двойником без DOM/сети. */
import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/shared/ui/static-image-catalog", () => ({
  STATIC_IMAGE_URLS: {},
  STATIC_IMAGE_VARIANTS: {},
}));
import { DomImage } from "../apps/frontend/src/shared/ui/dom-image";

class ProbeImage {
  static last: ProbeImage;
  naturalWidth = 640;
  naturalHeight = 800;
  src = "";
  srcset = "";
  sizes = "";
  onload: (() => void) | null = null;
  onerror: ((error: Event | string) => void) | null = null;
  constructor() {
    ProbeImage.last = this;
  }
  /** Двойник отражает освобождение src/srcset, чтобы тест видел отмену источника. */
  removeAttribute(key: "src" | "srcset") {
    this[key] = "";
  }
}
/** Возвращаем глобальные объекты и настоящие часы. */
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Размер публичного S3-постера запрашивается через preview; отменённый probe не вызывает поздний success. */
it("probes a public poster through its preview and returns cancellable ownership", () => {
  vi.stubGlobal("window", {
    Image: ProbeImage,
    location: { href: "http://fixture.test/" },
  });
  const success = vi.fn();
  const cancel = DomImage.getSize(
    "https://s3.twcstorage.ru/daryadarcy-s3/feed/poster.jpg",
    success,
  );
  const image = ProbeImage.last;
  expect(image.src).toMatch(/^\/_next\/image\?/);
  const late = image.onload;
  expect(typeof cancel).toBe("function");
  cancel();
  expect(image.src).toBe("");
  expect(image.srcset).toBe("");
  late?.();
  expect(success).not.toHaveBeenCalled();
});

/** Десятисекундный deadline снимает handlers/источник и сообщает ошибку ровно один раз. */
it("releases a stalled poster probe once after its deadline", () => {
  vi.useFakeTimers();
  vi.stubGlobal("window", {
    Image: ProbeImage,
    location: { href: "http://fixture.test/" },
  });
  const success = vi.fn(),
    failure = vi.fn();
  DomImage.getSize("/fixture.jpg", success, failure);
  vi.advanceTimersByTime(10001);
  expect(failure).toHaveBeenCalledTimes(1);
  expect(ProbeImage.last.src).toBe("");
  expect(ProbeImage.last.onload).toBeNull();
  expect(success).not.toHaveBeenCalled();
});

/** Успешный onload возвращает natural dimensions и освобождает временный источник. */
it("reports decoded dimensions once and releases its source", () => {
  vi.stubGlobal("window", {
    Image: ProbeImage,
    location: { href: "http://fixture.test/" },
  });
  const success = vi.fn();
  DomImage.getSize("/fixture.jpg", success);
  ProbeImage.last.onload?.();
  expect(success.mock.calls).toEqual([[640, 800]]);
  expect(ProbeImage.last.src).toBe("");
});
