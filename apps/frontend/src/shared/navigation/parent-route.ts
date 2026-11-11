/** Для прямой ссылки без истории приложения выбираем понятный родительский раздел вместо случайного внешнего возврата. */
/** A useful exit when a page was opened directly, without app history. */
export function parentRoute(path: string) {
  if (path.startsWith("/post/")) return "/feed";
  if (path.startsWith("/video/")) return "/videos";
  if (path.startsWith("/library/")) return "/library";
  if (path.startsWith("/shop/")) return "/shop";
  if (path === "/quiz") return "/interactive";
  if (path.startsWith("/legal/")) return "/legal";
  return "/";
}
