// Архив Expo. Фикстура принудительно выбирает Apple-web ветку fallback обработчика.
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("../apps/frontend/lib/device", () => ({ isAppleMobileWeb: () => /* Фикстура принудительно выбирает Apple-web ветку fallback обработчика. */ true }));
import { pressableProps } from "../apps/frontend/lib/ios-web-press";

afterEach(() => vi.restoreAllMocks());
describe("iOS press fallback", () => {
  it("forwards the event and deduplicates press/click", () => {
    // Сценарий: Передаёт исходное событие и объединяет парные press/click, сохраняя следующее отдельное нажатие.

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
