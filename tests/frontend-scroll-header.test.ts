import { describe, expect, it } from "vitest";
import { ScrollHeaderState } from "../apps/frontend/src/shared/browser/scroll-header-state";

describe("scroll header direction", () => {
  it("accumulates slow fractional movement and reveals sooner than it hides", () => {
    const state = new ScrollHeaderState();
    state.reveal(100);
    for (let y = 100.5; y < 112; y += 0.5)
      expect(state.update(y, 1000)).toBe(false);
    expect(state.update(112, 1000)).toBe(true);
    for (let y = 111.5; y > 104; y -= 0.5)
      expect(state.update(y, 1000)).toBe(true);
    expect(state.update(104, 1000)).toBe(false);
  });

  it("does not flicker on small reversals or repeated events", () => {
    const state = new ScrollHeaderState();
    expect(state.update(100, 1000)).toBe(true);
    for (const y of [100, 99, 100, 98, 101, 99, 100])
      expect(state.update(y, 1000)).toBe(true);
    expect(state.update(91, 1000)).toBe(false);
  });

  it("keeps the top visible through iOS negative overscroll and rebound", () => {
    const state = new ScrollHeaderState();
    expect(state.update(100, 1000)).toBe(true);
    for (const y of [8, 0, -50, -5, 0, 3, 8])
      expect(state.update(y, 1000)).toBe(false);
  });

  it("ignores iOS bottom overscroll and rebound until content actually moves up", () => {
    const state = new ScrollHeaderState();
    expect(state.update(1000, 1000)).toBe(true);
    for (const y of [1040, 1100, 1040, 1000, 998])
      expect(state.update(y, 1000)).toBe(true);
    expect(state.update(992, 1000)).toBe(false);
  });

  it("does not mistake shrinking content or viewport changes for upward scrolling", () => {
    const state = new ScrollHeaderState();
    expect(state.update(1000, 1000)).toBe(true);
    expect(state.update(600, 600)).toBe(true);
    expect(state.update(592, 600)).toBe(false);
    expect(state.update(0, 0)).toBe(false);
  });

  it("starts visible on a restored screen and measures from its current position", () => {
    const state = new ScrollHeaderState();
    state.update(300, 1000);
    state.reveal(500);
    expect(state.hidden).toBe(false);
    expect(state.update(501, 1000)).toBe(false);
    expect(state.update(512, 1000)).toBe(true);
  });
});
