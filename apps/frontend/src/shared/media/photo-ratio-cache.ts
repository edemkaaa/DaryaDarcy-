/** Кеш пропорций помогает не повторять измерение известного фото; он хранит геометрию, а не закрытые байты изображения. */
// Keep URL metadata bounded during long browsing sessions.
export const PHOTO_RATIO_CACHE_LIMIT = 256;
const ratios = new Map<string, number>();

export function getCachedPhotoRatio(uri: string): number | undefined {
  const ratio = ratios.get(uri);
  if (ratio !== undefined) {
    ratios.delete(uri);
    ratios.set(uri, ratio);
  }
  return ratio;
}

export function rememberPhotoRatio(
  uri: string,
  width: number,
  height: number,
): number | null {
  if (
    !uri ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    return null;
  const ratio = width / height;
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  ratios.delete(uri);
  ratios.set(uri, ratio);
  if (ratios.size > PHOTO_RATIO_CACHE_LIMIT)
    ratios.delete(ratios.keys().next().value!);
  return ratio;
}
