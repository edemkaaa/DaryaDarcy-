import { STATIC_IMAGE_URLS, STATIC_IMAGE_VARIANTS } from "./static-image-catalog";

// Only known frontend assets change URL. API, signed, blob and data URLs pass through.
export function resolveImageUri(uri: string | undefined): string | undefined {
  if (uri === undefined) return undefined;
  const resolved = STATIC_IMAGE_URLS[uri];
  return typeof resolved === "string" ? resolved : uri;
}

/** Public static images only; signed URLs, API media, blobs and data pass through. */
export function resolveImageAttributes(uri: string | undefined, fullSize = false) {
  const variants = uri === undefined ? undefined : STATIC_IMAGE_VARIANTS[uri];
  if (fullSize || !Array.isArray(variants) || variants.length === 0) {
    return { src: resolveImageUri(uri), srcSet: undefined, sizes: undefined };
  }
  const fallback = variants.find((variant) => variant.width >= 640) ?? variants.at(-1)!;
  return {
    src: resolveImageUri(fallback.uri),
    srcSet: variants.map((variant) => `${resolveImageUri(variant.uri)} ${variant.width}w`).join(", "),
    sizes: "(max-width: 480px) 100vw, 480px",
  };
}
