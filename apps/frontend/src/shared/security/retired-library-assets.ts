/** Список выведенных из публичной выдачи материалов проверяем и для прямых адресов, и для параметров оптимизатора изображений. */
import manifest from "../../../private-library-assets.json";
const paths = new Set(manifest.paths);

/** Декодируем ограниченное число оболочек URL и сверяем pathname с манифестом снятых материалов, включая запросы оптимизатора. */
export function isRetiredLibraryAsset(value: string): boolean {
  try {
    let decoded = value;
    for (let i = 0; i < 3; i++) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
    return paths.has(new URL(decoded, "https://local.invalid").pathname);
  } catch {
    return false;
  }
}
