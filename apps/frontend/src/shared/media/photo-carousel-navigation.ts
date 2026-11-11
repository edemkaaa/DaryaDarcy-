/** Переходы по индексам фотографий выделены из рендера, чтобы одинаково обрабатывать крайние элементы и изменение набора. */
import type { KeyboardEvent } from "react";

export function scrollPhotoWithKeyboard(
  event: KeyboardEvent<HTMLElement>,
  width: number,
  count: number,
  node: HTMLDivElement | null = event.currentTarget as HTMLDivElement,
) {
  if (
    !node ||
    width <= 0 ||
    count < 2 ||
    event.defaultPrevented ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey
  )
    return;
  const index = Math.round(node.scrollLeft / width);
  let next: number;
  switch (event.key) {
    case "ArrowLeft":
      next = index - 1;
      break;
    case "ArrowRight":
      next = index + 1;
      break;
    case "Home":
      next = 0;
      break;
    case "End":
      next = count - 1;
      break;
    default:
      return;
  }
  event.preventDefault();
  scrollPhotoTo(node, width, count, next);
}

export function scrollPhotoTo(
  node: HTMLDivElement | null,
  width: number,
  count: number,
  index: number,
) {
  if (!node || width <= 0 || count < 1) return;
  node.scrollTo({
    left: Math.min(Math.max(index, 0), count - 1) * width,
    behavior: "instant",
  });
}
