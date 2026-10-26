import type { AestheticGuideKey } from "@shared/aesthetic-guide";
import { invalidResponse } from "@/shared/api/errors";

export const aestheticMaterialKey = (key: AestheticGuideKey) =>
  `aesthetic-${key.toLowerCase()}` as `aesthetic-${Lowercase<AestheticGuideKey>}`;

/** Resolve approved slots against authenticated bindings; never expose a public fallback. */
export function resolveAestheticImages(
  key: AestheticGuideKey,
  files: readonly { fileKey: string; url: string }[],
  sources: readonly { uri: string }[],
): { uri: string }[] {
  const material = aestheticMaterialKey(key);
  const byKey = new Map(files.map((file) => [file.fileKey, file.url]));
  if (byKey.size !== files.length) throw invalidResponse();
  return sources.map((source) => {
    const match =
      /^\/assets\/results\/([a-z]+)\/(interiors|moodboards|outfits)\/([a-z0-9-]+)(?:\.lossless)?\.webp$/.exec(
        source.uri,
      );
    if (!match || `aesthetic-${match[1]}` !== material) throw invalidResponse();
    const fileKey = `${match[2]}-${match[3]}`;
    const url = byKey.get(fileKey);
    if (url !== `/api/media/library-files/${material}/${fileKey}`)
      throw invalidResponse();
    return { uri: url };
  });
}
