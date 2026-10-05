import { afterEach, expect, it, vi } from "vitest";
import { getViewport } from "../apps/frontend/src/shared/browser/viewport";
afterEach(() => vi.unstubAllGlobals());
it("clamps the content width and keeps full screen dimensions", () => {
  vi.stubGlobal("window", { innerWidth: 1000, innerHeight: 800, devicePixelRatio: 2 });
  expect(getViewport().width).toBe(480);
  expect(getViewport("screen").width).toBe(1000);
  expect(getViewport().scale).toBe(2);
});
it("keeps server and initial hydration measurements deterministic", () => {
  expect(getViewport()).toEqual({ width: 480, height: 800, scale: 1, fontScale: 1 });
});
