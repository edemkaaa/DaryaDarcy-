export function mediaBasename(url: string): string {
  return decodeURIComponent(url.split("/").pop()?.split("?")[0] || "");
}

function isThumbUrl(url: string): boolean {
  const name = mediaBasename(url).toLowerCase();
  return name.includes("_thumb.") || name.endsWith("_thumb.jpg") || name.endsWith("_thumb.jpeg");
}

function thumbForVideo(thumbs: string[], videoFilename: string): string | undefined {
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
