/** Загрузка вкладки не рисует приблизительную копию будущего баннера, чтобы его появление не дублировало оформление. */
import RouteLoading from "@/shared/ui/route-loading";

// The real screen owns its layout and entrance. An approximate copy would
// change geometry and show the banner twice when the lazy module arrives.
/** Во время загрузки модуля показываем только общую заглушку маршрута: сам экран позже создаст свой баннер и эффекты. */
export default function TabLoading({ path }: { path: string }) {
  return <RouteLoading path={path} />;
}
