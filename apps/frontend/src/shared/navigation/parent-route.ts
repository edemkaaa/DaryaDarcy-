/** Для прямой ссылки без истории приложения выбираем понятный родительский раздел вместо случайного внешнего возврата. */
export function parentRoute(path: string) {
  if (path.startsWith("/post/")) return "/feed";
  if (path.startsWith("/video/")) return "/videos";
  if (path.startsWith("/library/")) return "/library";
  if (path.startsWith("/shop/")) return "/shop";
  if (path === "/quiz") return "/interactive";
  if (path.startsWith("/legal/")) return "/legal";
  return "/";
}
