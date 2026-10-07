import {
  STATIC_IMAGE_URLS,
  STATIC_IMAGE_VARIANTS,
} from "./static-image-catalog";
import { getImageProps } from "next/image";

function isPublicFeedPhoto(uri: string) {
  try {
    const url = new URL(uri);
    return (
      url.origin === "https://s3.twcstorage.ru" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      /^\/daryadarcy-s3\/feed\/.+\.(?:jpe?g|png|webp)$/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

// Only known frontend assets change URL. API, signed, blob and data URLs pass through.
export function resolveImageUri(uri: string | undefined): string | undefined {
  if (uri === undefined) return undefined;
  const resolved = STATIC_IMAGE_URLS[uri];
  return typeof resolved === "string" ? resolved : uri;
}

/** Only public feed photos and opted-in bundled previews enter the optimizer.
 * Signed URLs, protected API media, blobs and full-size viewer sources pass through. */
export function resolveImageAttributes(
  uri: string | undefined,
  fullSize = false,
  optimizeLocal = false,
  sizes = "(max-width: 480px) 100vw, 480px",
) {
  if (
    !fullSize &&
    uri &&
    (isPublicFeedPhoto(uri) ||
      (optimizeLocal &&
        /^\/assets\/responsive\/[\w.-]+\.(?:jpe?g|png|webp)$/.test(uri)))
  ) {
    const { props } = getImageProps({
      src: uri,
      alt: "",
      fill: true,
      sizes,
      quality: 75,
    });
    return { src: props.src, srcSet: props.srcSet, sizes: props.sizes };
  }
  const variants = uri === undefined ? undefined : STATIC_IMAGE_VARIANTS[uri];
  if (fullSize || !Array.isArray(variants) || variants.length === 0) {
    return { src: resolveImageUri(uri), srcSet: undefined, sizes: undefined };
  }
  const fallback =
    variants.find((variant) => variant.width >= 640) ?? variants.at(-1)!;
  return {
    src: resolveImageUri(fallback.uri),
    srcSet: variants
      .map((variant) => `${resolveImageUri(variant.uri)} ${variant.width}w`)
      .join(", "),
    sizes: "(max-width: 480px) 100vw, 480px",
  };
}
