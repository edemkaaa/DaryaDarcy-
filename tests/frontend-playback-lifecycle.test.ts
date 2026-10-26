import { afterEach, expect, it, vi } from "vitest";
import { PlaybackLifecycle } from "../apps/frontend/src/features/videos/playback-lifecycle";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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
  const emit = (name: string) =>
    (name === "visibilitychange" ? document : window).dispatchEvent(
      new Event(name),
    );
  return { document, now, lifecycle, notify, unsubscribe, emit };
}

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

it("a new window blur and focus requires a fresh check even within the window", () => {
  const f = fixture();
  f.emit("focus");
  const before = f.lifecycle.getSnapshot();
  f.emit("blur");
  f.emit("focus");
  expect(f.lifecycle.getSnapshot().epoch).toBe(before.epoch + 1);
  f.unsubscribe();
});

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
