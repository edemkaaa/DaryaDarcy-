import { afterEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  add: vi.fn(),
  remove: vi.fn(),
  size: { width: 1000, height: 800, scale: 1, fontScale: 1 },
}));
vi.mock("react-native", () => ({
  Platform: { OS: "web" },
  Dimensions: { get: () => mock.size, addEventListener: mock.add },
}));
afterEach(() => vi.unstubAllGlobals());

it("clamps window dimensions and keeps subscription cleanup", async () => {
  vi.stubGlobal("window", { innerWidth: 1000 });
  mock.add.mockReturnValue({ remove: mock.remove });
  await import("../lib/web-viewport");
  const { Dimensions } = await import("react-native");
  expect(Dimensions.get("window").width).toBe(480);
  expect(Dimensions.get("screen").width).toBe(1000);
  const handler = vi.fn();
  const subscription = Dimensions.addEventListener("change", handler);
  mock.add.mock.calls[0][1]({ window: mock.size, screen: mock.size });
  expect(handler.mock.calls[0][0].window.width).toBe(480);
  expect(handler.mock.calls[0][0].screen.width).toBe(1000);
  subscription.remove();
  expect(mock.remove).toHaveBeenCalledOnce();
});
