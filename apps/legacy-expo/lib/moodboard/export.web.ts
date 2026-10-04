import type { MoodboardDoc } from "@/lib/moodboard/types";
import {
  boardLayout,
  BOARD_CANVAS_INSETS,
  BOARD_FRAME_ASPECT,
} from "@/lib/moodboard/board-geometry";

const EXPORT_W = 1000;
const EXPORT_H = Math.round(EXPORT_W / BOARD_FRAME_ASPECT);

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function boardFrameSrc(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const asset = require("@/assets/images/moodboard/board-frame-alpha.png");
  return asset?.uri ?? asset;
}

export async function exportMoodboardImage(board: MoodboardDoc): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_W;
  canvas.height = EXPORT_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  const frame = await loadImage(boardFrameSrc());
  ctx.drawImage(frame, 0, 0, EXPORT_W, EXPORT_H);

  const ref = boardLayout(448);
  const offX = EXPORT_W * BOARD_CANVAS_INSETS.left;
  const offY = EXPORT_H * BOARD_CANVAS_INSETS.top;
  const innerW = EXPORT_W * (1 - BOARD_CANVAS_INSETS.left - BOARD_CANVAS_INSETS.right);
  const scaleX = innerW / ref.canvasWidth;

  for (const item of board.items) {
    try {
      const img = await loadImage(item.uri);
      ctx.drawImage(
        img,
        offX + item.x * scaleX,
        offY + item.y * scaleX,
        item.width * scaleX,
        item.height * scaleX,
      );
    } catch {
      // skip broken image
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Export failed"));
    }, "image/png");
  });
}

export async function saveAndShareMoodboard(board: MoodboardDoc): Promise<void> {
  const blob = await exportMoodboardImage(board);
  const fileName = `${board.title.replace(/\s+/g, "-") || "moodboard"}.png`;
  const file = new File([blob], fileName, { type: "image/png" });

  if (typeof navigator !== "undefined" && navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: board.title });
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
