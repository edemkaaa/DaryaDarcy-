import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("../lib/device", () => ({ isAppleMobileWeb: () => true }));
import { pressableProps } from "../lib/ios-web-press";

afterEach(() => vi.restoreAllMocks());
describe("iOS press fallback", () => {
  it("forwards the event and deduplicates press/click", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1000);
    const handler = vi.fn<(event: { target: string }) => void>();
    const props = pressableProps(handler);
    const event = { target: "tab" };
    props.onPress(event);
    props.onClick?.(event);
    expect(handler).toHaveBeenCalledExactlyOnceWith(event);
    now.mockReturnValue(1500);
    props.onClick?.(event);
    expect(handler).toHaveBeenCalledTimes(2);
  });
});
