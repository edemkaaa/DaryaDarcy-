/** Небольшая заглушка маршрута не дублирует баннер и анимацию экрана, который ещё загружается. */
import { ScreenContainer } from "./screen-container";
export default function RouteLoading({ path }: { path?: string } = {}) {
  return (
    <ScreenContainer>
      <div
        className="ui-route-loading"
        data-loading-screen={path}
        role="status"
        aria-label="Открываем раздел"
      >
        <span aria-hidden="true">Открываем раздел…</span>
      </div>
    </ScreenContainer>
  );
}
