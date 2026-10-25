import { runFileTask } from "@/shared/browser/file-task";
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
    signal?: AbortSignal;
  } = {},
) {
  return runFileTask(async (signal) => {
    const img = new Image();
    const canvases: HTMLCanvasElement[] = [];
    let rejectLoad: (reason: unknown) => void = () => {};
    const cancel = () => {
      img.removeAttribute("src");
      rejectLoad(signal.reason);
    };
    signal.addEventListener("abort", cancel, { once: true });
    try {
      await new Promise<void>((resolve, reject) => {
        rejectLoad = reject;
        img.crossOrigin = "anonymous";
        img.onload = () => resolve();
        img.onerror = () =>
          reject(new Error("Не удалось обработать фото. Попробуйте ещё раз."));
        img.src = uri;
      });
      signal.throwIfAborted();
      if (!img.naturalWidth || !img.naturalHeight)
        throw new Error("Не удалось определить размер фото.");
      let source: CanvasImageSource = img;
      let width = img.naturalWidth,
        height = img.naturalHeight;
      for (let index = 0; index < operations.length; index++) {
        signal.throwIfAborted();
        const op = operations[index];
        if (!op.crop && !op.resize) continue;
        const canvas = document.createElement("canvas");
        canvases.push(canvas);
        const crop = op.crop;
        // Crop directly into the final avatar size instead of allocating a
        // potentially huge intermediate canvas for the selected source area.
        const resize =
          crop && operations[index + 1]?.resize
            ? operations[++index].resize
            : op.resize;
        const sourceWidth = crop?.width ?? width;
        const sourceHeight = crop?.height ?? height;
        canvas.width =
          resize?.width ??
          (resize?.height
            ? Math.round((sourceWidth * resize.height) / sourceHeight)
            : sourceWidth);
        canvas.height =
          resize?.height ??
          (resize?.width
            ? Math.round((sourceHeight * resize.width) / sourceWidth)
            : sourceHeight);
        const context = canvas.getContext("2d");
        if (!context || !canvas.width || !canvas.height)
          throw new Error("Не удалось подготовить область фото.");
        context.drawImage(
          source,
          crop?.originX ?? 0,
          crop?.originY ?? 0,
          sourceWidth,
          sourceHeight,
          0,
          0,
          canvas.width,
          canvas.height,
        );
        if (source instanceof HTMLCanvasElement)
          source.width = source.height = 0;
        source = canvas;
        width = canvas.width;
        height = canvas.height;
      }
      const result =
        source instanceof HTMLCanvasElement
          ? source
          : document.createElement("canvas");
      if (!(source instanceof HTMLCanvasElement)) {
        canvases.push(result);
        result.width = width;
        result.height = height;
        const context = result.getContext("2d");
        if (!context) throw new Error("Не удалось подготовить фото.");
        context.drawImage(img, 0, 0);
      }
      signal.throwIfAborted();
      const resultUri = result.toDataURL(
        "image/" + (options.format ?? "jpeg"),
        options.compress ?? 0.8,
      );
      signal.throwIfAborted();
      if (resultUri === "data:,")
        throw new Error("Не удалось обработать фото.");
      return { uri: resultUri, width, height };
    } finally {
      signal.removeEventListener("abort", cancel);
      img.onload = img.onerror = null;
      img.removeAttribute("src");
      for (const canvas of canvases) canvas.width = canvas.height = 0;
    }
  }, options.signal);
}
