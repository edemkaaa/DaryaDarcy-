"use client";
/** Граница маршрута показывает ошибку и явный повтор рендера; исключение не превращается в успешный пустой экран. */
import { StatusNotice, StatusNoticeAction } from "@/shared/ui/status-notice";
import { ScreenStatus } from "@/shared/ui/screen-status";
/** Предлагаем повтор границы Next через reset; отдельного сетевого повтора или сброса пользовательских данных здесь нет. */
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <ScreenStatus>
      <StatusNotice
        tone="error"
        actions={
          <StatusNoticeAction onClick={reset}>
            Попробовать ещё раз
          </StatusNoticeAction>
        }
      >
        Не удалось открыть страницу.
      </StatusNotice>
    </ScreenStatus>
  );
}
