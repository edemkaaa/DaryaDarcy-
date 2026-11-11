/** Ресурсы и подписи редактора фотографий отделены от компонентов; изменение этих данных входит в клиентскую сборку. */
export const GAP = 8;
// Удержание отделяет drag-перестановку от обычной прокрутки; изменение порога влияет на touch-поведение.
export const LONG_PRESS_MS = 300;
// Настройки подавления native выделения предназначены для draggable поверхности, а не для всей страницы.
export const WEB_NO_CALLOUT = {
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
  touchAction: "none",
} as object;
