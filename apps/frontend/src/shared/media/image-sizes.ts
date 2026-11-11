/** Размер слота описывает реальную ширину изображения в макете, чтобы браузер выбирал подходящий вариант srcset. Расчёт учитывает холст 480 px, поля и зазоры между фото. */
/** Описываем ширину слота в полотне до 480px с учётом внешних отступов и межколоночных промежутков для выбора srcset. */
export function imageSlotSizes(columns = 1, gutters = 0, gap = 1) {
  const spacing = gutters + (columns - 1) * gap;
  return `(max-width: 480px) calc((100vw - ${spacing}px) / ${columns}), ${(480 - spacing) / columns}px`;
}
