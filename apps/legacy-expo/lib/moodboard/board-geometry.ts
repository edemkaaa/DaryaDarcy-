// Архив Expo. Вычисляет квадратную рамку и рабочую область из долевых отступов исходного изображения.
/** Measured from «доска» Yandex XXXL preview → PNG 1280×1280. */
export const BOARD_FRAME_ASPECT = 1;

export const BOARD_CANVAS_INSETS = {
  top: 0.135,
  left: 0.019,
  right: 0.012,
  bottom: 0.198,
};

export function boardLayout(displayWidth: number) {
  // Вычисляет квадратную рамку и рабочую область из долевых отступов исходного изображения.

  const height = Math.round(displayWidth / BOARD_FRAME_ASPECT);
  const canvasWidth = Math.round(displayWidth * (1 - BOARD_CANVAS_INSETS.left - BOARD_CANVAS_INSETS.right));
  const canvasHeight = Math.round(height * (1 - BOARD_CANVAS_INSETS.top - BOARD_CANVAS_INSETS.bottom));
  return {
    width: displayWidth,
    height,
    canvasWidth,
    canvasHeight,
    canvasStyle: {
      top: height * BOARD_CANVAS_INSETS.top,
      left: displayWidth * BOARD_CANVAS_INSETS.left,
      right: displayWidth * BOARD_CANVAS_INSETS.right,
      bottom: height * BOARD_CANVAS_INSETS.bottom,
    },
  };
}

/** Default placement for a new photo on the linen canvas (reference width 448). */
export function defaultItemPlacement(index: number, refWidth = 448) {
  // Раскладывает новые фото тремя перекрывающимися колонками в координатах опорной доски.

  const { canvasWidth, canvasHeight } = boardLayout(refWidth);
  const size = Math.round(Math.min(canvasWidth, canvasHeight) * 0.28);
  const cols = 3;
  const gap = 10;
  const col = index % cols;
  const row = Math.floor(index / cols);
  return {
    x: gap + col * (size * 0.75 + gap),
    y: gap + row * (size * 0.8 + gap),
    width: size,
    height: Math.round(size * 1.12),
  };
}
