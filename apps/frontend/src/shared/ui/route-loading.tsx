import { Spinner } from "@/shared/ui/elements";
export default function RouteLoading() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <Spinner />
      <span>Загрузка страницы…</span>
    </div>
  );
}
