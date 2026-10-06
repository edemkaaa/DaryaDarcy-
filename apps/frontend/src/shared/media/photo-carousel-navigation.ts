import type { KeyboardEvent } from "react";

export function scrollPhotoWithKeyboard(
  event: KeyboardEvent<HTMLDivElement>,
  width: number,
  count: number,
) {
  if (width <= 0 || count < 2 || event.altKey || event.ctrlKey || event.metaKey)
    return;
  const node = event.currentTarget;
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
  node.scrollTo({
    left: Math.min(Math.max(next, 0), count - 1) * width,
    behavior: "instant",
  });
}
