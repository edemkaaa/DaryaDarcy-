/** Неизвестный адрес получает отдельное состояние отсутствия и явный переход, а не пустое содержимое приложения. */
import { StatusNotice, StatusNoticeLink } from "@/shared/ui/status-notice";
import { ScreenStatus } from "@/shared/ui/screen-status";
export default function NotFound() {
  return (
    <ScreenStatus>
      <StatusNotice
        actions={
          <StatusNoticeLink href="/">Вернуться на главную →</StatusNoticeLink>
        }
      >
        Страница не найдена.
      </StatusNotice>
    </ScreenStatus>
  );
}
