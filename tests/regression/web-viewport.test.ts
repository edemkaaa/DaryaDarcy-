/** Проверяем измерения веб-окна, ограничение ширины контента и стабильную серверную гидратацию. */
import { afterEach, expect, it, vi } from "vitest";
import { getViewport } from "../../apps/frontend/src/shared/browser/viewport";
/** Подменённые browser globals не должны переходить в следующий сценарий. */
afterEach(() => vi.unstubAllGlobals());
/** Различаем ширину колонки приложения и полную ширину экрана, сохраняя плотность пикселей. */
it("clamps the content width and keeps full screen dimensions", () => {
  vi.stubGlobal("window", {
    innerWidth: 1000,
    innerHeight: 800,
    devicePixelRatio: 2,
  });
  vi.stubGlobal("document", { documentElement: { clientWidth: 1000 } });
  expect(getViewport().width).toBe(480);
  expect(getViewport("screen").width).toBe(1000);
  expect(getViewport().scale).toBe(2);
});
/** После сужения layout viewport устаревший innerWidth не должен растягивать интерфейс. */
it("uses the shrunken layout viewport instead of stale innerWidth", () => {
  vi.stubGlobal("window", {
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 2,
  });
  vi.stubGlobal("document", { documentElement: { clientWidth: 320 } });
  expect(getViewport().width).toBe(320);
  expect(getViewport("screen").width).toBe(320);
});
/** Нулевой clientWidth позволяет использовать доступный размер окна. */
it("falls back to innerWidth when the layout width is unavailable", () => {
  vi.stubGlobal("window", {
    innerWidth: 1000,
    innerHeight: 800,
    devicePixelRatio: 2,
  });
  vi.stubGlobal("document", { documentElement: { clientWidth: 0 } });
  expect(getViewport().width).toBe(480);
  expect(getViewport("screen").width).toBe(1000);
});
/** Без browser globals возвращаем постоянные начальные размеры для совпадения HTML. */
it("keeps server and initial hydration measurements deterministic", () => {
  expect(getViewport()).toEqual({
    width: 480,
    height: 800,
    scale: 1,
    fontScale: 1,
  });
});
