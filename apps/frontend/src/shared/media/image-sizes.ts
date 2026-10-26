/** Match the existing 480px app canvas, gutters and one-pixel photo gaps. */
export function imageSlotSizes(columns = 1, gutters = 0, gap = 1) {
  const spacing = gutters + (columns - 1) * gap;
  return `(max-width: 480px) calc((100vw - ${spacing}px) / ${columns}), ${(480 - spacing) / columns}px`;
}
