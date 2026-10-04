export const SaveFormat = { JPEG: "jpeg", PNG: "png", WEBP: "webp" };
type Operation = {
  crop?: {
    originX: number;
    originY: number;
    width: number;
    height: number;
  };
  resize?: {
    width?: number;
    height?: number;
  };
};
export async function manipulateAsync(
  uri: string,
  operations: Operation[],
  options: {
    compress?: number;
    format?: string;
  } = {},
) {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = uri;
  });
  let source: CanvasImageSource = img;
  let width = img.naturalWidth,
    height = img.naturalHeight;
  for (const op of operations) {
    const canvas = document.createElement("canvas");
    const crop = op.crop;
    const resize = op.resize;
    if (crop) {
      canvas.width = crop.width;
      canvas.height = crop.height;
      canvas
        .getContext("2d")!
        .drawImage(
          source,
          crop.originX,
          crop.originY,
          crop.width,
          crop.height,
          0,
          0,
          canvas.width,
          canvas.height,
        );
    } else if (resize) {
      canvas.width =
        resize.width || Math.round(width * (resize.height! / height));
      canvas.height =
        resize.height || Math.round(height * (resize.width! / width));
      canvas
        .getContext("2d")!
        .drawImage(source, 0, 0, canvas.width, canvas.height);
    } else continue;
    source = canvas;
    width = canvas.width;
    height = canvas.height;
  }
  const result =
    source instanceof HTMLCanvasElement
      ? source
      : Object.assign(document.createElement("canvas"), { width, height });
  if (!(source instanceof HTMLCanvasElement))
    result.getContext("2d")!.drawImage(img, 0, 0);
  return {
    uri: result.toDataURL(
      "image/" + (options.format || "jpeg"),
      options.compress || 0.8,
    ),
    width,
    height,
  };
}
