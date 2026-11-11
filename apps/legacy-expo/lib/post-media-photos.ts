// Архив Expo. Извлекает декодированное имя из пути без query; ожидает корректные escape-последовательности.
export function mediaBasename(url: string): string {
  // Извлекает декодированное имя из пути без query; ожидает корректные escape-последовательности.

  return decodeURIComponent(url.split("/").pop()?.split("?")[0] || "");
}

function isThumbUrl(url: string): boolean {
  // Распознаёт исторические миниатюры по суффиксу имени файла.

  const name = mediaBasename(url).toLowerCase();
  return name.includes("_thumb.") || name.endsWith("_thumb.jpg") || name.endsWith("_thumb.jpeg");
}

function thumbForVideo(thumbs: string[], videoFilename: string): string | undefined {
  // Ищет превью с тем же базовым именем видеовложения.

  const base = videoFilename.replace(/\.[^.]+$/, "").toLowerCase();
  return thumbs.find((url) => {
    const name = mediaBasename(url).toLowerCase();
    return (
      name === `${base}_thumb.jpg` ||
      name === `${base}_thumb.jpeg` ||
      name.startsWith(`${base}_thumb.`)
    );
  });
}

export function splitVideoPhotos(
  photos: string[] | undefined,
  videoFilename?: string | null,
): { posterUrl?: string; galleryPhotos: string[] } {
  // Отделяет poster от галереи, используя первый обычный снимок как последний fallback.

  const list = photos || [];
  if (!list.length) return { posterUrl: undefined, galleryPhotos: [] };

  const thumbs = list.filter(isThumbUrl);
  const fullPhotos = list.filter((url) => !isThumbUrl(url));

  let posterUrl: string | undefined;
  if (videoFilename) {
    posterUrl = thumbForVideo(thumbs, videoFilename);
  }
  if (!posterUrl && thumbs.length) {
    posterUrl = thumbs[0];
  }
  if (!posterUrl && fullPhotos.length) {
    return {
      posterUrl: fullPhotos[0],
      galleryPhotos: fullPhotos.slice(1),
    };
  }

  return { posterUrl, galleryPhotos: fullPhotos };
}
