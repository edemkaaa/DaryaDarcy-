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
