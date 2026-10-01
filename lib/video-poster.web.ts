/** Extract a JPEG poster frame from a video blob (web admin upload). */
export async function extractVideoPosterBlob(videoBlob: Blob): Promise<Blob | null> {
  const doc = (globalThis as { document?: Document }).document;
  if (!doc) return null;

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(videoBlob);
    const video = doc.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
      video.load();
    };

    video.onloadeddata = () => {
      const seekTo = Number.isFinite(video.duration) && video.duration > 0
        ? Math.min(0.5, video.duration * 0.08)
        : 0;
      video.currentTime = seekTo;
    };

    video.onseeked = () => {
      try {
        const canvas = doc.createElement("canvas");
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 360;
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")?.drawImage(video, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            cleanup();
            resolve(blob);
          },
          "image/jpeg",
          0.88,
        );
      } catch {
        cleanup();
        resolve(null);
      }
    };

    video.onerror = () => {
      cleanup();
      resolve(null);
    };

    video.src = objectUrl;
  });
}
