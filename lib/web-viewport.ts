import { Dimensions, Platform } from "react-native";

/** Phone-width column on desktop/tablet so the Expo UI does not stretch. */
export const WEB_APP_MAX_WIDTH = 480;

type Dim = { width: number; height: number; scale: number; fontScale: number };

function clampWindow(value: Dim): Dim {
  const raw = value?.width || (typeof window !== "undefined" ? window.innerWidth : WEB_APP_MAX_WIDTH);
  const width =
    typeof window !== "undefined" ? Math.min(window.innerWidth, WEB_APP_MAX_WIDTH) : Math.min(raw, WEB_APP_MAX_WIDTH);
  return { ...value, width };
}

function patchWebDimensions() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;

  const origGet = Dimensions.get.bind(Dimensions);
  const origAdd = Dimensions.addEventListener.bind(Dimensions);

  Dimensions.get = ((dimension: "window" | "screen") => {
    const value = origGet(dimension);
    return dimension === "window" ? clampWindow(value) : value;
  }) as typeof Dimensions.get;

  Dimensions.addEventListener = ((type: "change", handler: (dims: { window: Dim; screen: Dim }) => void) => {
    const wrapped = (dims: { window: Dim; screen: Dim }) => {
      handler({ window: clampWindow(dims.window), screen: dims.screen });
    };
    // Preserve the subscription's remove() method, which owns the wrapped handler.
    return origAdd(type, wrapped);
  }) as typeof Dimensions.addEventListener;

}

patchWebDimensions();
