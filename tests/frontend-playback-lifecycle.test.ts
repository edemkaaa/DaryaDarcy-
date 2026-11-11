/** События видимости/фокуса объединяются в проверку права воспроизведения, не в автоматическое продолжение video. */
import { afterEach, expect, it, vi } from "vitest";
import { PlaybackLifecycle } from "../apps/frontend/src/features/videos/playback-lifecycle";

/** Возвращаем performance clock и синтетические window/document. */
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Настоящий PlaybackLifecycle подписан на управляемые EventTarget и фиксированное время. */
function fixture() {
  const document = Object.assign(new EventTarget(), {
    hidden: false,
    hasFocus: vi.fn(() => false),
  });
  const window = new EventTarget();
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", window);
  const now = vi.spyOn(performance, "now").mockReturnValue(100);
  const lifecycle = new PlaybackLifecycle();
  const notify = vi.fn();
  const unsubscribe = lifecycle.subscribe(notify);
  /** Направляем visibilitychange в document, остальные lifecycle события в window. */
  const emit = (name: string) =>
    (name === "visibilitychange" ? document : window).dispatchEvent(
      new Event(name),
    );
  return { document, now, lifecycle, notify, unsubscribe, emit };
}

/** Парные focus/visibility события одного возврата дают одну epoch даже после быстрого ответа; поздний новый возврат даёт следующую. */
for (const first of ["focus", "visibilitychange"]) {
  it(`coalesces ${first} and its paired return event even after a fast response`, () => {
    const f = fixture();
    f.emit(first);
    const initialReturn = f.lifecycle.getSnapshot();
    f.now.mockReturnValue(300);
    f.emit(first === "focus" ? "visibilitychange" : "focus");
    expect(f.lifecycle.getSnapshot()).toBe(initialReturn);
    expect(f.notify).toHaveBeenCalledTimes(1);
    f.now.mockReturnValue(1200);
    f.emit("focus");
    expect(f.lifecycle.getSnapshot().epoch).toBe(initialReturn.epoch + 1);
    f.unsubscribe();
  });
}

/** Настоящий hide/return требует новую epoch независимо от недавнего debounce. */
it("a quick real hide and return bypasses the previous coalescing window", () => {
  const f = fixture();
  f.emit("focus");
  f.document.hidden = true;
  f.emit("visibilitychange");
  expect(f.lifecycle.getSnapshot().visible).toBe(false);
  const hidden = f.lifecycle.getSnapshot();
  f.emit("pagehide");
  expect(f.lifecycle.getSnapshot()).toBe(hidden);
  f.document.hidden = false;
  f.emit("visibilitychange");
  const returned = f.lifecycle.getSnapshot();
  expect(returned.visible).toBe(true);
  expect(returned.epoch).toBeGreaterThan(hidden.epoch);
  f.emit("focus");
  expect(f.lifecycle.getSnapshot()).toBe(returned);
  f.unsubscribe();
});

/** Уход из окна и новый focus — отдельная проверка, не дубль события. */
it("a new window blur and focus requires a fresh check even within the window", () => {
  const f = fixture();
  f.emit("focus");
  const before = f.lifecycle.getSnapshot();
  f.emit("blur");
  f.emit("focus");
  expect(f.lifecycle.getSnapshot().epoch).toBe(before.epoch + 1);
  f.unsubscribe();
});

/** Blur из-за iframe-player при оставшемся document focus не сбрасывает authority по одному таймеру. */
it("returning from a player to the page keeps authority even after the cooldown", () => {
  const f = fixture();
  f.document.hasFocus.mockReturnValue(true);
  const before = f.lifecycle.getSnapshot();
  for (let i = 0; i < 3; i++) {
    f.emit("blur");
    f.now.mockReturnValue(10000 * (i + 1));
    f.emit("focus");
    expect(f.lifecycle.getSnapshot()).toBe(before);
  }
  expect(f.notify).not.toHaveBeenCalled();
  f.unsubscribe();
});

/** После iframe blur настоящий уход из окна всё равно обнаруживается. */
it("leaving the window after focusing a player still requires fresh authority", () => {
  const f = fixture();
  f.document.hasFocus.mockReturnValue(true);
  f.emit("blur");
  f.document.hasFocus.mockReturnValue(false);
  f.emit("blur");
  f.emit("focus");
  expect(f.notify).toHaveBeenCalledTimes(1);
  f.unsubscribe();
});

/** Скрытие, возврат из BFCache и online требуют проверки даже после фокуса плеера. */
for (const event of ["visibilitychange", "pagehide", "online", "pageshow"]) {
  it(`${event} still rechecks after focusing a player`, () => {
    const f = fixture();
    f.document.hasFocus.mockReturnValue(true);
    f.emit("blur");
    if (event === "visibilitychange") f.document.hidden = true;
    f.emit(event);
    if (event === "visibilitychange" || event === "pagehide") {
      expect(f.lifecycle.getSnapshot().visible).toBe(false);
      f.document.hidden = false;
      f.emit("focus");
      expect(f.lifecycle.getSnapshot().visible).toBe(true);
    }
    expect(f.notify).toHaveBeenCalled();
    f.unsubscribe();
  });
}

/** Сетевой/BFCache возврат всегда меняет epoch, следующий focus объединяется с ним. */
for (const event of ["online", "pageshow"]) {
  it(`${event} always requires new authority and coalesces the following focus`, () => {
    const f = fixture();
    f.emit("focus");
    const before = f.lifecycle.getSnapshot();
    f.emit(event);
    const after = f.lifecycle.getSnapshot();
    expect(after.epoch).toBe(before.epoch + 1);
    f.emit("focus");
    expect(f.lifecycle.getSnapshot()).toBe(after);
    f.unsubscribe();
  });
}

/** Пока document.hidden, посторонние события не возвращают разрешение. */
it("hidden documents do not regain authority through focus, online or pageshow", () => {
  const f = fixture();
  f.document.hidden = true;
  f.emit("visibilitychange");
  const hidden = f.lifecycle.getSnapshot();
  for (const event of ["focus", "online", "pageshow"]) f.emit(event);
  expect(f.lifecycle.getSnapshot()).toBe(hidden);
  f.document.hidden = false;
  f.emit("pageshow");
  expect(f.lifecycle.getSnapshot().visible).toBe(true);
  f.unsubscribe();
});

/** После unsubscribe никакое событие не вызывает notify. */
it("unsubscribing removes all lifecycle listeners", () => {
  const f = fixture();
  f.unsubscribe();
  for (const event of [
    "blur",
    "focus",
    "visibilitychange",
    "pagehide",
    "pageshow",
    "online",
  ])
    f.emit(event);
  expect(f.notify).not.toHaveBeenCalled();
});
